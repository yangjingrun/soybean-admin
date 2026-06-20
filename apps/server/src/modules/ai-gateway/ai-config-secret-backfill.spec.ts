import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptSecret } from '../../shared/secret-crypto';
import {
  backfillAiConfigSecrets,
  type AiConfigSecretBackfillDatabase,
  type AiConfigSecretBackfillDelegate,
  type AiConfigSecretBackfillRow,
  type AiConfigSecretBackfillUpdateArgs
} from './ai-config-secret-backfill';

const secretKey = '0123456789abcdef0123456789abcdef';

describe('ai-config-secret-backfill', () => {
  it('encrypts legacy plaintext keys and clears the legacy column', async () => {
    const aiModelConfig = createDelegate([{ id: 'model-1', apiKey: 'model-key', encryptedApiKey: null }]);
    const serperConfig = createDelegate([{ id: 'serper-1', apiKey: 'serper-key', encryptedApiKey: null }]);
    const hunterConfig = createDelegate([{ id: 'hunter-1', apiKey: 'hunter-key', encryptedApiKey: null }]);

    const summary = await backfillAiConfigSecrets({ aiModelConfig, serperConfig, hunterConfig }, secretKey);

    assert.equal(summary.aiModelConfig.encryptedCount, 1);
    assert.equal(summary.serperConfig.encryptedCount, 1);
    assert.equal(summary.hunterConfig.encryptedCount, 1);
    assert.equal(aiModelConfig.rows[0].apiKey, '');
    assert.ok(aiModelConfig.rows[0].encryptedApiKey);
    assert.equal(aiModelConfig.rows[0].encryptedApiKey.includes('model-key'), false);
    assert.equal(decryptSecret(aiModelConfig.rows[0].encryptedApiKey, secretKey), 'model-key');
  });

  it('clears leftover plaintext when encrypted values already exist', async () => {
    const encryptedApiKey = 'v1:encrypted';
    const aiModelConfig = createDelegate([{ id: 'model-1', apiKey: 'legacy-copy', encryptedApiKey }]);
    const database = createDatabase({ aiModelConfig });

    const summary = await backfillAiConfigSecrets(database, secretKey);

    assert.equal(summary.aiModelConfig.encryptedCount, 0);
    assert.equal(summary.aiModelConfig.clearedLegacyPlaintextCount, 1);
    assert.equal(aiModelConfig.rows[0].apiKey, '');
    assert.equal(aiModelConfig.rows[0].encryptedApiKey, encryptedApiKey);
  });

  it('does not update records during dry run', async () => {
    const aiModelConfig = createDelegate([{ id: 'model-1', apiKey: 'model-key', encryptedApiKey: null }]);
    const database = createDatabase({ aiModelConfig });

    const summary = await backfillAiConfigSecrets(database, secretKey, { dryRun: true });

    assert.equal(summary.aiModelConfig.scannedCount, 1);
    assert.equal(summary.aiModelConfig.encryptedCount, 1);
    assert.equal(aiModelConfig.rows[0].apiKey, 'model-key');
    assert.equal(aiModelConfig.updates.length, 0);
  });

  it('requires an encryption key before scanning records', async () => {
    const database = createDatabase();

    await assert.rejects(() => backfillAiConfigSecrets(database, undefined), /AI_CONFIG_SECRET_ENCRYPTION_KEY/);
    await assert.rejects(() => backfillAiConfigSecrets(database, 'short-key'), /AI config secret encryption key/);
  });
});

function createDatabase(
  input: Partial<Record<keyof AiConfigSecretBackfillDatabase, TestBackfillDelegate>> = {}
): AiConfigSecretBackfillDatabase {
  return {
    aiModelConfig: input.aiModelConfig ?? createDelegate([]),
    serperConfig: input.serperConfig ?? createDelegate([]),
    hunterConfig: input.hunterConfig ?? createDelegate([])
  };
}

interface TestBackfillDelegate extends AiConfigSecretBackfillDelegate {
  rows: AiConfigSecretBackfillRow[];
  updates: AiConfigSecretBackfillUpdateArgs[];
}

function createDelegate(rows: AiConfigSecretBackfillRow[]): TestBackfillDelegate {
  return {
    rows,
    updates: [],
    async findMany() {
      return rows.filter(record => record.apiKey !== '');
    },
    async update(args) {
      this.updates.push(args);
      const record = rows.find(item => item.id === args.where.id);
      assert.ok(record, `Missing test record: ${args.where.id}`);
      record.apiKey = args.data.apiKey;
      record.encryptedApiKey = args.data.encryptedApiKey ?? record.encryptedApiKey;
    }
  };
}
