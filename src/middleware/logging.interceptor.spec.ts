import { CallHandler, ExecutionContext, LoggerService } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const credential = 'secret-refresh-credential';
  let logger: LoggerService;
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    interceptor = new LoggingInterceptor(logger);
  });

  it.each([
    ['successful', of({ ok: true })],
    ['failed', throwError(() => new Error('rejected'))],
  ])('never logs query values for a %s request', async (_name, result) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/api/auth/browser/refresh',
          url: `/api/auth/browser/refresh?refresh_token=${credential}`,
        }),
        getResponse: () => ({ statusCode: 400 }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => result } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next)).catch(() => null);

    const output = JSON.stringify({
      log: (logger.log as jest.Mock).mock.calls,
      error: (logger.error as jest.Mock).mock.calls,
    });
    expect(output).toContain('/api/auth/browser/refresh');
    expect(output).not.toContain(credential);
    expect(output).not.toContain('refresh_token');
  });
});
