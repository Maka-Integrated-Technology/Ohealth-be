import { createRequire } from 'node:module';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { IMulterFile } from '../../../common/types';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../platform-events/enums/outbox-event-status.enum';
import { StorageCleanupService } from '../../storage/storage-cleanup.service';
import { StorageService } from '../../storage/storage.service';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthContextService } from '../context/auth-context.service';

import { ProfilePhoto } from './profile-photo.entity';
import { ProfilePhotoService } from './profile-photo.service';

import type sharpModule from 'sharp';

const sharp: typeof sharpModule = createRequire(__filename)('sharp');

describe('shared profile photo lifecycle', () => {
  const userId = 'owner';
  const sessionId = 'session';
  let photo: ProfilePhoto | null;
  let events: Map<string, OutboxEvent>;
  let persona: UserPersonaType | null;
  let active: boolean;
  let failCleanup: boolean;
  let service: ProfilePhotoService;
  let storage: {
    uploadPrivateObject: jest.Mock;
    createSignedGetUrl: jest.Mock;
  };

  beforeEach(() => {
    photo = null;
    events = new Map();
    persona = UserPersonaType.PATIENT;
    active = true;
    failCleanup = false;
    const manager = {
      findOne: jest.fn(
        async (entity: unknown, options: { where: { id?: string } }) => {
          if (entity === ProfilePhoto) return photo;
          if (entity === OutboxEvent)
            return events.get(options.where.id) ?? null;
          if (String(entity).includes('UserPersona'))
            return persona ? { persona_type: persona } : null;
          if (String(entity).includes('AuthSession'))
            return { expires_at: new Date(Date.now() + 60_000) };
          return {
            account_status: active ? 'active' : 'suspended',
            email_verified_at: new Date(),
          };
        },
      ),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity: unknown, value?: unknown) => {
        const item = (value ?? entity) as ProfilePhoto | OutboxEvent;
        if (entity === ProfilePhoto) {
          photo = { ...item, updated_at: new Date() } as ProfilePhoto;
          return photo;
        }
        if (entity === OutboxEvent) {
          events.set((item as OutboxEvent).id, item as OutboxEvent);
          return item;
        }
        events.set((item as OutboxEvent).id, item as OutboxEvent);
        return item;
      }),
      remove: jest.fn(async () => {
        photo = null;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
      getRepository: jest.fn(() => ({
        update: jest.fn(async (_where, changes) => {
          const pending = [...events.values()].find(
            (event) => event.status === OutboxEventStatus.PENDING,
          );
          if (pending) Object.assign(pending, changes);
        }),
      })),
    } as unknown as DataSource;
    const context = {
      resolve: jest.fn(async () => ({
        personas: persona ? [{ type: persona }] : [],
      })),
    } as unknown as AuthContextService;
    const policy = new AccountAccessPolicyService();
    storage = {
      uploadPrivateObject: jest.fn(async ({ key }) => ({
        bucket: 'private',
        key,
        versionId: 'v1',
      })),
      createSignedGetUrl: jest.fn(async () => 'signed-url-placeholder'),
    };
    let nextId = 0;
    const cleanup = {
      enqueue: jest.fn(async (_manager, bucket, key, availableAt) => {
        const id = `event-${++nextId}`;
        events.set(id, {
          id,
          payload: { bucket, key },
          event_type: 'private_object_delete',
          status: OutboxEventStatus.PENDING,
          available_at: availableAt ?? new Date(),
        } as unknown as OutboxEvent);
        return id;
      }),
      process: jest.fn(async (id) => {
        if (failCleanup) throw new Error('provider unavailable');
        events.get(id).status = OutboxEventStatus.PUBLISHED;
      }),
    } as unknown as StorageCleanupService;
    service = new ProfilePhotoService(
      dataSource,
      context,
      policy,
      storage as unknown as StorageService,
      cleanup,
      { get: () => 'private' } as unknown as ConfigService,
    );
  });

  async function image(): Promise<IMulterFile> {
    const buffer = await sharp({
      create: { width: 2, height: 3, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    return {
      fieldname: 'file',
      originalname: 'secret-name.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: buffer.length,
      buffer,
    };
  }

  it.each([UserPersonaType.PATIENT, UserPersonaType.HEALTHCARE_PROFESSIONAL])(
    'uploads, signs, replaces and removes for %s',
    async (type) => {
      persona = type;
      const input = await image();
      const first = await service.upload(userId, sessionId, input);
      expect(first).toMatchObject({
        width: 2,
        height: 3,
        cleanup_pending: false,
      });
      expect(photo.object_key).toMatch(/^profile-photos\/[0-9a-f-]{36}$/);
      expect(photo.object_key).not.toContain(userId);
      expect(JSON.stringify(first)).not.toContain('private');
      await service.signedGet(userId, sessionId);
      expect(storage.createSignedGetUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          versionId: 'v1',
          expiresInSeconds: 300,
        }),
      );
      const oldKey = photo.object_key;
      failCleanup = true;
      expect(await service.upload(userId, sessionId, input)).toMatchObject({
        cleanup_pending: true,
      });
      expect(photo.object_key).not.toBe(oldKey);
      expect([...events.values()]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: { bucket: 'private', key: oldKey },
            status: OutboxEventStatus.PENDING,
          }),
        ]),
      );
      expect(await service.remove(userId, sessionId)).toEqual({
        cleanup_status: 'pending',
      });
      await expect(service.signedGet(userId, sessionId)).rejects.toThrow(
        NotFoundException,
      );
    },
  );

  it('denies an organization-only or suspended account before storage access', async () => {
    persona = null;
    await expect(
      service.upload(userId, sessionId, await image()),
    ).rejects.toThrow(ForbiddenException);
    expect(storage.uploadPrivateObject).not.toHaveBeenCalled();
    persona = UserPersonaType.PATIENT;
    active = false;
    await expect(
      service.upload(userId, sessionId, await image()),
    ).rejects.toThrow();
  });

  it('reserves a key and hides provider errors when upload lacks version evidence', async () => {
    storage.uploadPrivateObject.mockResolvedValueOnce({
      bucket: 'private',
      key: 'opaque',
      versionId: undefined,
    });
    await expect(
      service.upload(userId, sessionId, await image()),
    ).rejects.toThrow('Profile photo upload failed.');
    expect(photo).toBeNull();
    expect([...events.values()]).toHaveLength(1);
    expect([...events.values()][0].status).toBe(OutboxEventStatus.PENDING);
  });
});
