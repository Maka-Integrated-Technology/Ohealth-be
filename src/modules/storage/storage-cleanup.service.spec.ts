/* eslint-disable @typescript-eslint/naming-convention -- S3 fields and config keys use external names. */
import {
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { OutboxEvent } from '../platform-events/entities/outbox-event.entity';
import { OutboxEventStatus } from '../platform-events/enums/outbox-event-status.enum';

import { StorageCleanupService } from './storage-cleanup.service';
import { StorageService } from './storage.service';

describe('StorageCleanupService', () => {
  it('retains the reference after partial B2 deletion and retries every version and marker', async () => {
    const records = new Map<string, OutboxEvent>();
    let nextId = 0;
    const manager = {
      create: (_entity: typeof OutboxEvent, value: Partial<OutboxEvent>) =>
        value,
      save: async (value: OutboxEvent) => {
        const saved = structuredClone(value);
        saved.id ??= `cleanup-${++nextId}`;
        saved.attempts ??= 0;
        records.set(saved.id, saved);
        return saved;
      },
      findOne: async (
        _entity: typeof OutboxEvent,
        options: { where: { id: string } },
      ) => {
        const record = records.get(options.where.id);
        return record ? structuredClone(record) : null;
      },
    };
    const dataSource = {
      transaction: async (
        callback: (value: typeof manager) => Promise<unknown>,
      ) => {
        const before = new Map(
          [...records].map(([id, value]) => [id, structuredClone(value)]),
        );
        try {
          return await callback(manager);
        } catch (error) {
          records.clear();
          before.forEach((value, id) => records.set(id, value));
          throw error;
        }
      },
      getRepository: () => ({
        find: async () =>
          [...records.values()].filter(
            (record) => record.status === OutboxEventStatus.PENDING,
          ),
      }),
    } as unknown as DataSource;
    const versions = new Set(['data-1', 'data-2']);
    const markers = new Set(['marker-1']);
    let failOnce = true;
    const client = {
      send: jest.fn(
        async (command: DeleteObjectCommand | ListObjectVersionsCommand) => {
          if (command instanceof ListObjectVersionsCommand) {
            return {
              Versions: [...versions].map((VersionId) => ({
                Key: 'old-key',
                VersionId,
              })),
              DeleteMarkers: [...markers].map((VersionId) => ({
                Key: 'old-key',
                VersionId,
              })),
              IsTruncated: false,
            };
          }
          const versionId = command.input.VersionId!;
          if (failOnce && versionId === 'data-2') {
            failOnce = false;
            throw new Error('B2 temporarily unavailable');
          }
          versions.delete(versionId);
          markers.delete(versionId);
          return {};
        },
      ),
    } as unknown as S3Client;
    const config = {
      get: (name: string) =>
        ({
          'storage.endpoint': 'https://s3.example.test',
          'storage.region': 'eu-central-003',
          'storage.accessKeyId': 'test-key',
          'storage.secretAccessKey': 'test-secret',
          'storage.privateBucket': 'private-bucket',
          'storage.signedUrlTtlSeconds': 300,
          'storage.forcePathStyle': 'false',
        })[name],
    } as ConfigService;
    const cleanup = new StorageCleanupService(
      dataSource,
      new StorageService(client, config),
    );
    const id = (await dataSource.transaction((transaction) =>
      cleanup.enqueue(
        transaction as EntityManager,
        'private-bucket',
        'old-key',
      ),
    )) as string;

    await expect(cleanup.process(id)).rejects.toThrow(
      'B2 temporarily unavailable',
    );
    expect(records.get(id)).toMatchObject({
      status: OutboxEventStatus.PENDING,
      payload: { bucket: 'private-bucket', key: 'old-key' },
    });
    expect(versions).toEqual(new Set(['data-2']));
    expect(markers).toEqual(new Set(['marker-1']));

    expect(await cleanup.processPending()).toEqual({ completed: 1, failed: 0 });
    expect(versions.size).toBe(0);
    expect(markers.size).toBe(0);
    expect(records.get(id)?.status).toBe(OutboxEventStatus.PUBLISHED);
    await cleanup.process(id);
    expect(records.get(id)?.status).toBe(OutboxEventStatus.PUBLISHED);
  });
});
