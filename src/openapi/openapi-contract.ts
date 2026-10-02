import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { OpenAPIObject } from '@nestjs/swagger';

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((sorted, key) => {
        sorted[key] = sortJsonValue(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

export function serializeOpenApiContract(document: OpenAPIObject): string {
  const normalized = sortJsonValue(document as unknown as JsonValue);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export async function writeOpenApiContract(
  outputPath: string,
  serializedContract: string,
): Promise<void> {
  const directory = dirname(outputPath);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, serializedContract, {
      encoding: 'utf8',
      mode: 0o644,
    });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function assertOpenApiContractCurrent(
  outputPath: string,
  serializedContract: string,
): Promise<void> {
  let committedContract: string;

  try {
    committedContract = await readFile(outputPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `OpenAPI contract is missing at ${outputPath}. Run npm run contract:generate.`,
      );
    }

    throw error;
  }

  if (committedContract !== serializedContract) {
    throw new Error(
      `OpenAPI contract is out of date at ${outputPath}. Run npm run contract:generate and commit the result.`,
    );
  }
}
