import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';

describe('Retired legacy authentication HTTP routes', () => {
  let app: INestApplication;
  const auth = { signup: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(AuthAbuseGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app?.close());

  it.each([
    ['patch', '/api/auth/users/550e8400-e29b-41d4-a716-446655440000/activate'],
    ['post', '/api/auth/google-login'],
    ['post', '/api/pharmacies/register'],
  ] as const)(
    '%s %s is unavailable and cannot mutate state',
    async (method, path) => {
      await request(app.getHttpServer())[method](path).send({}).expect(404);
      expect(auth.signup).not.toHaveBeenCalled();
    },
  );
});
