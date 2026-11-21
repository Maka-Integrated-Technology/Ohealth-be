import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { env } from 'node:process';

import {
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthContextService } from '../../modules/auth/context/auth-context.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ProfilePhotoController } from '../../modules/auth/profile-photo/profile-photo.controller';
import { ProfilePhoto } from '../../modules/auth/profile-photo/profile-photo.entity';
import { ProfilePhotoService } from '../../modules/auth/profile-photo/profile-photo.service';
import { RefreshSessionService } from '../../modules/auth/sessions/refresh-session.service';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import { OutboxEvent } from '../../modules/platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../modules/platform-events/enums/outbox-event-status.enum';
import { StorageCleanupService } from '../../modules/storage/storage-cleanup.service';
import { StorageService } from '../../modules/storage/storage.service';
import { ProfilePhotos1795300000000 } from '../migrations/1795300000000-ProfilePhotos';

import type sharpModule from 'sharp';

const sharp: typeof sharpModule = createRequire(__filename)('sharp');

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('profile photo lifecycle on PostgreSQL', () => {
  let admin: DataSource;
  let database: DataSource;
  let schema: string;
  let userId: string;
  let sessionId: string;
  let service: ProfilePhotoService;
  let app: INestApplication;
  let providerFailed: boolean;
  let storage: {
    uploadPrivateObject: jest.Mock;
    createSignedGetUrl: jest.Mock;
    deleteObject: jest.Mock;
  };
  let cleanup: StorageCleanupService;

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = `profile_photo_${randomUUID().replaceAll('-', '')}`;
    userId = randomUUID();
    sessionId = randomUUID();
    providerFailed = false;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`CREATE TABLE "${schema}".users (
      id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      email varchar NOT NULL, password varchar NOT NULL, first_name varchar NOT NULL, last_name varchar NOT NULL,
      middle_name varchar, gender varchar, dob date, phone varchar, country varchar, image varchar,
      role text NOT NULL DEFAULT 'PATIENT', is_active boolean NOT NULL DEFAULT true,
      is_verified boolean NOT NULL DEFAULT true, account_status varchar NOT NULL DEFAULT 'active',
      email_verified_at timestamptz, verification_code varchar, verification_code_expires_at timestamptz,
      password_authentication_enabled boolean NOT NULL DEFAULT true, google_id varchar,
      reset_token varchar, reset_token_expiry timestamptz
    )`);
    await admin.query(`CREATE TABLE "${schema}".user_personas (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), user_id uuid NOT NULL REFERENCES "${schema}".users(id),
      persona_type varchar NOT NULL, is_active boolean NOT NULL DEFAULT true
    )`);
    await admin.query(`CREATE TABLE "${schema}".auth_sessions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), session_id varchar NOT NULL, user_id uuid NOT NULL REFERENCES "${schema}".users(id),
      refresh_token_hash varchar NOT NULL, credential_version smallint NOT NULL DEFAULT 1,
      last_used_at timestamptz, expires_at timestamptz NOT NULL, revoked_at timestamptz
    )`);
    await admin.query(`CREATE TABLE "${schema}".outbox_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), aggregate_type varchar NOT NULL, aggregate_id uuid,
      event_type varchar NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      status varchar NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
      available_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, last_error text
    )`);
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      schema,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
    });
    await database.initialize();
    const runner = database.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`SET search_path TO "${schema}", public`);
      await new ProfilePhotos1795300000000().up(runner);
    } finally {
      await runner.release();
    }
    await database.query(
      `INSERT INTO "${schema}".users
      (id, email, password, first_name, last_name, image, email_verified_at)
      VALUES ($1, 'owner@example.test', 'hash', 'Ada', 'Okafor', 'legacy-image-value', now())`,
      [userId],
    );
    await database.query(
      `INSERT INTO "${schema}".user_personas (user_id, persona_type)
      VALUES ($1, 'patient')`,
      [userId],
    );
    await database.query(
      `INSERT INTO "${schema}".auth_sessions
      (session_id, user_id, refresh_token_hash, expires_at) VALUES ($1, $2, 'hash', now() + interval '1 hour')`,
      [sessionId, userId],
    );
    storage = {
      uploadPrivateObject: jest.fn(async ({ key }) => ({
        bucket: 'private',
        key,
        versionId: randomUUID(),
      })),
      createSignedGetUrl: jest.fn(async () => 'signed-url-placeholder'),
      deleteObject: jest.fn(async () => {
        if (providerFailed) throw new Error('provider unavailable');
      }),
    };
    cleanup = new StorageCleanupService(
      database,
      storage as unknown as StorageService,
    );
    const context = {
      resolve: jest.fn(async (actorId: string, actorSessionId: string) => {
        const rows = await database.query(
          `SELECT u.account_status, u.email_verified_at,
          s.expires_at, s.revoked_at FROM "${schema}".users u
          JOIN "${schema}".auth_sessions s ON s.user_id=u.id
          WHERE u.id=$1 AND s.session_id=$2`,
          [actorId, actorSessionId],
        );
        if (
          !rows.length ||
          rows[0].account_status !== 'active' ||
          !rows[0].email_verified_at ||
          rows[0].revoked_at ||
          rows[0].expires_at <= new Date()
        )
          throw new ForbiddenException();
        const personas = await database.query(
          `SELECT persona_type AS type FROM "${schema}".user_personas
          WHERE user_id=$1 AND is_active=true`,
          [actorId],
        );
        return { personas };
      }),
    } as unknown as AuthContextService;
    service = new ProfilePhotoService(
      database,
      context,
      new AccountAccessPolicyService(),
      storage as unknown as StorageService,
      cleanup,
      { get: () => 'private' } as unknown as ConfigService,
    );
    const config = {
      get: (key: string) => {
        if (key === 'JWT_SECRET')
          return 'test-only-profile-photo-jwt-secret-value';
        if (key === 'TOKEN_ACCESS_DURATION') return '15m';
        if (key === 'TOKEN_REFRESH_DURATION') return '1d';
        if (key === 'storage.privateBucket') return 'private';
        return undefined;
      },
    } as ConfigService;
    const sessions = {
      validate: async (actorId: string, actorSessionId: string) => {
        try {
          await context.resolve(actorId, actorSessionId);
        } catch {
          throw new UnauthorizedException();
        }
        return { id: actorId, email: 'owner@example.test' };
      },
    } as RefreshSessionService;
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ProfilePhotoController],
      providers: [
        ProfilePhotoService,
        StorageCleanupService,
        JwtStrategy,
        JwtAuthGuard,
        AccountAccessPolicyService,
        { provide: DataSource, useValue: database },
        { provide: AuthContextService, useValue: context },
        { provide: StorageService, useValue: storage },
        { provide: ConfigService, useValue: config },
        { provide: RefreshSessionService, useValue: sessions },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (schema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });
  afterAll(async () => {
    if (admin?.isInitialized) await admin.destroy();
  });

  async function image() {
    const buffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    return {
      fieldname: 'file',
      originalname: 'ignored.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: buffer.length,
      buffer,
    };
  }

  it('migrates legacy image data without adopting it and commits replacement cleanup', async () => {
    await expect(service.signedGet(userId, sessionId)).rejects.toThrow(
      'Profile photo not found',
    );
    await service.upload(userId, sessionId, await image());
    const first = await database
      .getRepository(ProfilePhoto)
      .findOneByOrFail({ user_id: userId });
    providerFailed = true;
    const result = await service.upload(userId, sessionId, await image());
    expect(result.cleanup_pending).toBe(true);
    const second = await database
      .getRepository(ProfilePhoto)
      .findOneByOrFail({ user_id: userId });
    expect(second.object_key).not.toBe(first.object_key);
    expect(
      await database.getRepository(OutboxEvent).findOne({
        where: {
          event_type: 'private_object_delete',
          status: OutboxEventStatus.PENDING,
          payload: { bucket: 'private', key: first.object_key },
        },
      }),
    ).not.toBeNull();
    expect(
      (
        await database.query(
          `SELECT image FROM "${schema}".users WHERE id=$1`,
          [userId],
        )
      )[0].image,
    ).toBe('legacy-image-value');
    expect(await service.remove(userId, sessionId)).toEqual({
      cleanup_status: 'pending',
    });
    expect(await database.getRepository(ProfilePhoto).count()).toBe(0);
  });

  it('serializes concurrent replacements and retains cleanup for every old object', async () => {
    const input = await image();
    await Promise.all([
      service.upload(userId, sessionId, input),
      service.upload(userId, sessionId, input),
    ]);
    expect(await database.getRepository(ProfilePhoto).count()).toBe(1);
    const events = await database.getRepository(OutboxEvent).find();
    expect(
      events.filter((event) => event.event_type === 'private_object_delete'),
    ).toHaveLength(3);
    expect(events.filter((event) => event.payload['key'])).toHaveLength(0);
  });

  it('retains cleanup ownership when the reservation is probed before a late PUT completes', async () => {
    let uploadStarted!: () => void;
    let finishUpload!: () => void;
    const started = new Promise<void>((resolve) => {
      uploadStarted = resolve;
    });
    storage.uploadPrivateObject.mockImplementationOnce(
      ({ key }: { key: string }) =>
        new Promise((resolve) => {
          finishUpload = () =>
            resolve({ bucket: 'private', key, versionId: randomUUID() });
          uploadStarted();
        }),
    );
    const pendingUpload = service.upload(userId, sessionId, await image());
    await started;
    const reservation = await database
      .getRepository(OutboxEvent)
      .findOneByOrFail({
        event_type: 'private_object_delete',
      });
    await database.getRepository(OutboxEvent).update(reservation.id, {
      available_at: new Date(0),
    });
    expect(await cleanup.processPending()).toEqual({ completed: 0, failed: 0 });
    const afterProbe = await database
      .getRepository(OutboxEvent)
      .findOneByOrFail({
        id: reservation.id,
      });
    expect(afterProbe).toMatchObject({
      status: OutboxEventStatus.PENDING,
      attempts: 1,
      payload: {
        bucket: 'private',
        key: reservation.payload['key'],
        reservation: true,
      },
    });
    finishUpload();
    await expect(pendingUpload).rejects.toThrow(
      'Profile photo upload expired.',
    );
    expect(await database.getRepository(ProfilePhoto).count()).toBe(0);
    const afterLatePut = await database
      .getRepository(OutboxEvent)
      .findOneByOrFail({
        id: reservation.id,
      });
    expect(afterLatePut.status).toBe(OutboxEventStatus.PENDING);
    expect(afterLatePut.payload['key']).toBe(reservation.payload['key']);
    expect(storage.deleteObject).toHaveBeenCalledWith({
      bucket: 'private',
      key: reservation.payload['key'],
    });
  });

  it('runs the real JWT HTTP lifecycle for patient and professional personas without onboarding', async () => {
    const token = new JwtService().sign(
      { sub: userId, sid: sessionId, jti: randomUUID() },
      { secret: 'test-only-profile-photo-jwt-secret-value', expiresIn: '5m' },
    );
    const auth = `Bearer ${token}`;
    const input = await image();
    const upload = () =>
      request(app.getHttpServer())
        .post('/api/auth/me/profile-photo')
        .set('Authorization', auth)
        .attach('file', input.buffer, {
          filename: 'photo.png',
          contentType: 'image/png',
        });
    await upload().expect(200);
    await request(app.getHttpServer())
      .get('/api/auth/me/profile-photo')
      .set('Authorization', auth)
      .expect('Cache-Control', 'no-store')
      .expect(200);
    await database.query(
      `UPDATE "${schema}".user_personas SET persona_type='healthcare_professional' WHERE user_id=$1`,
      [userId],
    );
    await upload().expect(200);
    await request(app.getHttpServer())
      .delete('/api/auth/me/profile-photo')
      .set('Authorization', auth)
      .expect(202);
    await request(app.getHttpServer())
      .get('/api/auth/me/profile-photo')
      .set('Authorization', auth)
      .expect(404);
    await database.query(
      `UPDATE "${schema}".user_personas SET is_active=false WHERE user_id=$1`,
      [userId],
    );
    await upload().expect(403);
    await database.query(
      `UPDATE "${schema}".user_personas SET is_active=true WHERE user_id=$1`,
      [userId],
    );
    await database.query(
      `UPDATE "${schema}".users SET account_status='suspended' WHERE id=$1`,
      [userId],
    );
    await upload().expect(401);
    expect(await database.getRepository(ProfilePhoto).count()).toBe(0);
  });
});
