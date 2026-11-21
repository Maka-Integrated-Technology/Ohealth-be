import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { ProfilePhotoController } from '../src/modules/auth/profile-photo/profile-photo.controller';
import { ProfilePhotoService } from '../src/modules/auth/profile-photo/profile-photo.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';

describe('profile photo HTTP boundary', () => {
  let app: INestApplication;
  const upload = jest.fn();
  const signedGet = jest.fn();
  const remove = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProfilePhotoController],
      providers: [
        {
          provide: ProfilePhotoService,
          useValue: { upload, signedGet, remove },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = {
            userId: 'owner',
            sessionId: 'session',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => {
    upload.mockReset().mockResolvedValue({
      width: 1,
      height: 1,
      byte_size: 100,
      content_type: 'image/jpeg',
      updated_at: new Date(),
      cleanup_pending: false,
    });
    signedGet.mockReset().mockResolvedValue({
      url: 'signed-url-placeholder',
      expires_in_seconds: 300,
    });
    remove.mockReset().mockResolvedValue({ cleanup_status: 'pending' });
  });

  it('uses only authenticated owner context and rejects client ownership fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/me/profile-photo')
      .attach('file', Buffer.from('fake'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(200);
    expect(upload).toHaveBeenCalledWith(
      'owner',
      'session',
      expect.objectContaining({
        originalname: 'photo.png',
        mimetype: 'image/png',
      }),
    );
    await request(app.getHttpServer())
      .post('/api/auth/me/profile-photo')
      .field('user_id', 'other')
      .attach('file', Buffer.from('fake'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/me/profile-photo')
      .attach('file', Buffer.from('<svg/>'), {
        filename: 'photo.svg',
        contentType: 'image/svg+xml',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/me/profile-photo')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('returns no-store signed retrieval and honest pending removal', async () => {
    const signed = await request(app.getHttpServer())
      .get('/api/auth/me/profile-photo')
      .expect(200);
    expect(signed.headers['cache-control']).toBe('no-store');
    expect(signed.body).toEqual({
      url: 'signed-url-placeholder',
      expires_in_seconds: 300,
    });
    const removed = await request(app.getHttpServer())
      .delete('/api/auth/me/profile-photo')
      .expect(202);
    expect(removed.body).toEqual({ cleanup_status: 'pending' });
    expect(remove).toHaveBeenCalledWith('owner', 'session');
  });
});
