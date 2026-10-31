import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthRateLimitService } from '../src/modules/auth/challenges/auth-rate-limit.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('Purpose-bound auth challenge HTTP contracts (isolated e2e)', () => {
  let app: INestApplication;
  const secureMessage =
    'If this account is eligible, a verification message has been queued.';
  const challengeId = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
  const service = {
    verifySignup: jest.fn().mockResolvedValue({ message: 'verified' }),
    resendVerification: jest.fn().mockResolvedValue({ message: secureMessage }),
    forgotPassword: jest.fn().mockResolvedValue({ message: secureMessage }),
    resetPassword: jest.fn().mockResolvedValue({ message: 'password changed' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
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
        { provide: AuthAbuseGuard, useValue: { canActivate: () => true } },
        { provide: JwtAuthGuard, useValue: { canActivate: () => false } },
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

  beforeEach(() => jest.clearAllMocks());

  it('rejects old email-only verification requests before reaching a handler', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ email: 'patient@example.test', code: '123456' })
      .expect(400);
    expect(service.verifySignup).not.toHaveBeenCalled();
  });

  it('passes challenge ID and six-digit proof for verified-contact requests', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: challengeId, code: '123456' })
      .expect(200);
    expect(service.verifySignup).toHaveBeenCalledWith({
      challenge_id: challengeId,
      code: '123456',
    });
  });

  it('rejects malformed challenge identity and code without reaching verification', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: 'not-a-uuid', code: 'secret' })
      .expect(400);
    expect(service.verifySignup).not.toHaveBeenCalled();
  });

  it('rejects old reset tokens without a purpose-bound challenge proof', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        token: 'plaintext-legacy-token',
        newPassword: 'a secure memorable replacement passphrase',
      })
      .expect(400);
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('accepts challenge-bound reset proof and never forwards legacy token fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        challenge_id: challengeId,
        code: '123456',
        newPassword: 'a secure memorable replacement passphrase',
        token: 'should-be-stripped',
      })
      .expect(201);
    expect(service.resetPassword).toHaveBeenCalledWith({
      challenge_id: challengeId,
      code: '123456',
      newPassword: 'a secure memorable replacement passphrase',
    });
  });

  it('returns the same generic recovery and resend message without a secret', async () => {
    const recovery = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.test' })
      .expect(201);
    const resend = await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ email: 'unknown@example.test' })
      .expect(200);
    expect(recovery.body.message).toBe(secureMessage);
    expect(resend.body.message).toBe(secureMessage);
    expect(
      JSON.stringify(recovery.body) + JSON.stringify(resend.body),
    ).not.toContain('123456');
  });
});
