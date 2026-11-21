export interface IStorageUploadOptions {
  bucket?: string;
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface IStorageUploadResult {
  bucket: string;
  key: string;
  contentType: string;
  size: number;
  etag?: string;
  versionId?: string;
}

export interface ISignedUrlOptions {
  bucket?: string;
  key: string;
  versionId?: string;
  expiresInSeconds?: number;
  responseContentDisposition?: string;
}

export interface IStorageObjectReference {
  bucket?: string;
  key: string;
}
