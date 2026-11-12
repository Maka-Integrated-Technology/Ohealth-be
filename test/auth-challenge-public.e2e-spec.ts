import { HttpStatus, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { GlobalExceptionFilter } from '../src/common/exceptions/filters/global-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthRateLimitService } from '../src/modules/auth/challenges/auth-rate-limit.service';
import {
  AuthChallengeErrorCode,
  AuthChallengeException,
} from '../src/modules/auth/challenges/auth-challenge.error';
import { AuthChallengeValidationPipe } from '../src/modules/auth/challenges/auth-challenge-validation.pipe';
import { SignupIntent } from '../src/modules/auth/enums/signup-intent.enum';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('Purpose-bound auth challenge HTTP contracts (isolated e2e)', () => {
  let app: INestApplication;
  const secureMessage =
    'If this account is eligible, a verification message has been queued.';
  const challengeId = 'f64031c5-70e4-4b37-a92c-f193e59a6621';
  const service = {
    signup: jest.fn().mockResolvedValue({
      message: 'Verification code queued',
      challenge_id: challengeId,
      delivery_target: 'a***@example.test',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    }),
    verifySignup: jest.fn().mockResolvedValue({ message: 'verified' }),
    resendVerification: jest.fn().mockResolvedValue({
      message: 'Verification code queued',
      challenge_id: challengeId,
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    }),
    forgotPassword: jest.fn().mockResolvedValue({ message: secureMessage }),
    resendRecovery: jest.fn().mockResolvedValue({
      message: 'Verification code queued',
      challenge_id: challengeId,
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    }),
    resetPassword: jest.fn().mockResolvedValue({ message: 'password changed' }),
    verifyLogin: jest.fn().mockResolvedValue({ access_token: 'access-token' }),
    resendLogin: jest.fn().mockResolvedValue({
      message: 'Verification code queued',
      challenge_id: challengeId,
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    }),
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
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      }),
    );
    app.useGlobalPipes(
      new AuthChallengeValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it.each([
    SignupIntent.PATIENT,
    SignupIntent.HEALTHCARE_PROFESSIONAL,
    SignupIntent.PHARMACY,
    SignupIntent.LABORATORY,
    SignupIntent.HOSPITAL,
  ])('accepts the controlled %s registration intent', async (intent) => {
    const organization = [
      SignupIntent.PHARMACY,
      SignupIntent.LABORATORY,
      SignupIntent.HOSPITAL,
    ].includes(intent)
      ? {
          name: 'OHealth Centre',
          registration_number: `RC-${intent}`,
          location: 'Lagos',
          contact_email: 'contact@example.test',
        }
      : undefined;
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Idempotency-Key', '550e8400-e29b-41d4-a716-446655440000')
      .send({
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'ada@example.test',
        password: 'a memorable registration passphrase',
        intent,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
        ...(organization ? { organization } : {}),
      })
      .expect(201);
    expect(response.body.data).not.toHaveProperty('access_token');
    expect(response.body.data).not.toHaveProperty('refresh_token');
    expect(service.signup).toHaveBeenCalledWith(
      expect.objectContaining({ intent }),
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it.each([
    { role: ['ADMIN'] },
    { is_active: true },
    { account_status: 'active' },
    { organization_type: 'hospital' },
  ])('rejects client-controlled registration state %#', async (hostile) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'ada@example.test',
        password: 'a memorable registration passphrase',
        intent: SignupIntent.PATIENT,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
        ...hostile,
      })
      .expect(400);
    expect(response.body).not.toHaveProperty('error_code');
    expect(service.signup).not.toHaveBeenCalled();
  });

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
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: 'not-a-uuid', code: 'secret' })
      .expect(400);
    expect(response.body.error_code).toBe('AUTH_CHALLENGE_INVALID');
    expect(service.verifySignup).not.toHaveBeenCalled();
  });

  it.each([
    {
      route: '/api/auth/verify',
      payload: { challenge_id: 'not-a-uuid', code: '123456' },
      service: 'verifySignup',
    },
    {
      route: '/api/auth/login/verify',
      payload: { challenge_id: challengeId, code: '１２３４５６' },
      service: 'verifyLogin',
    },
    {
      route: '/api/auth/reset-password',
      payload: {
        challenge_id: challengeId,
        code: '123456\u0000',
        newPassword: 'a secure memorable replacement passphrase',
      },
      service: 'resetPassword',
    },
    {
      route: '/api/auth/verify/resend',
      payload: { challenge_id: 'not-a-uuid' },
      service: 'resendVerification',
    },
    {
      route: '/api/auth/login/resend',
      payload: {},
      service: 'resendLogin',
    },
    {
      route: '/api/auth/forgot-password/resend',
      payload: { challenge_id: null },
      service: 'resendRecovery',
    },
  ])(
    'returns the stable invalid-challenge contract for malformed $route input',
    async ({ route, payload, service: serviceMethod }) => {
      const response = await request(app.getHttpServer())
        .post(route)
        .send(payload)
        .expect(400);

      expect(response.body).toMatchObject({
        status_code: 400,
        error_code: 'AUTH_CHALLENGE_INVALID',
        data: null,
      });
      expect(
        service[serviceMethod as keyof typeof service],
      ).not.toHaveBeenCalled();
    },
  );

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

  it('rejects legacy token fields even when challenge proof is present', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        challenge_id: challengeId,
        code: '123456',
        newPassword: 'a secure memorable replacement passphrase',
        token: 'should-be-stripped',
      })
      .expect(400);
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('keeps email recovery generic and resends only by opaque handle', async () => {
    const recovery = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.test' })
      .expect(202);
    const resend = await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ challenge_id: challengeId })
      .expect(200);
    expect(recovery.body.message).toBe(secureMessage);
    expect(recovery.body).toMatchObject({
      status_code: 202,
      data: null,
    });
    expect(resend.body).toMatchObject({
      status_code: 200,
      message: 'Verification code queued',
      data: {
        challenge_id: challengeId,
        resend_after_seconds: 60,
        expires_in_seconds: 600,
      },
    });
    expect(
      JSON.stringify(recovery.body) + JSON.stringify(resend.body),
    ).not.toContain('123456');
    await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ email: 'unknown@example.test' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password/resend')
      .send({ challenge_id: challengeId })
      .expect(200);
    expect(service.resendRecovery).toHaveBeenCalledWith({
      challenge_id: challengeId,
    });
  });

  it('accepts only a UUID and six-digit code at login completion', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login/verify')
      .send({
        challenge_id: challengeId,
        code: '123456',
        email: 'must-not-reach-the-service@example.test',
      })
      .expect(400);
    expect(service.verifyLogin).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/api/auth/login/verify')
      .send({ challenge_id: challengeId, code: '123456' })
      .expect(200);
    expect(service.verifyLogin).toHaveBeenCalledWith({
      challenge_id: challengeId,
      code: '123456',
    });

    for (const payload of [
      {},
      { challenge_id: 'not-a-uuid', code: '123456' },
      { challenge_id: challengeId, code: '12345' },
      { challenge_id: challengeId, code: '１２３４５６' },
      { challenge_id: challengeId, code: '123456\u0000' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/auth/login/verify')
        .send(payload)
        .expect(400);
    }
    expect(service.verifyLogin).toHaveBeenCalledTimes(1);
  });

  it('resends by opaque challenge ID and rejects email-only requests', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: challengeId, email: 'ignored@example.test' })
      .expect(400);
    expect(service.resendLogin).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: challengeId })
      .expect(200);
    expect(service.resendLogin).toHaveBeenCalledWith({
      challenge_id: challengeId,
    });

    await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ email: 'patient@example.test' })
      .expect(400);
    expect(service.resendLogin).toHaveBeenCalledTimes(1);
  });

  it('preserves machine-readable cooldown metadata and Retry-After', async () => {
    service.resendLogin.mockRejectedValueOnce(
      new AuthChallengeException(
        AuthChallengeErrorCode.COOLDOWN,
        HttpStatus.TOO_MANY_REQUESTS,
        42,
      ),
    );
    const response = await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: challengeId })
      .expect(429);
    expect(response.headers['retry-after']).toBe('42');
    expect(response.body).toMatchObject({
      error_code: 'AUTH_CHALLENGE_COOLDOWN',
      retry_after_seconds: 42,
    });
  });
});
