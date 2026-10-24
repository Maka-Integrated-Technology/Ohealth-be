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

  beforeEach(() => {
    credentials = new PasswordCredentialsService(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('provides stable length limits without bcrypt truncation', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_UTF8_BYTES).toBe(72);
    expect(meetsPasswordPolicy('Password123')).toBe(true);
    expect(meetsPasswordPolicy('Abcdefg1' + 'x'.repeat(64))).toBe(true);
    expect(meetsPasswordPolicy('Abcdefg1' + 'x'.repeat(65))).toBe(false);
    expect(meetsPasswordPolicy('Abcdefg1' + 'é'.repeat(33))).toBe(false);
  });

  it.each([
    null,
    123,
    '',
    'short1A',
    'onlylowercase123',
    'UPPERCASE123',
    'NoNumbersHere',
    'Abcdefg1' + 'é'.repeat(33),
    'Abcdefg1' + 'a'.repeat(10000),
  ])(
    'rejects unsafe password setting input %# before bcrypt',
    async (input) => {
      const hashSpy = jest.spyOn(bcrypt, 'hash');
      await expect(
        credentials.hashNewPassword(input as string),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(hashSpy).not.toHaveBeenCalled();
    },
  );

  it('hashes and checks the same valid password using bcrypt', async () => {
    const hash = await credentials.hashNewPassword('Password123');
    expect(hash).toMatch(/^\$2b\$10\$/);
    await expect(credentials.verify('Password123', hash)).resolves.toBe(true);
    await expect(credentials.verify('WrongPass123', hash)).resolves.toBe(false);
  });

  it('does exactly one full bcrypt comparison for both missing and existing users', async () => {
    const hash = await credentials.hashNewPassword('Password123');
    const compare = jest.spyOn(bcrypt, 'compare');
    await expect(
      credentials.verifyForLogin('WrongPass123', null),
    ).resolves.toBe(false);
    await expect(
      credentials.verifyForLogin('WrongPass123', hash),
    ).resolves.toBe(false);
    expect(compare).toHaveBeenCalledTimes(2);
    expect(compare.mock.calls[0][1]).toMatch(/^\$2b\$10\$/);
    expect(compare.mock.calls[1][1]).toBe(hash);
  });

  it('rejects oversized input and invalid stored hashes without expensive work', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    await expect(
      credentials.verifyForLogin('A'.repeat(2000), null),
    ).resolves.toBe(false);
    expect(compare).not.toHaveBeenCalled();
    await expect(
      credentials.verifyForLogin('Password123', 'invalid-hash'),
    ).resolves.toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
  });
});
