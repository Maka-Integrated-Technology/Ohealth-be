import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface IContractSchema {
  properties?: Record<string, unknown>;
}

interface IContract {
  paths: Record<string, { post?: { operationId?: string } }>;
  components: { schemas: Record<string, IContractSchema> };
}

describe('browser session OpenAPI contract', () => {
  const contract = JSON.parse(
    readFileSync(join(process.cwd(), 'contracts/openapi.json'), 'utf8'),
  ) as IContract;

  it('structurally excludes refresh credentials from browser responses', () => {
    const browser = contract.components.schemas.BrowserSessionResponseDtoData;
    expect(browser.properties).toHaveProperty('access_token');
    expect(browser.properties).not.toHaveProperty('refresh_token');
  });

  it.each([
    'LoginResponseDtoData',
    'RefreshTokenResponseDtoData',
    'VerifySignupResponseDtoData',
  ])('preserves the mobile refresh credential in %s', (schemaName) => {
    expect(contract.components.schemas[schemaName].properties).toHaveProperty(
      'refresh_token',
    );
  });

  it('publishes distinct browser operations without guessing OAuth', () => {
    expect(contract.paths['/api/auth/browser/verify'].post?.operationId).toBe(
      'BrowserSessionController_verifySignup',
    );
    expect(
      contract.paths['/api/auth/browser/login/verify'].post?.operationId,
    ).toBe('BrowserSessionController_verifyLogin');
    expect(contract.paths['/api/auth/browser/refresh'].post?.operationId).toBe(
      'BrowserSessionController_refresh',
    );
    expect(contract.paths['/api/auth/browser/logout'].post?.operationId).toBe(
      'BrowserSessionController_logout',
    );
    expect(contract.paths['/api/auth/browser/google-login']).toBeUndefined();
  });
});
