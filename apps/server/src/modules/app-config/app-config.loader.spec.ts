import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { AppConfigService } from './app-config.service';
import { canRunSchedulers, canRunWorkers, loadAppConfig } from './app-config.loader';

const originalPort = process.env.PORT;
const originalCrmEnableMockEndpoints = process.env.CRM_ENABLE_MOCK_ENDPOINTS;

afterEach(() => {
  restoreEnv('PORT', originalPort);
  restoreEnv('CRM_ENABLE_MOCK_ENDPOINTS', originalCrmEnableMockEndpoints);
});

describe('loadAppConfig', () => {
  it('uses documented defaults outside production', () => {
    const config = loadAppConfig({});

    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.isProduction, false);
    assert.equal(config.serverRuntimeRole, 'all');
    assert.equal(config.port, 9528);
    assert.equal(config.serverCorsOrigins, null);
    assert.equal(config.databaseUrl, undefined);
    assert.equal(config.redisUrl, 'redis://127.0.0.1:6379');
    assert.equal(config.aiConfigSecretEncryptionKey, undefined);
    assert.equal(config.authAccessTokenTtlSeconds, 7200);
    assert.equal(config.authRefreshTokenTtlSeconds, 1209600);
    assert.equal(config.authDevFixedTokenEnabled, true);
    assert.equal(config.crmEnableMockEndpoints, false);
  });

  it('splits configured CORS origins by comma and trims blanks', () => {
    const config = loadAppConfig({
      SERVER_CORS_ORIGINS: ' https://admin.example.com,  http://localhost:3000 ,, https://ops.example.com '
    });

    assert.deepEqual(config.serverCorsOrigins, [
      'https://admin.example.com',
      'http://localhost:3000',
      'https://ops.example.com'
    ]);
  });

  it('forces dev fixed token off in production', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example/db',
      REDIS_URL: 'redis://example:6379',
      AUTH_DEV_FIXED_TOKEN_ENABLED: 'true'
    });

    assert.equal(config.isProduction, true);
    assert.equal(config.authDevFixedTokenEnabled, false);
  });

  it('forces CRM mock endpoints off in production', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example/db',
      REDIS_URL: 'redis://example:6379',
      CRM_ENABLE_MOCK_ENDPOINTS: 'true'
    });

    assert.equal(config.isProduction, true);
    assert.equal(config.crmEnableMockEndpoints, false);
  });

  it('normalizes boolean runtime flags from deploy platform strings', () => {
    const config = loadAppConfig({
      AUTH_DEV_FIXED_TOKEN_ENABLED: ' TRUE ',
      CRM_ENABLE_MOCK_ENDPOINTS: 'True'
    });

    assert.equal(config.authDevFixedTokenEnabled, true);
    assert.equal(config.crmEnableMockEndpoints, true);
  });

  it('uses auth TTL values from env', () => {
    const config = loadAppConfig({
      AUTH_ACCESS_TOKEN_TTL_SECONDS: '3600',
      AUTH_REFRESH_TOKEN_TTL_SECONDS: '2592000'
    });

    assert.equal(config.authAccessTokenTtlSeconds, 3600);
    assert.equal(config.authRefreshTokenTtlSeconds, 2592000);
  });

  it('rejects invalid numeric runtime config values during startup', () => {
    assert.throws(() => loadAppConfig({ PORT: 'NaN' }), /Invalid PORT/);
    assert.throws(() => loadAppConfig({ AUTH_ACCESS_TOKEN_TTL_SECONDS: '0' }), /Invalid AUTH_ACCESS_TOKEN_TTL_SECONDS/);
    assert.throws(
      () => loadAppConfig({ AUTH_REFRESH_TOKEN_TTL_SECONDS: '-1' }),
      /Invalid AUTH_REFRESH_TOKEN_TTL_SECONDS/
    );
  });

  it('reads the AI config secret encryption key from env', () => {
    const config = loadAppConfig({
      AI_CONFIG_SECRET_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef'
    });

    assert.equal(config.aiConfigSecretEncryptionKey, '0123456789abcdef0123456789abcdef');
  });

  it('reads the server runtime role from env', () => {
    assert.equal(loadAppConfig({ SERVER_RUNTIME_ROLE: 'api' }).serverRuntimeRole, 'api');
    assert.equal(loadAppConfig({ SERVER_RUNTIME_ROLE: 'worker' }).serverRuntimeRole, 'worker');
    assert.equal(loadAppConfig({ SERVER_RUNTIME_ROLE: 'scheduler' }).serverRuntimeRole, 'scheduler');
    assert.equal(loadAppConfig({ SERVER_RUNTIME_ROLE: 'all' }).serverRuntimeRole, 'all');
  });

  it('rejects invalid server runtime roles', () => {
    assert.throws(() => loadAppConfig({ SERVER_RUNTIME_ROLE: 'api,worker' }), /Invalid SERVER_RUNTIME_ROLE/);
  });

  it('requires production request-path infrastructure config', () => {
    assert.throws(() => loadAppConfig({ NODE_ENV: 'production' }), /DATABASE_URL/);
    assert.throws(
      () =>
        loadAppConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://example/db'
        }),
      /REDIS_URL/
    );

    const config = loadAppConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://example/db',
      REDIS_URL: 'redis://example:6379'
    });

    assert.equal(config.databaseUrl, 'postgresql://example/db');
    assert.equal(config.redisUrl, 'redis://example:6379');
  });
});

describe('runtime role helpers', () => {
  it('keeps all role compatible with local single-process startup', () => {
    const config = loadAppConfig({});

    assert.equal(canRunWorkers(config), true);
    assert.equal(canRunSchedulers(config), true);
  });

  it('separates API, worker, and scheduler runtime roles', () => {
    const apiConfig = loadAppConfig({ SERVER_RUNTIME_ROLE: 'api' });
    const workerConfig = loadAppConfig({ SERVER_RUNTIME_ROLE: 'worker' });
    const schedulerConfig = loadAppConfig({ SERVER_RUNTIME_ROLE: 'scheduler' });

    assert.equal(canRunWorkers(apiConfig), false);
    assert.equal(canRunSchedulers(apiConfig), false);
    assert.equal(canRunWorkers(workerConfig), true);
    assert.equal(canRunSchedulers(workerConfig), false);
    assert.equal(canRunWorkers(schedulerConfig), false);
    assert.equal(canRunSchedulers(schedulerConfig), true);
  });
});

describe('AppConfigService', () => {
  it('exposes the loaded config object', () => {
    process.env.PORT = '8080';
    process.env.CRM_ENABLE_MOCK_ENDPOINTS = 'true';
    const service = new AppConfigService();

    assert.equal(service.config.port, 8080);
    assert.equal(service.config.crmEnableMockEndpoints, true);
  });
});

function restoreEnv(key: 'PORT' | 'CRM_ENABLE_MOCK_ENDPOINTS', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
