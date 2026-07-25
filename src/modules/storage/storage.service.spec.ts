import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { S3_CLIENT } from './constants/storage.constants';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;

  const mockS3Client = {
    send: jest.fn(),
  };

  const getConfigValue = (key: string): string | number | undefined => {
    switch (key) {
      case 'storage.aws.region':
        return 'eu-west-1';
      case 'storage.aws.accessKeyId':
        return 'access-key-id';
      case 'storage.aws.secretAccessKey':
        return 'secret-access-key';
      case 'storage.aws.s3.privateBucket':
        return 'private-bucket';
      case 'storage.aws.s3.signedUrlTtlSeconds':
        return 300;
      default:
        return undefined;
    }
  };

  const mockConfigService = {
    get: jest.fn(getConfigValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: S3_CLIENT,
          useValue: mockS3Client,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation(getConfigValue);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upload a private object to an explicit bucket', async () => {
    mockS3Client.send.mockResolvedValue({ ETag: 'etag-value' });
    const body = Buffer.from('file-content');

    const result = await service.uploadPrivateObject({
      bucket: 'explicit-bucket',
      key: 'laboratories/lab-id/license.pdf',
      body,
      contentType: 'application/pdf',
      metadata: {
        document_type: 'laboratory_license',
      },
    });

    expect(mockS3Client.send).toHaveBeenCalledWith(
      expect.any(PutObjectCommand),
    );
    expect(mockS3Client.send.mock.calls[0][0].input).toEqual({
      Bucket: 'explicit-bucket',
      Key: 'laboratories/lab-id/license.pdf',
      Body: body,
      ContentType: 'application/pdf',
      Metadata: {
        document_type: 'laboratory_license',
      },
    });
    expect(result).toEqual({
      bucket: 'explicit-bucket',
      key: 'laboratories/lab-id/license.pdf',
      contentType: 'application/pdf',
      size: body.length,
      etag: 'etag-value',
    });
  });

  it('should upload a private object to the default private bucket', async () => {
    mockS3Client.send.mockResolvedValue({});
    const body = Buffer.from('image');

    const result = await service.uploadPrivateObject({
      key: 'laboratories/lab-id/identity.png',
      body,
      contentType: 'image/png',
    });

    expect(mockS3Client.send.mock.calls[0][0].input.Bucket).toBe(
      'private-bucket',
    );
    expect(result.bucket).toBe('private-bucket');
  });

  it('should trim storage keys before sending requests to S3', async () => {
    mockS3Client.send.mockResolvedValue({});

    const result = await service.uploadPrivateObject({
      key: ' laboratories/lab-id/license.pdf ',
      body: Buffer.from('file'),
      contentType: 'application/pdf',
    });

    expect(mockS3Client.send.mock.calls[0][0].input.Key).toBe(
      'laboratories/lab-id/license.pdf',
    );
    expect(result.key).toBe('laboratories/lab-id/license.pdf');
  });

  it('should trim content type before uploading to S3', async () => {
    mockS3Client.send.mockResolvedValue({});

    const result = await service.uploadPrivateObject({
      key: 'laboratories/lab-id/license.pdf',
      body: Buffer.from('file'),
      contentType: ' application/pdf ',
    });

    expect(mockS3Client.send.mock.calls[0][0].input.ContentType).toBe(
      'application/pdf',
    );
    expect(result.contentType).toBe('application/pdf');
  });

  it('should throw when no bucket is available', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'storage.aws.s3.privateBucket') {
        return undefined;
      }

      return getConfigValue(key);
    });

    await expect(
      service.uploadPrivateObject({
        key: 'laboratories/lab-id/license.pdf',
        body: Buffer.from('file'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should throw when storage credentials are missing', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'storage.aws.accessKeyId') {
        return undefined;
      }

      return getConfigValue(key);
    });

    await expect(
      service.uploadPrivateObject({
        key: 'laboratories/lab-id/license.pdf',
        body: Buffer.from('file'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('S3 storage is not configured');
  });

  it('should reject empty or absolute storage keys', async () => {
    await expect(
      service.uploadPrivateObject({
        key: '',
        body: Buffer.from('file'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.uploadPrivateObject({
        key: '/laboratories/lab-id/license.pdf',
        body: Buffer.from('file'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid upload payloads', async () => {
    await expect(
      service.uploadPrivateObject({
        key: 'laboratories/lab-id/license.pdf',
        body: 'file' as unknown as Buffer,
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow('storage body must be a buffer');

    await expect(
      service.uploadPrivateObject({
        key: 'laboratories/lab-id/license.pdf',
        body: Buffer.from('file'),
        contentType: '',
      }),
    ).rejects.toThrow('storage content type is required');
  });

  it('should delete an object from S3', async () => {
    mockS3Client.send.mockResolvedValue({});

    await service.deleteObject({
      bucket: 'explicit-bucket',
      key: 'laboratories/lab-id/license.pdf',
    });

    expect(mockS3Client.send).toHaveBeenCalledWith(
      expect.any(DeleteObjectCommand),
    );
    expect(mockS3Client.send.mock.calls[0][0].input).toEqual({
      Bucket: 'explicit-bucket',
      Key: 'laboratories/lab-id/license.pdf',
    });
  });

  it('should create a signed get url with default ttl', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed-url.test');

    const result = await service.createSignedGetUrl({
      key: 'laboratories/lab-id/license.pdf',
      responseContentDisposition: 'attachment; filename="license.pdf"',
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      mockS3Client,
      expect.any(GetObjectCommand),
      { expiresIn: 300 },
    );
    expect((getSignedUrl as jest.Mock).mock.calls[0][1].input).toMatchObject({
      Bucket: 'private-bucket',
      Key: 'laboratories/lab-id/license.pdf',
      ResponseContentDisposition: 'attachment; filename="license.pdf"',
    });
    expect(result).toBe('https://signed-url.test');
  });

  it('should create a signed get url with caller ttl', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://short-url.test');

    await service.createSignedGetUrl({
      bucket: 'explicit-bucket',
      key: 'laboratories/lab-id/license.pdf',
      expiresInSeconds: 60,
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      mockS3Client,
      expect.any(GetObjectCommand),
      { expiresIn: 60 },
    );
  });

  it('should reject invalid signed url ttl values', async () => {
    await expect(
      service.createSignedGetUrl({
        key: 'laboratories/lab-id/license.pdf',
        expiresInSeconds: 0,
      }),
    ).rejects.toThrow('signed url expiration must be a positive integer');

    await expect(
      service.createSignedGetUrl({
        key: 'laboratories/lab-id/license.pdf',
        expiresInSeconds: 1.5,
      }),
    ).rejects.toThrow('signed url expiration must be a positive integer');
  });

  it('should reject invalid configured signed url ttl values', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'storage.aws.s3.signedUrlTtlSeconds') {
        return 1.5;
      }

      return getConfigValue(key);
    });

    await expect(
      service.createSignedGetUrl({
        key: 'laboratories/lab-id/license.pdf',
      }),
    ).rejects.toThrow('signed url expiration must be a positive integer');
  });

  it('should reject signed url ttl values above the maximum supported limit', async () => {
    await expect(
      service.createSignedGetUrl({
        key: 'laboratories/lab-id/license.pdf',
        expiresInSeconds: 604801,
      }),
    ).rejects.toThrow('signed url expiration must not exceed 604800 seconds');
  });
});
