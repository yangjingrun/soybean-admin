import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';
import { AppModule } from './modules/app.module';
import { loadAppConfig } from './modules/app-config/app-config.loader';
import { ApiExceptionFilter } from './shared/api-exception.filter';

const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);

if (envPath) {
  config({ path: envPath });
}

async function bootstrap() {
  const appConfig = loadAppConfig();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableCors({
    origin: getCorsOrigins(appConfig.serverCorsOrigins),
    credentials: true
  });
  app.useGlobalFilters(new ApiExceptionFilter());

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
