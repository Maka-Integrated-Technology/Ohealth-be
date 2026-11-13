import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { OAuthController } from '../src/modules/auth/oauth/oauth.controller';
import { OAuthService } from '../src/modules/auth/oauth/oauth.service';

describe('Google OAuth HTTP contract', () => {
  let app: INestApplication;
  const oauth = {
    start: jest.fn(),
    startLink: jest.fn(),
    complete: jest.fn(),
    unlink: jest.fn(),
  };

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [OAuthController],
      providers: [{ provide: OAuthService, useValue: oauth }],
    });
    const module = await builder
      .overrideGuard(AuthAbuseGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());

  it('marks only start and completion as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OAuthController.prototype.start),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OAuthController.prototype.complete),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OAuthController.prototype.startLink),
    ).not.toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, OAuthController.prototype.unlink),
    ).not.toBe(true);
  });

  it('starts a transaction with the exact consumer audience and signup bindings', async () => {
    oauth.start.mockResolvedValue({
      transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
      transaction_token: 't'.repeat(43),
      nonce: 'n'.repeat(43),
      audience: 'web-client-id',
      expires_in_seconds: 300,
    });
    await request(app.getHttpServer())
      .post('/api/auth/oauth/google/transactions')
      .send({
        operation: 'signup',
        consumer: 'web',
        audience: 'web-client-id',
        intent: 'patient',
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).not.toHaveProperty('id_token');
        expect(body.nonce).toHaveLength(43);
      });
  });

  it.each([
    [{ operation: 'signin', consumer: 'desktop', audience: 'client' }],
    [
      {
        operation: 'signup',
        consumer: 'web',
        audience: 'client',
        intent: 'admin',
      },
    ],
    [
      {
        operation: 'signin',
        consumer: 'web',
        audience: 'client',
        role: 'ADMIN',
      },
    ],
  ])(
    'rejects malformed or privilege-bearing start payloads',
    async (payload) => {
      await request(app.getHttpServer())
        .post('/api/auth/oauth/google/transactions')
        .send(payload)
        .expect(400);
      expect(oauth.start).not.toHaveBeenCalled();
    },
  );

  it('returns 202 without credentials for third-party contact verification', async () => {
    oauth.complete.mockResolvedValue({
      message: 'Contact verification required.',
      error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
      challenge_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
      resend_after_seconds: 60,
      expires_in_seconds: 600,
    });
    await request(app.getHttpServer())
      .post('/api/auth/oauth/google/complete')
      .send({
        transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
        transaction_token: 't'.repeat(43),
        id_token: 'signed-google-token',
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body.error_code).toBe('OAUTH_CONTACT_VERIFICATION_REQUIRED');
        expect(body).not.toHaveProperty('access_token');
        expect(body).not.toHaveProperty('refresh_token');
      });
  });

  it('accepts only bounded completion proof fields', async () => {
    oauth.complete.mockResolvedValue({ access_token: 'access-token' });
    await request(app.getHttpServer())
      .post('/api/auth/oauth/google/complete')
      .send({
        transaction_id: '17d36477-ae70-4ac6-b557-d584bc840ad1',
        transaction_token: 't'.repeat(43),
        id_token: 'signed-google-token',
      })
      .expect(200);
    expect(oauth.complete).toHaveBeenCalledTimes(1);
  });
});
