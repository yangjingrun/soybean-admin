import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { config } from 'dotenv';
import { AppModule } from './modules/app.module';

const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(existsSync);

if (envPath) {
  config({ path: envPath });
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const port = Number(process.env.PORT || 9528);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

function getCorsOrigins() {
  const configuredOrigins = process.env.SERVER_CORS_ORIGINS?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
}
