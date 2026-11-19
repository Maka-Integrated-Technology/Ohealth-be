/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names are intentionally uppercase. */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  MAX_SIGNED_URL_TTL_SECONDS,
  S3_CLIENT,
} from './constants/storage.constants';
import {
  ISignedUrlOptions,
  IStorageObjectReference,
  IStorageUploadOptions,
  IStorageUploadResult,
} from './interfaces/storage.interface';
import { parseObjectStorageSettings } from './object-storage-config';

@Injectable()
export class StorageService {
  constructor(
    @Inject(S3_CLIENT)
    private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
  ) {}

  async uploadPrivateObject(
    options: IStorageUploadOptions,
  ): Promise<IStorageUploadResult> {
    const bucket = this.resolveBucket(options.bucket);
    const key = this.resolveKey(options.key);
    const contentType = this.resolveContentType(options.contentType);
    this.assertValidUpload(options);
    this.assertStorageConfigured();

    const result = await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: options.body,
        ContentType: contentType,
        Metadata: options.metadata,
      }),
    );

    return {
      bucket,
      key,
      contentType,
      size: options.body.length,
      etag: result.ETag,
    };
  }

  async deleteObject(reference: IStorageObjectReference): Promise<void> {
    const bucket = this.resolveBucket(reference.bucket);
    const key = this.resolveKey(reference.key);
    this.assertStorageConfigured();

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async createSignedGetUrl(options: ISignedUrlOptions): Promise<string> {
    const bucket = this.resolveBucket(options.bucket);
    const key = this.resolveKey(options.key);
    this.assertStorageConfigured();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: options.responseContentDisposition,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: this.resolveSignedUrlTtl(options.expiresInSeconds),
    });
  }

  private resolveBucket(bucket?: string): string {
    const resolvedBucket =
      bucket?.trim() ||
      this.configService.get<string>('storage.privateBucket')?.trim();

    if (!resolvedBucket) {
      throw new InternalServerErrorException(
        'OBJECT_STORAGE_PRIVATE_BUCKET is required when no bucket is provided',
      );
    }

    return resolvedBucket;
  }

  private assertStorageConfigured(): void {
    try {
      parseObjectStorageSettings(
        {
          OBJECT_STORAGE_ENDPOINT:
            this.configService.get<string>('storage.endpoint'),
          OBJECT_STORAGE_REGION:
            this.configService.get<string>('storage.region'),
          OBJECT_STORAGE_ACCESS_KEY_ID: this.configService.get<string>(
            'storage.accessKeyId',
          ),
          OBJECT_STORAGE_SECRET_ACCESS_KEY: this.configService.get<string>(
            'storage.secretAccessKey',
          ),
          OBJECT_STORAGE_PRIVATE_BUCKET: this.configService.get<string>(
            'storage.privateBucket',
          ),
          OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: String(
            this.configService.get<string | number>(
              'storage.signedUrlTtlSeconds',
            ) ?? '300',
          ),
          OBJECT_STORAGE_FORCE_PATH_STYLE: this.configService.get<string>(
            'storage.forcePathStyle',
          ),
        },
        'OBJECT_STORAGE',
        this.configService.get<string>('env') === 'test',
      );
    } catch {
      throw new InternalServerErrorException(
        'Object storage is not configured.',
      );
    }
  }

  private resolveKey(key: string): string {
    const normalizedKey = key?.trim();

    if (!normalizedKey) {
      throw new BadRequestException('storage key is required');
    }

    if (normalizedKey.startsWith('/')) {
      throw new BadRequestException('storage key must not start with /');
    }

    return normalizedKey;
  }

  private assertValidUpload(options: IStorageUploadOptions): void {
    if (!Buffer.isBuffer(options.body)) {
      throw new BadRequestException('storage body must be a buffer');
    }
  }

  private resolveContentType(contentType: string): string {
    const normalizedContentType = contentType?.trim();

    if (!normalizedContentType) {
      throw new BadRequestException('storage content type is required');
    }

    return normalizedContentType;
  }

  private resolveSignedUrlTtl(expiresInSeconds?: number): number {
    const ttl =
      expiresInSeconds ??
      Number(
        this.configService.get<string | number>(
          'storage.signedUrlTtlSeconds',
        ) ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
      );

    if (!Number.isInteger(ttl) || ttl < 1) {
      throw new BadRequestException(
        'signed url expiration must be a positive integer',
      );
    }

    if (ttl > MAX_SIGNED_URL_TTL_SECONDS) {
      throw new BadRequestException(
        `signed url expiration must not exceed ${MAX_SIGNED_URL_TTL_SECONDS} seconds`,
      );
    }

    return ttl;
  }
}
