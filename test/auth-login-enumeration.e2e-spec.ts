import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as request from 'supertest';

import { AccountAccessPolicyService } from '../src/modules/auth/account-access-policy.service';
import { AuthRoutingService } from '../src/modules/auth/auth-routing.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthRateLimitService } from '../src/modules/auth/challenges/auth-rate-limit.service';
import { AuthSession } from '../src/modules/auth/entities/auth.entity';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordCredentialsService } from '../src/modules/auth/password-policy/password-credentials.service';
import { EmailService } from '../src/modules/email/email.service';
import { AccountStatus } from '../src/modules/user/enums/account-status.enum';
import { UserRole } from '../src/modules/user/enums/user-role.enum';
import { UserService } from '../src/modules/user/user.service';

describe('Credential enumeration resistance (isolated HTTP e2e)', () => {
  let app: INestApplication;
  let normalizedPasswordHash: string;
  const findByEmail = jest.fn();
  const logger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const address = '/api/auth/login';
  const allLoggerCalls = () =>
    JSON.stringify(
      [logger.child, logger.info, logger.warn, logger.error].flatMap(
        (level) => level.mock.calls,
      ),
    );

  beforeAll(async () => {
    const existingHash = await bcrypt.hash('Password123', 10);
    findByEmail.mockImplementation(async (email: string) => {
      if (email === 'normalized@example.com') {
        return {
          id: 'normalized-user',
          email,
          password: normalizedPasswordHash,
          role: [UserRole.PATIENT],
          account_status: AccountStatus.SUSPENDED,
          email_verified_at: new Date(),
        };
      }
      if (email === 'suspended@example.com') {
        return {
          id: 'suspended-user',
          email,
          password: existingHash,
          role: [UserRole.PATIENT],
          account_status: AccountStatus.SUSPENDED,
          email_verified_at: new Date(),
        };
      }
      return null;
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: AuthAbuseGuard, useValue: { canActivate: () => true } },
        {
          provide: AuthRateLimitService,
          useValue: {
            consume: jest.fn().mockResolvedValue({
              allowed: true,
              hits: 1,
              retryAfterSeconds: 0,
            }),
          },
        },
        AccountAccessPolicyService,
        PasswordCredentialsService,
        { provide: UserService, useValue: { findByEmail } },
        { provide: getRepositoryToken(AuthSession), useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: AuthRoutingService, useValue: {} },
        { provide: JwtAuthGuard, useValue: { canActivate: () => false } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'HASH_SALT' ? '10' : fallback,
          },
        },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    normalizedPasswordHash = await module
      .get(PasswordCredentialsService)
      .hashNewPassword('é'.repeat(512));
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    findByEmail.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    logger.child.mockClear();
  });

  it('does not disclose account existence or state for an incorrect password', async () => {
    const unknown = await request(app.getHttpServer())
      .post(address)
      .send({ email: 'missing@example.com', password: 'WrongPass123' })
      .expect(401);
    const existing = await request(app.getHttpServer())
      .post(address)
      .send({ email: 'suspended@example.com', password: 'WrongPass123' })
      .expect(401);

    expect(unknown.body).toEqual(existing.body);
    expect(unknown.body.message).toBe('invalid credentials');
    expect(findByEmail).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('checks credential proof before disclosing an inactive account', async () => {
    const response = await request(app.getHttpServer())
      .post(address)
      .send({ email: 'suspended@example.com', password: 'Password123' })
      .expect(401);
    expect(response.body.message).toBe('user account is inactive');
  });

  it('rejects pathological password input before expensive database or bcrypt work', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');
    await request(app.getHttpServer())
      .post(address)
      .send({ email: 'missing@example.com', password: 'A'.repeat(2048) })
      .expect(401);
    expect(findByEmail).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
    compare.mockRestore();
  });

  it('accepts an NFC-equivalent decomposed password before database lookup', async () => {
    const composed = 'é'.repeat(512);
    const decomposed = 'e\u0301'.repeat(512);
    for (const password of [composed, decomposed]) {
      const response = await request(app.getHttpServer())
        .post(address)
        .send({ email: 'normalized@example.com', password })
        .expect(401);
      // Successful password proof reaches account-state enforcement.
      expect(response.body.message).toBe('user account is inactive');
    }
    expect(findByEmail).toHaveBeenCalledTimes(2);
  });

  it('does not log credentials or tokens on rejection', async () => {
    const secret = 'NeverLogThis123';
    await request(app.getHttpServer())
      .post(address)
      .send({ email: 'missing@example.com', password: secret })
      .expect(401);
    expect(allLoggerCalls()).not.toContain(secret);
    expect(allLoggerCalls()).not.toContain('missing@example.com');
    expect(allLoggerCalls()).not.toContain('access_token');
    expect(allLoggerCalls()).not.toContain('refresh_token');
    expect(logger.info).not.toHaveBeenCalled();
    // Negative control proves the assertion detects a leaked secret.
    logger.warn(secret);
    expect(() => expect(allLoggerCalls()).not.toContain(secret)).toThrow();
  });
});
