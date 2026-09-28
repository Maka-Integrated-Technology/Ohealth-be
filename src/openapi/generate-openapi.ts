import 'reflect-metadata';

import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import {
  assertOpenApiContractCurrent,
  serializeOpenApiContract,
  writeOpenApiContract,
} from './openapi-contract';
import { parseOpenApiContractCommand } from './openapi-contract-command';
import { createOpenApiDocument } from './openapi-document.factory';
import { enableOpenApiContractGeneration } from './openapi-generation-context';
import { OPENAPI_API_PREFIX, OPENAPI_CONTRACT_PATH } from './openapi.constants';

async function generateOpenApiContract(): Promise<void> {
  enableOpenApiContractGeneration();
  const command = parseOpenApiContractCommand(process.argv[2]);
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });

  try {
    app.setGlobalPrefix(OPENAPI_API_PREFIX, {
      exclude: ['docs', 'health'],
    });

    const document = createOpenApiDocument(app);
    const serializedContract = serializeOpenApiContract(document);
    const outputPath = resolve(process.cwd(), OPENAPI_CONTRACT_PATH);

    if (command === 'check') {
      await assertOpenApiContractCurrent(outputPath, serializedContract);
      process.stdout.write(`OpenAPI contract is current: ${outputPath}\n`);
      return;
    }

    await writeOpenApiContract(outputPath, serializedContract);
    process.stdout.write(`OpenAPI contract generated: ${outputPath}\n`);
  } finally {
    await app.close();
  }
}

generateOpenApiContract().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`OpenAPI contract generation failed: ${message}\n`);
  process.exitCode = 1;
});
