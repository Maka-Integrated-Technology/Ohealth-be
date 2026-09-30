import type { ApiHeaders } from './types.js';

export class ApiClientError<TResponse = unknown> extends Error {
  readonly status: number;
  readonly response: TResponse;
  readonly headers: ApiHeaders | undefined;

  constructor(
    status: number,
    response: TResponse,
    headers: ApiHeaders | undefined,
  ) {
    super(`OHealth API request failed with status ${status}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.response = response;
    this.headers = headers;
  }
}

export const isApiClientError = (
  error: unknown,
): error is ApiClientError<unknown> => {
  return error instanceof ApiClientError;
};
