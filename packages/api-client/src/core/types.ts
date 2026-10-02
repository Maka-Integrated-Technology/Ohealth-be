export type ApiHeaders = Readonly<Record<string, string>>;

export type ApiHttpMethod =
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'TRACE';

export interface ApiTransportRequest {
  readonly operationId: string;
  readonly method: ApiHttpMethod;
  readonly url: string;
  readonly headers: ApiHeaders;
  readonly query: unknown | undefined;
  readonly cookies: unknown | undefined;
  readonly body: unknown | undefined;
  readonly mediaType: string | undefined;
}

export interface ApiTransportResponse<TData = unknown> {
  readonly status: number;
  readonly data: TData;
  readonly headers?: ApiHeaders;
}

export type ApiTransport = (
  request: ApiTransportRequest,
) => Promise<ApiTransportResponse<unknown>>;

export type ApiHeaderProvider = () => ApiHeaders | Promise<ApiHeaders>;

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly transport: ApiTransport;
  readonly getHeaders?: ApiHeaderProvider;
}

export interface ApiOperationDescriptor {
  readonly operationId: string;
  readonly method: ApiHttpMethod;
  readonly path: string;
  readonly requestMediaType?: string;
}

export interface ApiOperationRequest {
  readonly path?: Readonly<Record<string, unknown>>;
  readonly query?: unknown;
  readonly headerParameters?: unknown;
  readonly cookies?: unknown;
  readonly headers?: ApiHeaders;
  readonly body?: unknown;
}

export interface ApiCoreClient {
  request<TResponse, TError = unknown>(
    descriptor: ApiOperationDescriptor,
    request?: ApiOperationRequest,
  ): Promise<TResponse>;
}
