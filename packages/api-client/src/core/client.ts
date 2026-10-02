import { ApiClientError } from './api-client-error.js';
import type {
  ApiClientConfig,
  ApiCoreClient,
  ApiHeaders,
  ApiOperationDescriptor,
  ApiOperationRequest,
} from './types.js';

const trimTrailingSlashes = (value: string): string =>
  value.replace(/\/+$/, '');

const joinUrl = (baseUrl: string, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimTrailingSlashes(baseUrl)}${normalizedPath}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const stringifyHeaderParameters = (value: unknown): ApiHeaders => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) => entry[1] !== undefined && entry[1] !== null)
      .map(([name, headerValue]) => [name, String(headerValue)]),
  );
};

const resolvePath = (
  pathTemplate: string,
  pathParameters: Readonly<Record<string, unknown>> | undefined,
): string => {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, parameterName: string) => {
    const value = pathParameters?.[parameterName];

    if (value === undefined || value === null) {
      throw new TypeError(`Missing path parameter: ${parameterName}`);
    }

    return encodeURIComponent(String(value));
  });
};

export const createCoreClient = (config: ApiClientConfig): ApiCoreClient => {
  const baseUrl = config.baseUrl.trim();
  if (baseUrl === '') {
    throw new TypeError('API base URL must not be empty');
  }

  const request = async <TResponse, TError = unknown>(
    descriptor: ApiOperationDescriptor,
    operationRequest: ApiOperationRequest = {},
  ): Promise<TResponse> => {
    const providedHeaders = config.getHeaders ? await config.getHeaders() : {};
    const headers = {
      ...providedHeaders,
      ...stringifyHeaderParameters(operationRequest.headerParameters),
      ...operationRequest.headers,
    };
    const path = resolvePath(descriptor.path, operationRequest.path);
    const response = await config.transport({
      operationId: descriptor.operationId,
      method: descriptor.method,
      url: joinUrl(baseUrl, path),
      headers,
      query: operationRequest.query,
      cookies: operationRequest.cookies,
      body: operationRequest.body,
      mediaType: descriptor.requestMediaType,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ApiClientError<TError>(
        response.status,
        response.data as TError,
        response.headers,
      );
    }

    return response.data as TResponse;
  };

  return { request };
};
