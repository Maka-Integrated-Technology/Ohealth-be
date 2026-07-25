import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

import { S3_CLIENT } from '../constants/storage.constants';

export const s3ClientProvider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): S3Client => {
    const accessKeyId = configService.get<string>('storage.aws.accessKeyId');
    const secretAccessKey = configService.get<string>(
      'storage.aws.secretAccessKey',
    );

    return new S3Client({
      region: configService.get<string>('storage.aws.region') || 'us-east-1',
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  },
};
