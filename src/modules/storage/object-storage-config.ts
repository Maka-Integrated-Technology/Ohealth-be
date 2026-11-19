import { S3ClientConfig } from '@aws-sdk/client-s3';

import { MAX_SIGNED_URL_TTL_SECONDS } from './constants/storage.constants';

export interface IObjectStorageSettings {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds?: number;
}

export function parseObjectStorageSettings(
  values: Record<string, string | undefined>,
  prefix: 'OBJECT_STORAGE' | 'AUTH_AUDIT_ARCHIVE',
  isTest = false,
): IObjectStorageSettings {
  const required = (suffix: string): string => {
    const value = values[`${prefix}_${suffix}`]?.trim();
    if (!value) throw new Error(`Invalid ${prefix} configuration: ${suffix}.`);
    return value;
  };
  const endpoint = required('ENDPOINT');
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`Invalid ${prefix} configuration: ENDPOINT.`);
  }
  if (
    !['https:', ...(isTest ? ['http:'] : [])].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(`Invalid ${prefix} configuration: ENDPOINT.`);
  }
  const region = required('REGION');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(region)) {
    throw new Error(`Invalid ${prefix} configuration: REGION.`);
  }
  const accessKeyId = required('ACCESS_KEY_ID');
  const secretAccessKey = required('SECRET_ACCESS_KEY');
  if (/\s/.test(accessKeyId) || /\s/.test(secretAccessKey)) {
    throw new Error(`Invalid ${prefix} configuration: CREDENTIALS.`);
  }
  const bucket = required(
    prefix === 'OBJECT_STORAGE' ? 'PRIVATE_BUCKET' : 'BUCKET',
  );
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error(`Invalid ${prefix} configuration: BUCKET.`);
  }
  const pathStyle = values[`${prefix}_FORCE_PATH_STYLE`] ?? 'false';
  if (pathStyle !== 'true' && pathStyle !== 'false') {
    throw new Error(`Invalid ${prefix} configuration: FORCE_PATH_STYLE.`);
  }
  const result: IObjectStorageSettings = {
    endpoint: url.origin,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: pathStyle === 'true',
  };
  if (prefix === 'OBJECT_STORAGE') {
    const ttl = values.OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS ?? '300';
    if (
      !/^[1-9][0-9]*$/.test(ttl) ||
      Number(ttl) > MAX_SIGNED_URL_TTL_SECONDS
    ) {
      throw new Error(
        'Invalid OBJECT_STORAGE configuration: SIGNED_URL_TTL_SECONDS.',
      );
    }
    result.signedUrlTtlSeconds = Number(ttl);
  }
  return result;
}

export function objectStorageClientConfig(
  settings: IObjectStorageSettings,
): S3ClientConfig {
  return {
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    forcePathStyle: settings.forcePathStyle,
    // A retried PUT can create another version after a lost acknowledgement.
    maxAttempts: 1,
  };
}
