/* eslint-disable jest/no-conditional-expect -- Command fakes assert protocol inputs in each command branch. */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';

import { AuthSecurityRetentionService } from './auth-security-retention.service';

type StorageInternals = {
  putAndVerify(
    key: string,
    body: Buffer,
    retainUntil: Date,
  ): Promise<{ versionId: string }>;
  deleteEveryVersion(key: string): Promise<void>;
};

function harness(send: jest.Mock): StorageInternals {
  return new AuthSecurityRetentionService(
    {} as DataSource,
    { send } as unknown as S3Client,
    { bucket: 'private-audit' },
  ) as unknown as StorageInternals;
}

const retainUntil = new Date('2028-11-20T00:00:01.000Z');
const body = Buffer.from('{"safe":true}');

function protectedObject(command: HeadObjectCommand) {
  return {
    VersionId: command.input.VersionId,
    LastModified: new Date('2026-11-20T00:00:00.000Z'),
    ServerSideEncryption: 'AES256',
    ContentLength: body.length,
  };
}

function protectedRetention(command: GetObjectRetentionCommand) {
  expect(command.input.VersionId).toBe('v1');
  return { Retention: { Mode: 'COMPLIANCE', RetainUntilDate: retainUntil } };
}

describe('audit archive version safety', () => {
  it('recovers a committed upload with a lost acknowledgement without writing again', async () => {
    let uploaded = false;
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        return {
          IsTruncated: false,
          Versions: uploaded
            ? [{ Key: command.input.Prefix, VersionId: 'v1' }]
            : [],
        };
      }
      if (command instanceof PutObjectCommand) {
        expect(command.input).toMatchObject({
          ServerSideEncryption: 'AES256',
          ObjectLockMode: 'COMPLIANCE',
          ObjectLockRetainUntilDate: retainUntil,
        });
        expect(command.input.SSEKMSKeyId).toBeUndefined();
        uploaded = true;
        throw new Error('acknowledgement lost');
      }
      if (command instanceof HeadObjectCommand) return protectedObject(command);
      if (command instanceof GetObjectRetentionCommand)
        return protectedRetention(command);
      if (command instanceof GetObjectCommand)
        return { Body: { transformToByteArray: async () => body } };
      throw new Error('unexpected command');
    });
    const service = harness(send);
    await expect(
      service.putAndVerify('archive/a', body, retainUntil),
    ).resolves.toMatchObject({ versionId: 'v1' });
    await expect(
      service.putAndVerify('archive/a', body, retainUntil),
    ).resolves.toMatchObject({ versionId: 'v1' });
    expect(
      send.mock.calls.filter(
        ([command]) => command instanceof PutObjectCommand,
      ),
    ).toHaveLength(1);
    expect(
      send.mock.calls
        .filter(([command]) => command instanceof HeadObjectCommand)
        .every(
          ([command]) =>
            (command as HeadObjectCommand).input.VersionId === 'v1',
        ),
    ).toBe(true);
    expect(
      send.mock.calls.filter(
        ([command]) => command instanceof GetObjectRetentionCommand,
      ),
    ).toHaveLength(2);
  });

  it('rejects mismatched readback and extra versions', async () => {
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand)
        return {
          IsTruncated: false,
          Versions: [{ Key: command.input.Prefix, VersionId: 'v1' }],
        };
      if (command instanceof HeadObjectCommand) return protectedObject(command);
      if (command instanceof GetObjectRetentionCommand)
        return protectedRetention(command);
      if (command instanceof GetObjectCommand)
        return {
          Body: { transformToByteArray: async () => Buffer.from('wrong') },
        };
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).putAndVerify('archive/a', body, retainUntil),
    ).rejects.toThrow('checksum mismatch');
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand)
        return {
          IsTruncated: false,
          Versions: [
            { Key: command.input.Prefix, VersionId: 'v1' },
            { Key: command.input.Prefix, VersionId: 'v2' },
          ],
        };
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).putAndVerify('archive/a', body, retainUntil),
    ).rejects.toThrow('conflicting versions');
  });

  it.each([
    ['encryption', { ServerSideEncryption: undefined }],
    ['length', { ContentLength: body.length - 1 }],
    ['version', { VersionId: 'different' }],
  ])('rejects missing or wrong %s evidence', async (_field, override) => {
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        return {
          IsTruncated: false,
          Versions: [{ Key: command.input.Prefix, VersionId: 'v1' }],
        };
      }
      if (command instanceof HeadObjectCommand) {
        return { ...protectedObject(command), ...override };
      }
      if (command instanceof GetObjectRetentionCommand)
        return protectedRetention(command);
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).putAndVerify('archive/a', body, retainUntil),
    ).rejects.toThrow('immutable protection');
  });

  it.each([
    ['mode', { Mode: undefined }],
    ['retention', { RetainUntilDate: new Date('2028-11-19T00:00:00.000Z') }],
  ])('rejects missing or wrong %s lock evidence', async (_field, override) => {
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand)
        return {
          IsTruncated: false,
          Versions: [{ Key: command.input.Prefix, VersionId: 'v1' }],
        };
      if (command instanceof HeadObjectCommand) return protectedObject(command);
      if (command instanceof GetObjectRetentionCommand)
        return {
          Retention: { ...protectedRetention(command).Retention, ...override },
        };
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).putAndVerify('archive/a', body, retainUntil),
    ).rejects.toThrow('immutable protection');
  });

  it('rejects incomplete listings before writes or successful deletion', async () => {
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand)
        return { IsTruncated: true, Versions: [] };
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).putAndVerify('archive/a', body, retainUntil),
    ).rejects.toThrow('incomplete');
    await expect(harness(send).deleteEveryVersion('archive/a')).rejects.toThrow(
      'incomplete',
    );
    expect(
      send.mock.calls.some(
        ([command]) =>
          command instanceof PutObjectCommand ||
          command instanceof DeleteObjectCommand,
      ),
    ).toBe(false);
  });

  it('deletes exact versions and delete markers and verifies absence', async () => {
    const versions = new Set(['v1', 'v2']);
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand)
        return {
          IsTruncated: false,
          Versions: versions.has('v1')
            ? [{ Key: command.input.Prefix, VersionId: 'v1' }]
            : [],
          DeleteMarkers: versions.has('v2')
            ? [{ Key: command.input.Prefix, VersionId: 'v2' }]
            : [],
        };
      if (command instanceof DeleteObjectCommand) {
        expect(command.input.VersionId).toBeDefined();
        versions.delete(command.input.VersionId!);
        return {};
      }
      throw new Error('unexpected command');
    });
    await expect(
      harness(send).deleteEveryVersion('archive/a'),
    ).resolves.toBeUndefined();
    expect(versions.size).toBe(0);
  });
});
