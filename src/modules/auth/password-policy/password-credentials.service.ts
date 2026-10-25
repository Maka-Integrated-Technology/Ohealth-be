import { createHash } from 'crypto';

import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import {
  isLoginPasswordWithinLimit,
  meetsPasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from './password-policy';

// Versioned prehash uses the bcrypt salt before deriving a 43-byte digest.
// This prevents bcrypt's 72-byte truncation and avoids reusing a raw
// unsalted digest across services.
const HASH_PREFIX = 'ohealth$bcrypt-sha256$v1$';
const DUMMY_PASSWORD = 'ohealth-missing-account-work-v1';
const STORED_BCRYPT_HASH =
  /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

@Injectable()
export class PasswordCredentialsService implements OnModuleInit {
  private readonly saltRounds: number;
  private missingAccountHashPromise: Promise<string> | undefined;

  constructor(config: ConfigService) {
    const saltRounds = Number(config.get<string>('HASH_SALT', '10'));
    if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 14) {
      throw new Error('HASH_SALT must be an integer between 10 and 14.');
    }
    this.saltRounds = saltRounds;
  }

  // Nest awaits module initialization before accepting HTTP traffic.
  async onModuleInit(): Promise<void> {
    await this.getMissingAccountHash();
  }

  private getMissingAccountHash(): Promise<string> {
    this.missingAccountHashPromise ??= bcrypt.hash(
      DUMMY_PASSWORD,
      this.saltRounds,
    );
    return this.missingAccountHashPromise;
  }

  private prehash(password: string, bcryptHashOrSalt: string): string {
    return createHash('sha256')
      .update('ohealth:credential:v1:', 'utf8')
      .update(bcryptHashOrSalt.slice(0, 29), 'ascii')
      .update(password.normalize('NFC'), 'utf8')
      .digest('base64url');
  }

  async hashNewPassword(password: string): Promise<string> {
    if (!meetsPasswordPolicy(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }
    const salt = await bcrypt.genSalt(this.saltRounds);
    const derived = this.prehash(password, salt);
    const bcryptHash = await bcrypt.hash(derived, salt);
    return HASH_PREFIX + bcryptHash;
  }

  // Only server-generated OAuth placeholders use the legacy path.
  async hashGeneratedSecret(secret: string): Promise<string> {
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') > 72) {
      throw new Error('Invalid generated credential.');
    }
    return bcrypt.hash(secret, this.saltRounds);
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    if (!isLoginPasswordWithinLimit(password)) {
      return false;
    }
    const modern = storedHash.startsWith(HASH_PREFIX);
    const hash = modern ? storedHash.slice(HASH_PREFIX.length) : storedHash;
    if (!STORED_BCRYPT_HASH.test(hash)) {
      return false;
    }
    // Never allow legacy bcrypt credentials to match after byte 72.
    if (!modern && Buffer.byteLength(password, 'utf8') > 72) {
      return false;
    }
    return bcrypt.compare(
      modern ? this.prehash(password, hash) : password,
      hash,
    );
  }

  async verifyForLogin(
    password: string,
    storedHash: string | null,
  ): Promise<boolean> {
    if (!isLoginPasswordWithinLimit(password)) {
      return false;
    }
    const modern = Boolean(storedHash?.startsWith(HASH_PREFIX));
    const candidate = modern
      ? storedHash!.slice(HASH_PREFIX.length)
      : storedHash;
    const valid = Boolean(candidate && STORED_BCRYPT_HASH.test(candidate));
    const hash = valid ? candidate! : await this.getMissingAccountHash();
    const bytes = Buffer.byteLength(password, 'utf8');
    const normalized =
      modern && valid ? this.prehash(password, hash) : password;
    // Always run one full bcrypt comparison for bounded login input.
    const matched = await bcrypt.compare(normalized, hash);
    return Boolean(valid && matched && (modern || bytes <= 72));
  }
}
