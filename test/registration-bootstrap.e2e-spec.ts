import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthRateLimitService } from '../src/modules/auth/challenges/auth-rate-limit.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { SignupIntent } from '../src/modules/auth/enums/signup-intent.enum';

/** Isolated HTTP contract test: never accesses accounts, sessions, or external services. */
describe('Registration bootstrap public HTTP contract (#136)', () => {
  let app: INestApplication;
  const metadata = {
    intents: [
      { intent: SignupIntent.PATIENT, label: 'Patient' },
      {
        intent: SignupIntent.HEALTHCARE_PROFESSIONAL,
        label: 'Healthcare Professional',
      },
      { intent: SignupIntent.PHARMACY, label: 'Pharmacy' },
      { intent: SignupIntent.LABORATORY, label: 'Laboratory' },
      { intent: SignupIntent.HOSPITAL, label: 'Hospital' },
    ],
    terms: { document_type: 'terms_of_service', version: 'terms-v1' },
    privacy: { document_type: 'privacy_policy', version: 'privacy-v1' },
  };
  const authService = {
    getRegistrationBootstrap: jest.fn().mockReturnValue(metadata),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuthRateLimitService, useValue: { consume: jest.fn() } },
        { provide: AuthAbuseGuard, useValue: { canActivate: () => true } },
        { provide: JwtAuthGuard, useValue: { canActivate: () => false } },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app?.close());

  it('returns public canonical metadata and prevents cache reuse', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/auth/registration/bootstrap')
      .expect(200);
    expect(result.body).toEqual({
      status_code: 200,
      message: null,
      data: metadata,
    });
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.body.data).not.toHaveProperty('roles');
    expect(result.body.data).not.toHaveProperty('account_status');
    expect(result.body.data).not.toHaveProperty('idempotencyPepper');
    expect(authService.getRegistrationBootstrap).toHaveBeenCalled();
  });
});
