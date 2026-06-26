import { assertSecretEncryptionKey, encryptSecret } from '../../shared/secret-crypto';

const aiConfigSecretCryptoOptions = {
  keyLabel: 'AI config secret encryption key',
  valueLabel: 'Encrypted AI config secret'
};

export interface AiConfigSecretBackfillRow {
  id: string;
  apiKey: string;
  encryptedApiKey: string | null;
}

export interface AiConfigSecretBackfillDelegate {
  findMany(args: AiConfigSecretBackfillFindManyArgs): Promise<AiConfigSecretBackfillRow[]>;
  update(args: AiConfigSecretBackfillUpdateArgs): Promise<unknown>;
}

export interface AiConfigSecretBackfillDatabase {
  aiModelConfig: AiConfigSecretBackfillDelegate;
  serperConfig: AiConfigSecretBackfillDelegate;
  hunterConfig: AiConfigSecretBackfillDelegate;
}

export interface AiConfigSecretBackfillFindManyArgs {
  select: {
    id: true;
    apiKey: true;
    encryptedApiKey: true;
  };
  where: {
    OR: Array<
      | {
          encryptedApiKey: null;
          apiKey: { not: string };
        }
      | {
          encryptedApiKey: { not: null };
          apiKey: { not: string };
        }
    >;
  };
}

export interface AiConfigSecretBackfillUpdateArgs {
  where: { id: string };
  data: {
    apiKey: string;
    encryptedApiKey?: string;
  };
}

export interface AiConfigSecretBackfillOptions {
  dryRun?: boolean;
}

export interface AiConfigSecretBackfillTableSummary {
  scannedCount: number;
  encryptedCount: number;
  clearedLegacyPlaintextCount: number;
}

export type AiConfigSecretBackfillSummary = Record<
  'aiModelConfig' | 'serperConfig' | 'hunterConfig',
  AiConfigSecretBackfillTableSummary
>;

const tables = ['aiModelConfig', 'serperConfig', 'hunterConfig'] as const;

/** Backfills encrypted provider keys and clears legacy plaintext values. */
export async function backfillAiConfigSecrets(
  database: AiConfigSecretBackfillDatabase,
  secretKey: string | undefined,
  options: AiConfigSecretBackfillOptions = {}
): Promise<AiConfigSecretBackfillSummary> {
  if (!secretKey) {
    throw new Error('AI_CONFIG_SECRET_ENCRYPTION_KEY is required to backfill AI config secrets');
  }
  assertSecretEncryptionKey(secretKey, aiConfigSecretCryptoOptions);

  const summary = createEmptySummary();

  for (const table of tables) {
    const records = await database[table].findMany({
      select: {
        id: true,
        apiKey: true,
        encryptedApiKey: true
      },
      where: {
        OR: [
          {
            encryptedApiKey: null,
            apiKey: { not: '' }
          },
          {
            encryptedApiKey: { not: null },
            apiKey: { not: '' }
          }
        ]
      }
    });

    summary[table].scannedCount = records.length;

    for (const record of records) {
      if (record.encryptedApiKey) {
        await clearLegacyPlaintext(database[table], record, options);
        summary[table].clearedLegacyPlaintextCount += 1;
        continue;
      }

      await encryptLegacyPlaintext(database[table], record, secretKey, options);
      summary[table].encryptedCount += 1;
    }
  }

  return summary;
}

function createEmptySummary(): AiConfigSecretBackfillSummary {
  return {
    aiModelConfig: createEmptyTableSummary(),
    serperConfig: createEmptyTableSummary(),
    hunterConfig: createEmptyTableSummary()
  };
}

function createEmptyTableSummary(): AiConfigSecretBackfillTableSummary {
  return {
    scannedCount: 0,
    encryptedCount: 0,
    clearedLegacyPlaintextCount: 0
  };
}

async function encryptLegacyPlaintext(
  delegate: AiConfigSecretBackfillDelegate,
  record: AiConfigSecretBackfillRow,
  secretKey: string,
  options: AiConfigSecretBackfillOptions
) {
  if (options.dryRun) {
    return;
  }

  await delegate.update({
    where: { id: record.id },
    data: {
      apiKey: '',
      encryptedApiKey: encryptSecret(record.apiKey, secretKey, aiConfigSecretCryptoOptions)
    }
  });
}

async function clearLegacyPlaintext(
  delegate: AiConfigSecretBackfillDelegate,
  record: AiConfigSecretBackfillRow,
  options: AiConfigSecretBackfillOptions
) {
  if (options.dryRun) {
    return;
  }

  await delegate.update({
    where: { id: record.id },
    data: {
      apiKey: ''
    }
  });
}
