import { parseOpenApiContractCommand } from './openapi-contract-command';

describe('parseOpenApiContractCommand', () => {
  it.each([
    [undefined, 'write'],
    ['--write', 'write'],
    ['--check', 'check'],
  ] as const)('maps %s to %s', (argument, expected) => {
    expect(parseOpenApiContractCommand(argument)).toBe(expected);
  });

  it('rejects unsupported arguments', () => {
    expect(() => parseOpenApiContractCommand('--unknown')).toThrow(
      'Use --write or --check',
    );
  });
});
