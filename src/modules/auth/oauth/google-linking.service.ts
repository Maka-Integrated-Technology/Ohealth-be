import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { DataSource } from 'typeorm';

import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { LegalDocumentType } from '../../identity/enums/legal-document-type.enum';
import { User } from '../../user/entities/user.entity';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';

/**
 * Intended for an authenticated explicit link command ONLY. No public route is
 * exposed here. #77 must provide the verified-session actor ID and a server-
 * enforced recent-auth proof. The expected Google nonce comes from an
 * authenticated, CSRF-safe initiated flow, not the caller's request body.
 */
@Injectable()
export class GoogleLinkingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly policy: AccountAccessPolicyService,
    private readonly audit: AuthSecurityAuditService,
  ) {}

  async link(
    authenticatedUserId: string,
    idToken: string,
    expectedNonce: string,
    assertRecentAuthentication: (userId: string) => Promise<void>,
  ): Promise<void> {
    if (
      !authenticatedUserId ||
      !expectedNonce ||
      typeof assertRecentAuthentication !== 'function'
    ) {
      throw new UnauthorizedException('Recent authentication required.');
    }
    await assertRecentAuthentication(authenticatedUserId);

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new UnauthorizedException('Invalid Google identity.');

    let proof: { sub?: string; email?: string; email_verified?: boolean; nonce?: string } | null;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken,
        audience: clientId,
      });
      proof = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google identity.');
    }
    if (
      !proof?.sub ||
      !proof.email_verified ||
      !proof.email ||
      proof.nonce !== expectedNonce
    ) {
      throw new UnauthorizedException('Invalid Google identity.');
    }
    const normalizedProviderEmail = proof.email.trim().toLowerCase();
    try {
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: authenticatedUserId },
          lock: { mode: 'pessimistic_write' },
        });
        this.policy.assertCanAuthenticate(user);
        if (!user || user.email.trim().toLowerCase() !== normalizedProviderEmail) {
          throw new UnauthorizedException('Invalid Google identity.');
        }
        if (user.google_id && user.google_id !== proof.sub) {
          throw new ConflictException('A different Google identity is already linked.');
        }
        // Require evidence that this user accepted the currently approved
        // legal documents; legacy users without proof must complete consent.
        const terms = this.config.get<string>('REGISTRATION_TERMS_VERSION');
        const privacy = this.config.get<string>('REGISTRATION_PRIVACY_VERSION');
        if (!terms || !privacy) throw new Error('Legal versions not configured.');
        const accepted = await manager.find(LegalAcceptance, {
          where: { user_id: user.id },
        });
        if (
          !accepted.some(x => x.document_type === LegalDocumentType.TERMS_OF_SERVICE && x.document_version === terms) ||
          !accepted.some(x => x.document_type === LegalDocumentType.PRIVACY_POLICY && x.document_version === privacy)
        ) {
          throw new UnauthorizedException('Current legal acceptance required.');
        }
        if (user.google_id === proof.sub) return; // An identical retry is safe.
        await manager.update(User, user.id, { google_id: proof.sub });
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.OAUTH_LINK,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          actor_user_id: user.id,
          subject_user_id: user.id,
        });
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Google identity is already linked.');
      }
      throw error;
    }
  }
}
