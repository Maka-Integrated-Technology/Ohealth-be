import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './middleware/logging.interceptor';
import {
  createOpenApiDocument,
  mountOpenApiDocumentation,
} from './openapi/openapi-document.factory';
import { OPENAPI_API_PREFIX } from './openapi/openapi.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const corsOrigins = configService.get<string[]>('cors.origins', []);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  const apiPrefix = configService.get<string>('API_PREFIX', OPENAPI_API_PREFIX);

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['docs', 'health'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const openApiDocument = createOpenApiDocument(app);
  mountOpenApiDocumentation(app, openApiDocument);

  // Use Winston logger globally
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Inject your LoggingInterceptor
  const loggingInterceptor = app.get(LoggingInterceptor);
  app.useGlobalInterceptors(loggingInterceptor);

  const isDev = configService.get<boolean>('isDev');
  const port = configService.get<string>('port');
  const env = configService.get<string>('env');
  const appName = configService.get<string>('app.name');

  if (isDev) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app.use(require('morgan')('dev'));
  }

  // Get the Winston logger to use after startup
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);

  await app.listen(port);

  logger.log(
    `
      ------------
      Internal Application Started!
      Environment: ${env}
      API: http://localhost:${port}/
      API Docs: http://localhost:${port}/docs
      ------------
  `,
    ` ${appName} | ${env}`,
  );
}

bootstrap();
