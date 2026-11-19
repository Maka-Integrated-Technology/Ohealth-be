import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { AuthChallengeValidationPipe } from '../src/modules/auth/challenges/auth-challenge-validation.pipe';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('Patient profile HTTP body boundary', () => {
  let app: INestApplication;
  const updateProfile = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { updateProfile } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
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
    updateProfile.mockReset().mockResolvedValue({ ok: true });
  });

  it('accepts supported fields and rejects protected and unknown fields', async () => {
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .send({ first_name: ' Ada ', address: ' Lagos ' })
      .expect(200);
    expect(updateProfile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ first_name: ' Ada ', address: ' Lagos ' }),
    );

    for (const field of [
      'email',
      'phone',
      'password',
      'image',
      'medical_conditions',
      'account_status',
      'role',
      'persona',
      'user_id',
      'unknown',
    ]) {
      await request(app.getHttpServer())
        .patch('/api/auth/me')
        .send({ [field]: 'forbidden' })
        .expect(400);
    }
    expect(updateProfile).toHaveBeenCalledTimes(1);
  });
});
