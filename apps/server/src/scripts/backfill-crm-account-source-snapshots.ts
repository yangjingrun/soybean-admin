import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  backfillCrmAccountSourceSnapshots,
  type CrmAccountSourceSnapshotBackfillDatabase
} from '../modules/crm/accounts/crm-account-source-snapshot-backfill';
import { loadAppConfig } from '../modules/app-config/app-config.loader';
import { normalizeAiLeadProductLineSnapshot } from '../modules/ai-leads/ai-lead-product-line-context';

async function main() {
  loadNearestDotEnv();

  const dryRun = process.argv.includes('--dry-run');
  const config = loadAppConfig();

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to backfill CRM account source snapshots');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(config.databaseUrl)
  });

  await prisma.$connect();

  try {
    const summary = await backfillCrmAccountSourceSnapshots(createDatabaseAdapter(prisma), { dryRun });

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

function loadNearestDotEnv() {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  const envPath = candidates.find(candidate => existsSync(candidate));

  if (!envPath) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = unwrapEnvValue(match[2].trim());
  }
}

function unwrapEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function createDatabaseAdapter(prisma: PrismaClient): CrmAccountSourceSnapshotBackfillDatabase {
  return {
    findAccountsMissingSourceSnapshot() {
      return prisma.crmAccount.findMany({
        where: {
          sourceTaskId: { not: null },
          sourceSnapshot: { equals: Prisma.DbNull }
        },
        select: {
          id: true,
          sourceTaskId: true,
          name: true,
          normalizedName: true,
          domain: true,
          websiteUrl: true
        }
      });
    },
    findTasksByIds(ids: string[]) {
      return prisma.aiLeadSearchTask
        .findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            productLineSnapshot: true,
            result: true
          }
        })
        .then(tasks =>
          tasks.map(task => ({
            id: task.id,
            productLineSnapshot: normalizeAiLeadProductLineSnapshot(task.productLineSnapshot),
            result: task.result
          }))
        );
    },
    updateAccountSourceSnapshot(id: string, sourceSnapshot: Record<string, unknown>) {
      return prisma.crmAccount.update({
        where: { id },
        data: {
          sourceSnapshot: sourceSnapshot as Prisma.InputJsonValue
        }
      });
    }
  };
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
