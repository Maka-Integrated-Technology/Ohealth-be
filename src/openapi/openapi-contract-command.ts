export type OpenApiContractCommand = 'check' | 'write';

export function parseOpenApiContractCommand(
  argument: string | undefined,
): OpenApiContractCommand {
  if (argument === '--check') {
    return 'check';
  }

  if (argument === undefined || argument === '--write') {
    return 'write';
  }

  throw new Error(
    `Unsupported contract command: ${argument}. Use --write or --check.`,
  );
}
