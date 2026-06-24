import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  buildChineseGeoCityNameRowFromAlternateLine,
  buildGeoCityImportBaseFromCityLine,
  buildGeoCityNameRowsFromCityLine,
  type CrmGeoCityImportBase,
  type CrmGeoCityNameImportRow
} from '../modules/crm/geo/geonames-timezone-import';
import { loadAppConfig } from '../modules/app-config/app-config.loader';

const defaultBatchSize = 2000;

interface ImportOptions {
  citiesFile: string;
  alternateNamesFile: string | null;
  batchSize: number;
  dryRun: boolean;
}

async function main() {
  const options = await parseOptions(process.argv.slice(2));
  const prisma = options.dryRun ? null : createPrismaClient();

  try {
    const summary = await importGeoNamesCityTimeZones(prisma, options);

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          citiesFile: options.citiesFile,
          alternateNamesFile: options.alternateNamesFile,
          summary
        },
        null,
        2
      )
    );
  } finally {
    await prisma?.$disconnect();
  }
}

function createPrismaClient() {
  const config = loadAppConfig();

  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to import GeoNames timezone data');
  }

  return new PrismaClient({
    adapter: new PrismaPg(config.databaseUrl)
  });
}

async function parseOptions(args: string[]): Promise<ImportOptions> {
  const citiesFile = getOptionValue(args, '--cities') ?? process.env.GEONAMES_CITIES_FILE;
  const alternateNamesFile = getOptionValue(args, '--alternate-names') ?? process.env.GEONAMES_ALTERNATE_NAMES_FILE ?? null;
  const batchSizeValue = getOptionValue(args, '--batch-size');
  const batchSize = batchSizeValue ? Number.parseInt(batchSizeValue, 10) : defaultBatchSize;

  if (!citiesFile) {
    throw new Error('Missing --cities <path>. Download and unzip GeoNames cities15000.txt or cities1000.txt first.');
  }

  await access(citiesFile);
  if (alternateNamesFile) {
    await access(alternateNamesFile);
  }

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('--batch-size must be a positive integer');
  }

  return {
    citiesFile,
    alternateNamesFile,
    batchSize,
    dryRun: args.includes('--dry-run')
  };
}

async function importGeoNamesCityTimeZones(prisma: PrismaClient | null, options: ImportOptions) {
  const rows = createInterface({
    input: createReadStream(options.citiesFile, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY
  });
  const cityBaseByGeonameId = new Map<number, CrmGeoCityImportBase>();
  let cityLineCount = 0;
  let cityNameCount = 0;
  let chineseAlternateNameCount = 0;
  let batch: CrmGeoCityNameImportRow[] = [];

  if (!options.dryRun) {
    await prisma?.$connect();
    await prisma?.crmGeoCityName.deleteMany({});
  }

  for await (const line of rows) {
    const cityBase = buildGeoCityImportBaseFromCityLine(line);
    const cityRows = buildGeoCityNameRowsFromCityLine(line);

    if (cityRows.length === 0) {
      continue;
    }

    if (cityBase) {
      cityBaseByGeonameId.set(cityBase.geonameId, cityBase);
    }

    cityLineCount += 1;
    cityNameCount += cityRows.length;
    batch.push(...cityRows);

    if (batch.length >= options.batchSize) {
      await flushBatch(prisma, batch, options.dryRun);
      batch = [];
    }
  }

  await flushBatch(prisma, batch, options.dryRun);
  batch = [];

  if (options.alternateNamesFile) {
    const alternateRows = createInterface({
      input: createReadStream(options.alternateNamesFile, { encoding: 'utf8' }),
      crlfDelay: Number.POSITIVE_INFINITY
    });

    for await (const line of alternateRows) {
      const row = buildChineseGeoCityNameRowFromAlternateLine(line, cityBaseByGeonameId);

      if (!row) {
        continue;
      }

      chineseAlternateNameCount += 1;
      batch.push(row);

      if (batch.length >= options.batchSize) {
        await flushBatch(prisma, batch, options.dryRun);
        batch = [];
      }
    }

    await flushBatch(prisma, batch, options.dryRun);
  }

  return {
    cityLineCount,
    cityNameCount,
    chineseAlternateNameCount
  };
}

async function flushBatch(prisma: PrismaClient | null, batch: CrmGeoCityNameImportRow[], dryRun: boolean) {
  if (batch.length === 0 || dryRun) {
    return;
  }

  await prisma?.crmGeoCityName.createMany({
    data: batch,
    skipDuplicates: true
  });
}

function getOptionValue(args: string[], name: string) {
  const equalsArg = args.find(arg => arg.startsWith(`${name}=`));

  if (equalsArg) {
    return equalsArg.slice(name.length + 1);
  }

  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] : undefined;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
