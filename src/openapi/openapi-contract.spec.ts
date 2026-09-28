import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertOpenApiContractCurrent,
  serializeOpenApiContract,
  writeOpenApiContract,
} from './openapi-contract';

import type { OpenAPIObject } from '@nestjs/swagger';

describe('OpenAPI contract utilities', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'ohealth-openapi-'));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('serializes object keys deterministically while preserving array order', () => {
    const earlierPath = '/a';
    const laterPath = '/z';
    const document = {
      openapi: '3.0.0',
      info: { version: '1.0.0', title: 'OHealth API' },
      paths: {
        [laterPath]: { get: { tags: ['second', 'first'], responses: {} } },
        [earlierPath]: { get: { responses: {} } },
      },
    } as OpenAPIObject;

    expect(serializeOpenApiContract(document)).toBe(
      `${JSON.stringify(
        {
          info: { title: 'OHealth API', version: '1.0.0' },
          openapi: '3.0.0',
          paths: {
            [earlierPath]: { get: { responses: {} } },
            [laterPath]: {
              get: { responses: {}, tags: ['second', 'first'] },
            },
          },
        },
        null,
        2,
      )}\n`,
    );
  });

  it('writes the serialized contract atomically', async () => {
    const outputPath = join(temporaryDirectory, 'contracts', 'openapi.json');
    const contract = '{"openapi":"3.0.0"}\n';

    await writeOpenApiContract(outputPath, contract);

    await expect(readFile(outputPath, 'utf8')).resolves.toBe(contract);
  });

  it('accepts a current committed contract', async () => {
    const outputPath = join(temporaryDirectory, 'openapi.json');
    const contract = '{"openapi":"3.0.0"}\n';
    await writeOpenApiContract(outputPath, contract);

    await expect(
      assertOpenApiContractCurrent(outputPath, contract),
    ).resolves.toBeUndefined();
  });

  it('rejects a missing committed contract with an actionable error', async () => {
    const outputPath = join(temporaryDirectory, 'missing.json');

    await expect(
      assertOpenApiContractCurrent(outputPath, '{}\n'),
    ).rejects.toThrow('Run npm run contract:generate');
  });

  it('rejects contract drift with an actionable error', async () => {
    const outputPath = join(temporaryDirectory, 'openapi.json');
    await writeOpenApiContract(outputPath, '{"version":"old"}\n');

    await expect(
      assertOpenApiContractCurrent(outputPath, '{"version":"new"}\n'),
    ).rejects.toThrow('OpenAPI contract is out of date');
  });
});
