export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  serverCorsOrigins: string[] | null;
  databaseUrl: string | undefined;
  redisUrl: string;
  authAccessTokenTtlSeconds: number;
  authRefreshTokenTtlSeconds: number;
  authDevFixedTokenEnabled: boolean;
  crmEnableMockEndpoints: boolean;
}

const DEFAULT_NODE_ENV = 'development';
const DEFAULT_PORT = 9528;
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
const DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS = 7200;
const DEFAULT_AUTH_REFRESH_TOKEN_TTL_SECONDS = 1209600;

/** Loads app-level runtime config from the provided environment map. */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV || DEFAULT_NODE_ENV;
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: readNumber(env.PORT, DEFAULT_PORT),
    serverCorsOrigins: readCsv(env.SERVER_CORS_ORIGINS),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL || DEFAULT_REDIS_URL,
    authAccessTokenTtlSeconds: readNumber(env.AUTH_ACCESS_TOKEN_TTL_SECONDS, DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS),
    authRefreshTokenTtlSeconds: readNumber(env.AUTH_REFRESH_TOKEN_TTL_SECONDS, DEFAULT_AUTH_REFRESH_TOKEN_TTL_SECONDS),
    // Dev fixed tokens are never available in production, even if env is misconfigured.
    authDevFixedTokenEnabled: isProduction ? false : readBoolean(env.AUTH_DEV_FIXED_TOKEN_ENABLED, true),
    crmEnableMockEndpoints: readBoolean(env.CRM_ENABLE_MOCK_ENDPOINTS, false)
  };
}

function readCsv(value: string | undefined) {
  const items = value
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return items?.length ? items : null;
}

function readNumber(value: string | undefined, defaultValue: number) {
  return value === undefined ? defaultValue : Number(value);
}

function readBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === 'true';
}
