import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { AppConfigService } from './app-config.service';
import { loadAppConfig } from './app-config.loader';

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
    assert.equal(config.port, 9528);
    assert.equal(config.serverCorsOrigins, null);
    assert.equal(config.databaseUrl, undefined);
    assert.equal(config.redisUrl, 'redis://127.0.0.1:6379');
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
      AUTH_DEV_FIXED_TOKEN_ENABLED: 'true'
    });

    assert.equal(config.isProduction, true);
    assert.equal(config.authDevFixedTokenEnabled, false);
  });

  it('uses auth TTL values from env', () => {
    const config = loadAppConfig({
      AUTH_ACCESS_TOKEN_TTL_SECONDS: '3600',
      AUTH_REFRESH_TOKEN_TTL_SECONDS: '2592000'
    });

    assert.equal(config.authAccessTokenTtlSeconds, 3600);
    assert.equal(config.authRefreshTokenTtlSeconds, 2592000);
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
