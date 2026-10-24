import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import {
  LOGIN_PASSWORD_MAX_UTF8_BYTES,
  meetsPasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from './password-policy';

// A valid cost-10 bcrypt hash. Never tied to an actual user or password.
// Its only purpose is to do normal password work for a missing identity.
// Precomputed to avoid a first-request or cold-start timing discrepancy.
const MISSING_ACCOUNT_HASH =
  '$2b$10$Ftuis5NCxsw77LLSIKVzjeUkDSRtIyEo5rbKum.IUIwxXu3agTMjy';
const STORED_BCRYPT_HASH =
  /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

@Injectable()
export class PasswordCredentialsService {
  private readonly saltRounds: number;

  constructor(config: ConfigService) {
    const saltRounds = Number(config.get<string>('HASH_SALT', '10'));
    if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 14) {
      throw new Error('HASH_SALT must be an integer between 10 and 14.');
    }
    this.saltRounds = saltRounds;
  }

  async hashNewPassword(password: string): Promise<string> {
    if (!meetsPasswordPolicy(password)) {
      throw new BadRequestException(PASSWORD_POLICY_MESSAGE);
    }
    return bcrypt.hash(password, this.saltRounds);
  }

  // Used only for server-generated OAuth placeholders (never user passwords).
  async hashGeneratedSecret(secret: string): Promise<string> {
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') > 72) {
      throw new Error('Invalid generated credential.');
    }
    return bcrypt.hash(secret, this.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async verifyForLogin(
    password: string,
    storedHash: string | null,
  ): Promise<boolean> {
    if (
      typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > LOGIN_PASSWORD_MAX_UTF8_BYTES
    ) {
      return false;
    }
    // Always perform one bcrypt comparison, even for missing/corrupt users.
    const hash =
      storedHash && STORED_BCRYPT_HASH.test(storedHash)
        ? storedHash
        : MISSING_ACCOUNT_HASH;
    const matched = await bcrypt.compare(password, hash);
    return Boolean(
      storedHash && STORED_BCRYPT_HASH.test(storedHash) && matched,
    );
  }
}
