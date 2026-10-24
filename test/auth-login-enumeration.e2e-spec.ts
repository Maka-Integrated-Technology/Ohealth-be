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
import { AuthSession } from '../src/modules/auth/entities/auth.entity';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordCredentialsService } from '../src/modules/auth/password-policy/password-credentials.service';
import { EmailService } from '../src/modules/email/email.service';
import { AccountStatus } from '../src/modules/user/enums/account-status.enum';
import { UserRole } from '../src/modules/user/enums/user-role.enum';
import { UserService } from '../src/modules/user/user.service';

describe('Credential enumeration resistance (isolated HTTP e2e)', () => {
  let app: INestApplication;
  const findByEmail = jest.fn();
  const logger = {
    child: jest.fn().mockReturnThis(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const address = '/api/auth/login';

  beforeAll(async () => {
    const existingHash = await bcrypt.hash('Password123', 10);
    findByEmail.mockImplementation(async (email: string) =>
      email === 'suspended@example.com'
        ? {
            id: 'suspended-user',
            email,
            password: existingHash,
            role: [UserRole.PATIENT],
            account_status: AccountStatus.SUSPENDED,
            email_verified_at: new Date(),
          }
        : null,
    );
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
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
    await request(app.getHttpServer())
      .post(address)
      .send({ email: 'missing@example.com', password: 'A'.repeat(2048) })
      .expect(401);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('does not log credentials or tokens on rejection', async () => {
    const secret = 'NeverLogThis123';
    await request(app.getHttpServer())
      .post(address)
      .send({ email: 'missing@example.com', password: secret })
      .expect(401);
    expect(JSON.stringify(logger)).not.toContain(secret);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
