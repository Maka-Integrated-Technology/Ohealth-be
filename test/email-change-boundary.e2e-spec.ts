import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthChallengeValidationPipe } from '../src/modules/auth/challenges/auth-challenge-validation.pipe';
import { EmailChangeController } from '../src/modules/auth/email-change/email-change.controller';
import { EmailChangeService } from '../src/modules/auth/email-change/email-change.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('email change HTTP boundary', () => {
  let app: INestApplication;
  let persona: 'patient' | 'healthcare_professional';
  const begin = jest.fn();
  const resend = jest.fn();
  const confirm = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EmailChangeController],
      providers: [
        { provide: EmailChangeService, useValue: { begin, resend, confirm } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = {
            userId: persona === 'patient' ? 'patient-id' : 'professional-id',
            sessionId: 'current-session',
          };
          return true;
        },
      })
      .overrideGuard(AuthAbuseGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new AuthChallengeValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    persona = 'patient';
    begin.mockReset().mockResolvedValue({
      challenge_id: 'a6062694-b190-4e50-aede-e570c5576fe7',
      expires_in_seconds: 600,
      resend_after_seconds: 60,
    });
    resend.mockReset().mockResolvedValue({
      challenge_id: 'a6062694-b190-4e50-aede-e570c5576fe7',
      expires_in_seconds: 600,
      resend_after_seconds: 60,
    });
    confirm.mockReset().mockResolvedValue({ sessions_revoked: true });
  });

  for (const kind of ['patient', 'healthcare_professional'] as const) {
    it(`uses authenticated ${kind} context without accepting identity claims`, async () => {
      persona = kind;
      const result = await request(app.getHttpServer())
        .post('/api/auth/me/email-change/request')
        .send({
          candidate_email: 'New@Example.Test',
          current_password: 'current-secret',
        })
        .expect(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(begin).toHaveBeenCalledWith(
        kind === 'patient' ? 'patient-id' : 'professional-id',
        'current-session',
        expect.objectContaining({ candidate_email: 'New@Example.Test' }),
      );
      await request(app.getHttpServer())
        .post('/api/auth/me/email-change/request')
        .send({
          candidate_email: 'New@Example.Test',
          current_password: 'current-secret',
          user_id: 'other',
        })
        .expect(400);
      expect(begin).toHaveBeenCalledTimes(1);
      await request(app.getHttpServer())
        .post('/api/auth/me/email-change/confirm')
        .send({ challenge_id: result.body.challenge_id, code: '123456' })
        .expect(200, { sessions_revoked: true });
      expect(confirm).toHaveBeenCalledWith(
        kind === 'patient' ? 'patient-id' : 'professional-id',
        'current-session',
        result.body.challenge_id,
        '123456',
      );
    });
  }

  it('keeps malformed proof inside the machine-readable challenge contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/me/email-change/confirm')
      .send({ challenge_id: 'bad', code: 'secret' })
      .expect(400);
    expect(response.body.error_code).toBe('AUTH_CHALLENGE_INVALID');
    expect(confirm).not.toHaveBeenCalled();
  });
});
