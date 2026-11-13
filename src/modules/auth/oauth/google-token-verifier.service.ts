import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { OAuthTransactionService } from './oauth-transaction.service';
import { OAuthException } from './oauth.error';

export interface IVerifiedGoogleIdentity {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  hostedDomain?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  constructor(private readonly transactions: OAuthTransactionService) {}

  async verify(
    idToken: string,
    audience: string,
    expectedNonceHash: string,
  ): Promise<IVerifiedGoogleIdentity> {
    try {
      const ticket = await new OAuth2Client().verifyIdToken({
        idToken,
        audience,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.iss ||
        !['accounts.google.com', 'https://accounts.google.com'].includes(
          payload.iss,
        ) ||
        payload.aud !== audience ||
        (payload.azp && payload.azp !== audience) ||
        !payload.email ||
        payload.email_verified !== true ||
        typeof payload.nonce !== 'string' ||
        this.transactions.hash(payload.nonce) !== expectedNonceHash
      ) {
        throw new Error('invalid claims');
      }
      return {
        issuer: 'https://accounts.google.com',
        subject: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: true,
        givenName: payload.given_name,
        familyName: payload.family_name,
        hostedDomain: payload.hd,
      };
    } catch {
      throw new OAuthException('OAUTH_TOKEN_INVALID');
    }
  }
}
