import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as qrCode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { DataSource, EntityManager } from 'typeorm';

import { User } from '../user/entities/user.entity';

import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { User2fa } from './entities/user-2fa.entity';
import { mfaRequiredCategories } from './mfa-required-categories';
import { MfaSecretBox } from './mfa-secret-box';
import { PasswordCredentialsService } from './password-policy/password-credentials.service';
import { AuthSecurityAuditService } from './security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from './security-audit/auth-security-event.enum';

const MFA_CODE = /^[0-9]{6}$/;
const RECOVERY_CODE = /^[A-Za-z0-9_-]{22}$/;

@Injectable()
export class TwoFactorAuthService {
  constructor(
    private readonly db: DataSource,
    private readonly box: MfaSecretBox,
    private readonly passwords: PasswordCredentialsService,
    private readonly audit: AuthSecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async enable2fa(userId: string, password: string, currentCode?: string) {
    const user = await this.db
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const secret = speakeasy.generateSecret({
      name: 'OHealth (' + user.email + ')',
      issuer: 'OHealth',
      length: 32,
    });
    await this.db.transaction(async (manager) => {
      await this.assertPassword(manager, userId, password);
      const factor = await this.lockFactor(manager, userId);
      if (
        factor?.twoFaEnabled &&
        !(await this.verifyFactor(manager, factor, currentCode ?? '', false))
      ) {
        throw new UnauthorizedException('Current MFA proof required.');
      }
      const record =
        factor ?? manager.create(User2fa, { userId, twoFaEnabled: false });
      record.pendingSecret = this.box.encrypt(secret.base32);
      record.pendingExpiresAt = new Date(Date.now() + 600_000);
      await manager.save(record);
      await this.auditSuccess(
        manager,
        userId,
        AuthSecurityEventType.MFA_ENROLLMENT_STARTED,
      );
    });
    return {
      message: 'MFA setup pending confirmation.',
      secret: secret.base32,
      qrCodeUrl: await qrCode.toDataURL(secret.otpauth_url as string),
      expires_in_seconds: 600,
    };
  }

  async confirm2fa(userId: string, code: string) {
    return this.db.transaction(async (manager) => {
      const factor = await this.lockFactor(manager, userId);
      if (
        !factor?.pendingSecret ||
        !factor.pendingExpiresAt ||
        factor.pendingExpiresAt <= new Date()
      ) {
        throw new BadRequestException('MFA setup expired.');
      }
      const step = this.totpStep(this.box.decrypt(factor.pendingSecret), code);
      if (step === null) throw new UnauthorizedException('Invalid MFA code.');
      factor.encryptedSecret = factor.pendingSecret;
      factor.pendingSecret = null;
      factor.pendingExpiresAt = null;
      factor.twoFaEnabled = true;
      factor.lastUsedStep = String(step);
      await manager.save(factor);
      const codes = await this.replaceCodes(manager, userId);
      await manager.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      await this.auditSuccess(
        manager,
        userId,
        AuthSecurityEventType.MFA_ACTIVATED,
      );
      return { message: 'MFA enabled.', recovery_codes: codes };
    });
  }

  async regenerateCodes(userId: string, password: string, code: string) {
    return this.db.transaction(async (manager) => {
      await this.assertPassword(manager, userId, password);
      const factor = await this.lockFactor(manager, userId);
      if (
        !factor?.twoFaEnabled ||
        !(await this.verifyFactor(manager, factor, code, false))
      ) {
        throw new UnauthorizedException('Current MFA proof required.');
      }
      const codes = await this.replaceCodes(manager, userId);
      await manager.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      await this.auditSuccess(
        manager,
        userId,
        AuthSecurityEventType.MFA_RECOVERY_CODES_REGENERATED,
      );
      return { message: 'Recovery codes regenerated.', recovery_codes: codes };
    });
  }

  async disable2fa(userId: string, password: string, code: string) {
    await this.db.transaction(async (manager) => {
      await this.assertPassword(manager, userId, password);
      const factor = await this.lockFactor(manager, userId);
      if (
        !factor?.twoFaEnabled ||
        !(await this.verifyFactor(manager, factor, code, false))
      ) {
        throw new UnauthorizedException('Current MFA proof required.');
      }
      const categories = mfaRequiredCategories(this.config);
      const privileged: Array<{ category: string }> = await manager.query(
        "SELECT 'platform_admin' AS category FROM platform_privileges WHERE user_id = $1 UNION ALL SELECT CASE WHEN role = 'owner' THEN 'organization_owner' ELSE 'organization_admin' END FROM organization_memberships WHERE user_id = $1 AND status = 'active' AND role IN ('owner', 'admin')",
        [userId],
      );
      if (privileged.some((item) => categories.has(item.category as never))) {
        throw new ForbiddenException('MFA is required for this account.');
      }
      factor.twoFaEnabled = false;
      factor.encryptedSecret = null;
      factor.pendingSecret = null;
      factor.pendingExpiresAt = null;
      factor.lastUsedStep = null;
      await manager.save(factor);
      await manager.delete(MfaRecoveryCode, { userId });
      await manager.query(
        'UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId],
      );
      await this.auditSuccess(
        manager,
        userId,
        AuthSecurityEventType.MFA_DISABLED,
      );
    });
    return { message: 'MFA disabled.' };
  }

  async isEnabled(manager: EntityManager, userId: string): Promise<boolean> {
    const factor = await manager.findOne(User2fa, { where: { userId } });
    return Boolean(factor?.twoFaEnabled && factor.encryptedSecret);
  }

  async verifyForLogin(
    manager: EntityManager,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const factor = await this.lockFactor(manager, userId);
    return Boolean(
      factor?.twoFaEnabled &&
      (await this.verifyFactor(manager, factor, code, true)),
    );
  }

  private async verifyFactor(
    manager: EntityManager,
    factor: User2fa,
    code: string,
    allowRecovery: boolean,
  ): Promise<boolean> {
    if (!factor.encryptedSecret) return false;
    if (MFA_CODE.test(code)) {
      const step = this.totpStep(
        this.box.decrypt(factor.encryptedSecret),
        code,
      );
      if (
        step === null ||
        (factor.lastUsedStep !== null && step <= Number(factor.lastUsedStep))
      )
        return false;
      factor.lastUsedStep = String(step);
      await manager.save(factor);
      return true;
    }
    if (!allowRecovery || !RECOVERY_CODE.test(code)) return false;
    const deleted = await manager.delete(MfaRecoveryCode, {
      userId: factor.userId,
      codeHash: this.hash(code),
    });
    return Boolean(deleted.affected);
  }

  private totpStep(secret: string, code: string): number | null {
    if (!MFA_CODE.test(code)) return null;
    const result = speakeasy.totp.verifyDelta({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    return result ? Math.floor(Date.now() / 30_000) + result.delta : null;
  }

  private async replaceCodes(
    manager: EntityManager,
    userId: string,
  ): Promise<string[]> {
    const codes = Array.from({ length: 8 }, () =>
      randomBytes(16).toString('base64url'),
    );
    await manager.delete(MfaRecoveryCode, { userId });
    await manager.insert(
      MfaRecoveryCode,
      codes.map((code) => ({ userId, codeHash: this.hash(code) })),
    );
    return codes;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async lockFactor(
    manager: EntityManager,
    userId: string,
  ): Promise<User2fa | null> {
    await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    return manager.findOne(User2fa, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async assertPassword(
    manager: EntityManager,
    userId: string,
    password: string,
  ): Promise<void> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user || !(await this.passwords.verify(password, user.password))) {
      throw new UnauthorizedException('Recent authentication required.');
    }
  }

  private async auditSuccess(
    manager: EntityManager,
    userId: string,
    eventType: AuthSecurityEventType,
  ): Promise<void> {
    await this.audit.recordInTransaction(manager, {
      event_type: eventType,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      actor_user_id: userId,
      subject_user_id: userId,
    });
  }
}
