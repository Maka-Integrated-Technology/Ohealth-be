import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthAbuseGuard } from '../src/modules/auth/challenges/auth-abuse.guard';
import { BrowserSessionConfig } from '../src/modules/auth/browser/browser-session.config';
import { BrowserSessionController } from '../src/modules/auth/browser/browser-session.controller';
import { BrowserSessionCookieService } from '../src/modules/auth/browser/browser-session-cookie.service';
import { BrowserSessionGuard } from '../src/modules/auth/browser/browser-session.guard';
import { BrowserSessionTransportService } from '../src/modules/auth/browser/browser-session-transport.service';

describe('Browser session transport (e2e)', () => {
  let app: INestApplication;
  const origin = 'https://app.ohealth.example';
  const oldCredential = 'a'.repeat(43);
  const newCredential = 'b'.repeat(43);
  const expiresAt = new Date(Date.now() + 60_000);
  const response = {
    message: 'Login success',
    access_token: 'short-lived-access-token',
    session_id: '550e8400-e29b-41d4-a716-446655440000',
    session_expires_at: expiresAt,
    user: {
      id: 'user-id',
      email: 'user@example.test',
      first_name: 'Test',
      last_name: 'User',
      role: ['PATIENT'],
    },
    routing_target: 'patient_home',
    access_level: 'full',
    verification_status: null,
  };
  const transport = {
    verifySignup: jest.fn(),
    verifyLogin: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeAll(async () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      AUTH_BROWSER_SESSION_ENABLED: 'true',
      cors: { origins: [origin] },
    });
    const module = await Test.createTestingModule({
      controllers: [BrowserSessionController],
      providers: [
        BrowserSessionConfig,
        BrowserSessionCookieService,
        BrowserSessionGuard,
        { provide: ConfigService, useValue: config },
        { provide: BrowserSessionTransportService, useValue: transport },
      ],
    })
      .overrideGuard(AuthAbuseGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.enableCors({ origin: [origin], credentials: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    transport.verifyLogin.mockResolvedValue({
      response,
      refreshCredential: oldCredential,
      sessionExpiresAt: expiresAt,
    });
    transport.verifySignup.mockResolvedValue({
      response,
      refreshCredential: oldCredential,
      sessionExpiresAt: expiresAt,
    });
    transport.refresh.mockResolvedValue({
      response,
      refreshCredential: newCredential,
      sessionExpiresAt: expiresAt,
    });
    transport.logout.mockResolvedValue({ message: 'logout success' });
  });

  afterAll(async () => app?.close());

  it('issues the secure cookie without exposing the refresh credential', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/auth/browser/login/verify')
      .set('Origin', origin)
      .set('X-OHealth-Client', 'browser')
      .send({
        challenge_id: '550e8400-e29b-41d4-a716-446655440000',
        code: '123456',
      })
      .expect(200);

    expect(JSON.stringify(result.body)).not.toContain(oldCredential);
    expect(result.body).not.toHaveProperty('refresh_token');
    expect(result.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining(`__Host-ohealth_refresh=${oldCredential}`),
    );
    expect(result.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('Path=/'),
    );
    expect(result.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('HttpOnly'),
    );
    expect(result.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('Secure'),
    );
    expect(result.headers['set-cookie']?.[0]).toEqual(
      expect.stringContaining('SameSite=Strict'),
    );
  });

  it('uses the same browser presentation for contact verification', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/auth/browser/verify')
      .set('Origin', origin)
      .set('X-OHealth-Client', 'browser')
      .send({
        challenge_id: '550e8400-e29b-41d4-a716-446655440000',
        code: '123456',
      })
      .expect(200);

    expect(transport.verifySignup).toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain(oldCredential);
    expect(result.headers['set-cookie']?.[0]).toContain(
      `__Host-ohealth_refresh=${oldCredential}`,
    );
  });

  it('rotates only the approved browser cookie', async () => {
    const result = await browserPost('/api/auth/browser/refresh')
      .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`)
      .expect(200);

    expect(transport.refresh).toHaveBeenCalledWith(oldCredential);
    expect(JSON.stringify(result.body)).not.toContain(newCredential);
    expect(result.headers['set-cookie']?.[0]).toContain(
      `__Host-ohealth_refresh=${newCredential}`,
    );
  });

  it.each([
    '',
    '__Host-ohealth_refresh=short',
    `__Host-ohealth_refresh=${oldCredential}; __Host-ohealth_refresh=${oldCredential}`,
    `refresh_token=${oldCredential}`,
  ])('returns 401 and clears an invalid cookie %#', async (cookie) => {
    const result = await browserPost('/api/auth/browser/refresh')
      .set('Cookie', cookie || 'theme=dark')
      .expect(401);
    expect(result.headers['set-cookie']?.[0]).toContain(
      '__Host-ohealth_refresh=;',
    );
    expect(transport.refresh).not.toHaveBeenCalled();
  });

  it('clears a valid-shaped cookie rejected by canonical rotation', async () => {
    transport.refresh.mockRejectedValueOnce(new UnauthorizedException());
    const result = await browserPost('/api/auth/browser/refresh')
      .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`)
      .expect(401);
    expect(result.headers['set-cookie']?.[0]).toContain(
      '__Host-ohealth_refresh=;',
    );
  });

  it('revokes server-side state before clearing the cookie', async () => {
    const result = await browserPost('/api/auth/browser/logout')
      .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`)
      .expect(200);
    expect(transport.logout).toHaveBeenCalledWith(oldCredential);
    expect(result.headers['set-cookie']?.[0]).toContain(
      '__Host-ohealth_refresh=;',
    );
  });

  it.each([undefined, 'null', '*', 'https://app.ohealth.example.evil.test'])(
    'rejects origin %s',
    async (candidate) => {
      let call = request(app.getHttpServer())
        .post('/api/auth/browser/refresh')
        .set('X-OHealth-Client', 'browser')
        .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`);
      if (candidate !== undefined) call = call.set('Origin', candidate);
      await call.expect(403);
    },
  );

  it.each([undefined, 'mobile', 'Browser'])(
    'rejects browser client header %s',
    async (candidate) => {
      let call = request(app.getHttpServer())
        .post('/api/auth/browser/refresh')
        .set('Origin', origin)
        .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`);
      if (candidate !== undefined) {
        call = call.set('X-OHealth-Client', candidate);
      }
      await call.expect(403);
    },
  );

  it.each([
    (call: request.Test) => call.send({ refresh_token: oldCredential }),
    (call: request.Test) => call.query({ refresh_token: oldCredential }),
    (call: request.Test) =>
      call.set('Authorization', `Bearer ${oldCredential}`),
  ])('rejects non-cookie credential transport', async (mutate) => {
    const call = mutate(
      browserPost('/api/auth/browser/refresh').set(
        'Cookie',
        `__Host-ohealth_refresh=${oldCredential}`,
      ),
    );
    await call.expect(400);
    expect(transport.refresh).not.toHaveBeenCalled();
  });

  it('rejects non-JSON browser request bodies', async () => {
    await browserPost('/api/auth/browser/refresh')
      .set('Cookie', `__Host-ohealth_refresh=${oldCredential}`)
      .set('Content-Type', 'text/plain')
      .send('{}')
      .expect(415);
    expect(transport.refresh).not.toHaveBeenCalled();
  });

  it('permits a valid CORS preflight and varies by origin', async () => {
    const result = await request(app.getHttpServer())
      .options('/api/auth/browser/refresh')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-ohealth-client')
      .expect(204);
    expect(result.headers['access-control-allow-origin']).toBe(origin);
    expect(result.headers.vary).toContain('Origin');
  });

  function browserPost(path: string): request.Test {
    return request(app.getHttpServer())
      .post(path)
      .set('Origin', origin)
      .set('X-OHealth-Client', 'browser');
  }
});
