/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names are intentionally uppercase. */
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

import { S3_CLIENT } from '../constants/storage.constants';
import {
  objectStorageClientConfig,
  parseObjectStorageSettings,
} from '../object-storage-config';

export const s3ClientProvider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): S3Client => {
    const settings = parseObjectStorageSettings(
      {
        OBJECT_STORAGE_ENDPOINT: configService.get<string>('storage.endpoint'),
        OBJECT_STORAGE_REGION: configService.get<string>('storage.region'),
        OBJECT_STORAGE_ACCESS_KEY_ID: configService.get<string>(
          'storage.accessKeyId',
        ),
        OBJECT_STORAGE_SECRET_ACCESS_KEY: configService.get<string>(
          'storage.secretAccessKey',
        ),
        OBJECT_STORAGE_PRIVATE_BUCKET: configService.get<string>(
          'storage.privateBucket',
        ),
        OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: configService.get<string>(
          'storage.signedUrlTtlSeconds',
        ),
        OBJECT_STORAGE_FORCE_PATH_STYLE: configService.get<string>(
          'storage.forcePathStyle',
        ),
      },
      'OBJECT_STORAGE',
      configService.get<string>('env') === 'test',
    );
    return new S3Client(objectStorageClientConfig(settings));
  },
};
