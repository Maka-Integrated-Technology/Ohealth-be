/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names are intentionally uppercase. */
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

import appConfig from '../../config/config';

import {
  objectStorageClientConfig,
  parseObjectStorageSettings,
} from './object-storage-config';
import { s3ClientProvider } from './providers/s3-client.provider';

const media = {
  OBJECT_STORAGE_ENDPOINT: 'https://s3.eu.example.test',
  OBJECT_STORAGE_REGION: 'eu-central-003',
  OBJECT_STORAGE_ACCESS_KEY_ID: 'key-id',
  OBJECT_STORAGE_SECRET_ACCESS_KEY: 'super-secret',
  OBJECT_STORAGE_PRIVATE_BUCKET: 'private-media',
  OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: '300',
  OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
};

const archive = {
  AUTH_AUDIT_ARCHIVE_ENDPOINT: 'https://s3.archive.example.test',
  AUTH_AUDIT_ARCHIVE_REGION: 'eu-central-003',
  AUTH_AUDIT_ARCHIVE_ACCESS_KEY_ID: 'archive-key-id',
  AUTH_AUDIT_ARCHIVE_SECRET_ACCESS_KEY: 'archive-secret',
  AUTH_AUDIT_ARCHIVE_BUCKET: 'private-audit',
  AUTH_AUDIT_ARCHIVE_FORCE_PATH_STYLE: 'false',
};

describe('object storage configuration', () => {
  it('passes explicit media settings into the S3-compatible client', async () => {
    const config = new ConfigService({
      storage: {
        endpoint: media.OBJECT_STORAGE_ENDPOINT,
        region: media.OBJECT_STORAGE_REGION,
        accessKeyId: media.OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: media.OBJECT_STORAGE_SECRET_ACCESS_KEY,
        privateBucket: media.OBJECT_STORAGE_PRIVATE_BUCKET,
        signedUrlTtlSeconds: 300,
        forcePathStyle: media.OBJECT_STORAGE_FORCE_PATH_STYLE,
      },
    });
    const client = s3ClientProvider.useFactory(config);
    try {
      expect(await client.config.endpoint()).toMatchObject({
        hostname: 's3.eu.example.test',
      });
      expect(await client.config.region()).toBe('eu-central-003');
      expect(await client.config.credentials()).toMatchObject({
        accessKeyId: 'key-id',
        secretAccessKey: 'super-secret',
      });
      expect(client.config.forcePathStyle).toBe(true);
      expect(await client.config.maxAttempts()).toBe(1);
    } finally {
      client.destroy();
    }
  });

  it('builds independent archive credentials and settings', async () => {
    const settings = parseObjectStorageSettings(archive, 'AUTH_AUDIT_ARCHIVE');
    const client = new S3Client(objectStorageClientConfig(settings));
    try {
      expect(settings.bucket).toBe('private-audit');
      expect(await client.config.region()).toBe('eu-central-003');
      expect(await client.config.credentials()).toMatchObject({
        accessKeyId: 'archive-key-id',
        secretAccessKey: 'archive-secret',
      });
      expect(client.config.forcePathStyle).toBe(false);
      expect(await client.config.maxAttempts()).toBe(1);
    } finally {
      client.destroy();
    }
  });

  it.each([
    [{ ...media, OBJECT_STORAGE_ENDPOINT: '' }, 'ENDPOINT'],
    [
      { ...media, OBJECT_STORAGE_ENDPOINT: 'http://s3.example.test' },
      'ENDPOINT',
    ],
    [
      {
        ...media,
        OBJECT_STORAGE_ENDPOINT: 'https://user:password@s3.example.test',
      },
      'ENDPOINT',
    ],
    [{ ...media, OBJECT_STORAGE_REGION: '' }, 'REGION'],
    [{ ...media, OBJECT_STORAGE_ACCESS_KEY_ID: '' }, 'ACCESS_KEY_ID'],
    [{ ...media, OBJECT_STORAGE_SECRET_ACCESS_KEY: '' }, 'SECRET_ACCESS_KEY'],
    [{ ...media, OBJECT_STORAGE_PRIVATE_BUCKET: '' }, 'PRIVATE_BUCKET'],
    [
      { ...media, OBJECT_STORAGE_SECRET_ACCESS_KEY: 'bad\nsecret' },
      'CREDENTIALS',
    ],
    [{ ...media, OBJECT_STORAGE_FORCE_PATH_STYLE: 'yes' }, 'FORCE_PATH_STYLE'],
    [
      { ...media, OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: '0' },
      'SIGNED_URL_TTL_SECONDS',
    ],
    [
      { ...media, OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: '604801' },
      'SIGNED_URL_TTL_SECONDS',
    ],
  ])('rejects malformed media configuration safely', (values, field) => {
    expect(() => parseObjectStorageSettings(values, 'OBJECT_STORAGE')).toThrow(
      field,
    );
    expect(() =>
      parseObjectStorageSettings(values, 'OBJECT_STORAGE'),
    ).not.toThrow('super-secret');
  });

  it('permits HTTP endpoints only in tests', () => {
    expect(
      parseObjectStorageSettings(
        { ...media, OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000' },
        'OBJECT_STORAGE',
        true,
      ).endpoint,
    ).toBe('http://localhost:9000');
  });

  it('accepts HTTP in the provider factory only for the configured test environment', async () => {
    const storage = {
      endpoint: 'http://localhost:9000',
      region: media.OBJECT_STORAGE_REGION,
      accessKeyId: media.OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: media.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      privateBucket: media.OBJECT_STORAGE_PRIVATE_BUCKET,
      signedUrlTtlSeconds: 300,
      forcePathStyle: media.OBJECT_STORAGE_FORCE_PATH_STYLE,
    };
    const client = s3ClientProvider.useFactory(
      new ConfigService({ env: appConfig().env, storage }),
    );
    try {
      expect(await client.config.endpoint()).toMatchObject({
        protocol: 'http:',
        hostname: 'localhost',
      });
    } finally {
      client.destroy();
    }
    expect(() =>
      s3ClientProvider.useFactory(
        new ConfigService({ env: 'staging', storage }),
      ),
    ).toThrow('ENDPOINT');
  });

  it('never selects ambient credentials or an AWS endpoint', () => {
    expect(() =>
      parseObjectStorageSettings(
        { ...media, OBJECT_STORAGE_ENDPOINT: undefined },
        'OBJECT_STORAGE',
      ),
    ).toThrow('ENDPOINT');
    expect(() =>
      parseObjectStorageSettings(
        { ...media, OBJECT_STORAGE_ACCESS_KEY_ID: undefined },
        'OBJECT_STORAGE',
      ),
    ).toThrow('ACCESS_KEY_ID');
  });
});
