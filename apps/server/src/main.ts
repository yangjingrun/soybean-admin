import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';
import { AppModule } from './modules/app.module';
import { loadAppConfig } from './modules/app-config/app-config.loader';
import { SystemLogService } from './modules/system-log/system-log.service';
import { ApiExceptionFilter } from './shared/api-exception.filter';

const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);

if (envPath) {
  config({ path: envPath });
}

async function bootstrap() {
  const appConfig = loadAppConfig();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableShutdownHooks();
  app.enableCors({
    origin: getCorsOrigins(appConfig.serverCorsOrigins),
    credentials: true
  });
  const systemLogService = app.get(SystemLogService, { strict: false });

  app.useGlobalFilters(new ApiExceptionFilter(systemLogService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  await app.listen(appConfig.port, '0.0.0.0');
}

void bootstrap();

function getCorsOrigins(configuredOrigins: string[] | null) {
  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
}
