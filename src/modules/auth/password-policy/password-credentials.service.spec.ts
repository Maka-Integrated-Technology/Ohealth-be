import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PasswordCredentialsService } from './password-credentials.service';
import {
  meetsPasswordPolicy,
  PASSWORD_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
} from './password-policy';

describe('Shared password policy and credential boundary', () => {
  const config = {
    get: jest.fn().mockReturnValue('10'),
  } as unknown as ConfigService;
  let credentials: PasswordCredentialsService;

  beforeEach(async () => {
    credentials = new PasswordCredentialsService(config);
    await credentials.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('supports long Unicode passwords without composition rules', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(15);
    expect(PASSWORD_MAX_UTF8_BYTES).toBe(1024);
    expect(meetsPasswordPolicy('Password1')).toBe(false);
    expect(meetsPasswordPolicy('password123456789')).toBe(false);
    expect(meetsPasswordPolicy('a memorable patient passphrase')).toBe(true);
    expect(meetsPasswordPolicy('a'.repeat(80))).toBe(true);
    expect(meetsPasswordPolicy('é'.repeat(65))).toBe(true);
    expect(meetsPasswordPolicy('A'.repeat(1025))).toBe(false);
  });

  it.each([null, 123, '', 'Password1', 'password123456789', 'A'.repeat(1025)])(
    'rejects unsafe setting input %# before hashing',
    async (input) => {
      const hash = jest.spyOn(bcrypt, 'hash');
      await expect(
        credentials.hashNewPassword(input as string),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(hash).not.toHaveBeenCalled();
    },
  );

  it('blocks compromised whole passwords and predictable suffix variants', () => {
    expect(meetsPasswordPolicy('passwordpassword1')).toBe(false);
    expect(meetsPasswordPolicy('qwertyuiopasdfgh1')).toBe(false);
    // This entry comes from the pinned NCSC corpus, not from local seeds.
    expect(meetsPasswordPolicy('1q2w3e4r5t6y7u8i9o0p')).toBe(false);
    // Words inside an otherwise unique passphrase are allowed.
    expect(meetsPasswordPolicy('my private password is unique here')).toBe(
      true,
    );
  });

  it('accepts canonically equivalent Unicode up to 1024 bytes after NFC', async () => {
    const composed = 'é'.repeat(512);
    const decomposed = 'e\u0301'.repeat(512);
    expect(Buffer.byteLength(composed, 'utf8')).toBe(1024);
    expect(Buffer.byteLength(decomposed, 'utf8')).toBe(1536);
    expect(meetsPasswordPolicy(decomposed)).toBe(true);
    const storedHash = await credentials.hashNewPassword(composed);
    await expect(credentials.verify(composed, storedHash)).resolves.toBe(true);
    await expect(credentials.verify(decomposed, storedHash)).resolves.toBe(
      true,
    );
    await expect(
      credentials.verifyForLogin(decomposed, storedHash),
    ).resolves.toBe(true);
    await expect(
      credentials.verifyForLogin('e\u0301'.repeat(513), storedHash),
    ).resolves.toBe(false);
  });

  it('preserves raw-byte legacy-bcrypt verification', async () => {
    const original = 'é'.repeat(30);
    const legacyHash = await bcrypt.hash(original, 10);
    await expect(credentials.verify(original, legacyHash)).resolves.toBe(true);
    await expect(
      credentials.verifyForLogin(original, legacyHash),
    ).resolves.toBe(true);
    await expect(
      credentials.verify('e\u0301'.repeat(30), legacyHash),
    ).resolves.toBe(false);
    await expect(
      credentials.verifyForLogin('e\u0301'.repeat(30), legacyHash),
    ).resolves.toBe(false);
  });

  it('uses a versioned prehash and compares every byte of long passwords', async () => {
    const password = 'Very long chosen passphrase ' + 'é'.repeat(60);
    const another = password.slice(0, -1) + 'a';
    const hash = await credentials.hashNewPassword(password);
    expect(hash.startsWith('ohealth$bcrypt-sha256$v1$')).toBe(true);
    expect(hash.slice('ohealth$bcrypt-sha256$v1$'.length)).toMatch(
      /^\$2b\$10\$/,
    );
    await expect(credentials.verify(password, hash)).resolves.toBe(true);
    await expect(credentials.verify(another, hash)).resolves.toBe(false);
    await expect(credentials.verifyForLogin(password, hash)).resolves.toBe(
      true,
    );
    await expect(credentials.verifyForLogin(another, hash)).resolves.toBe(
      false,
    );
  });

  it('accepts legacy bcrypt passwords but rejects 72-byte collisions', async () => {
    const original = 'OldPassword123!';
    const legacyHash = await bcrypt.hash(original, 10);
    await expect(credentials.verify(original, legacyHash)).resolves.toBe(true);
    await expect(
      credentials.verifyForLogin(original, legacyHash),
    ).resolves.toBe(true);
    const long = original + 'x'.repeat(100);
    await expect(credentials.verify(long, legacyHash)).resolves.toBe(false);
    await expect(credentials.verifyForLogin(long, legacyHash)).resolves.toBe(
      false,
    );
  });

  it.each([10, 11, 12, 13, 14])(
    'matches the missing-account bcrypt cost %i',
    async (cost) => {
      const configured = new PasswordCredentialsService({
        get: () => String(cost),
      } as unknown as ConfigService);
      await configured.onModuleInit();
      const existingHash = await bcrypt.hash('OldPassword123!', cost);
      const compare = jest.spyOn(bcrypt, 'compare');
      await expect(
        configured.verifyForLogin('WrongPass123', null),
      ).resolves.toBe(false);
      await expect(
        configured.verifyForLogin('WrongPass123', existingHash),
      ).resolves.toBe(false);
      expect(compare).toHaveBeenCalledTimes(2);
      const prefix = ['$2b', String(cost).padStart(2, '0'), ''].join('$');
      expect(String(compare.mock.calls[0][1]).slice(0, 7)).toBe(prefix);
      expect(String(compare.mock.calls[1][1]).slice(0, 7)).toBe(prefix);
      compare.mockRestore();
    },
    30000,
  );

  it('rejects oversized login input without expensive work', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    await expect(
      credentials.verifyForLogin('A'.repeat(2000), null),
    ).resolves.toBe(false);
    expect(compare).not.toHaveBeenCalled();
    await expect(
      credentials.verifyForLogin('Valid-but-not-in-database', 'invalid-hash'),
    ).resolves.toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
  });
});
