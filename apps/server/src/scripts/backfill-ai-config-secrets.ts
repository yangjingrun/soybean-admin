import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  backfillAiConfigSecrets,
  type AiConfigSecretBackfillDatabase
} from '../modules/ai-gateway/ai-config-secret-backfill';
import { loadAppConfig } from '../modules/app-config/app-config.loader';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadAppConfig();

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to backfill AI config secrets');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(config.databaseUrl)
  });

  await prisma.$connect();

  try {
    const summary = await backfillAiConfigSecrets(createDatabaseAdapter(prisma), config.aiConfigSecretEncryptionKey, {
      dryRun
    });

    console.log(
      JSON.stringify(
        {
          dryRun,
          summary
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

function createDatabaseAdapter(prisma: PrismaClient): AiConfigSecretBackfillDatabase {
  return {
    aiModelConfig: {
      findMany: args => prisma.aiModelConfig.findMany(args),
      update: args => prisma.aiModelConfig.update(args)
    },
    serperConfig: {
      findMany: args => prisma.serperConfig.findMany(args),
      update: args => prisma.serperConfig.update(args)
    },
    hunterConfig: {
      findMany: args => prisma.hunterConfig.findMany(args),
      update: args => prisma.hunterConfig.update(args)
    }
  };
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
