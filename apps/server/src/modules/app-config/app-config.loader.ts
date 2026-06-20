export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  serverRuntimeRole: ServerRuntimeRole;
  port: number;
  serverCorsOrigins: string[] | null;
  databaseUrl: string | undefined;
  redisUrl: string;
  aiConfigSecretEncryptionKey: string | undefined;
  authAccessTokenTtlSeconds: number;
  authRefreshTokenTtlSeconds: number;
  authDevFixedTokenEnabled: boolean;
  crmEnableMockEndpoints: boolean;
  crmGmailIntegrationEnv: {
    NODE_ENV?: string;
    CRM_GMAIL_OAUTH_CLIENT_ID?: string;
    CRM_GMAIL_OAUTH_CLIENT_SECRET?: string;
    CRM_GMAIL_OAUTH_REDIRECT_URI?: string;
    CRM_GMAIL_TOKEN_ENCRYPTION_KEY?: string;
    CRM_GMAIL_OAUTH_STATE_SECRET?: string;
    CRM_GMAIL_OAUTH_SCOPES?: string;
    CRM_GMAIL_PUBSUB_TOPIC_NAME?: string;
    CRM_GMAIL_PUBSUB_PUSH_SECRET?: string;
  };
}

export type ServerRuntimeRole = 'api' | 'worker' | 'scheduler' | 'all';

const DEFAULT_NODE_ENV = 'development';
const DEFAULT_PORT = 9528;
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
const DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS = 7200;
const DEFAULT_AUTH_REFRESH_TOKEN_TTL_SECONDS = 1209600;
const DEFAULT_SERVER_RUNTIME_ROLE: ServerRuntimeRole = 'all';
const serverRuntimeRoles = ['api', 'worker', 'scheduler', 'all'] as const satisfies readonly ServerRuntimeRole[];

/** Loads app-level runtime config from the provided environment map. */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV || DEFAULT_NODE_ENV;
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    serverRuntimeRole: readServerRuntimeRole(env.SERVER_RUNTIME_ROLE),
    port: readNumber(env.PORT, DEFAULT_PORT),
    serverCorsOrigins: readCsv(env.SERVER_CORS_ORIGINS),
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL || DEFAULT_REDIS_URL,
    aiConfigSecretEncryptionKey: env.AI_CONFIG_SECRET_ENCRYPTION_KEY,
    authAccessTokenTtlSeconds: readNumber(env.AUTH_ACCESS_TOKEN_TTL_SECONDS, DEFAULT_AUTH_ACCESS_TOKEN_TTL_SECONDS),
    authRefreshTokenTtlSeconds: readNumber(env.AUTH_REFRESH_TOKEN_TTL_SECONDS, DEFAULT_AUTH_REFRESH_TOKEN_TTL_SECONDS),
    // Dev fixed tokens are never available in production, even if env is misconfigured.
    authDevFixedTokenEnabled: isProduction ? false : readBoolean(env.AUTH_DEV_FIXED_TOKEN_ENABLED, true),
    crmEnableMockEndpoints: readBoolean(env.CRM_ENABLE_MOCK_ENDPOINTS, false),
    crmGmailIntegrationEnv: {
      NODE_ENV: nodeEnv,
      CRM_GMAIL_OAUTH_CLIENT_ID: env.CRM_GMAIL_OAUTH_CLIENT_ID,
      CRM_GMAIL_OAUTH_CLIENT_SECRET: env.CRM_GMAIL_OAUTH_CLIENT_SECRET,
      CRM_GMAIL_OAUTH_REDIRECT_URI: env.CRM_GMAIL_OAUTH_REDIRECT_URI,
      CRM_GMAIL_TOKEN_ENCRYPTION_KEY: env.CRM_GMAIL_TOKEN_ENCRYPTION_KEY,
      CRM_GMAIL_OAUTH_STATE_SECRET: env.CRM_GMAIL_OAUTH_STATE_SECRET,
      CRM_GMAIL_OAUTH_SCOPES: env.CRM_GMAIL_OAUTH_SCOPES,
      CRM_GMAIL_PUBSUB_TOPIC_NAME: env.CRM_GMAIL_PUBSUB_TOPIC_NAME,
      CRM_GMAIL_PUBSUB_PUSH_SECRET: env.CRM_GMAIL_PUBSUB_PUSH_SECRET
    }
  };
}

/** Returns whether this process should host BullMQ workers. */
export function canRunWorkers(config: Pick<AppConfig, 'serverRuntimeRole'> | undefined) {
  return isRuntimeRoleEnabled(config?.serverRuntimeRole, 'worker');
}

/** Returns whether this process should host schedulers and periodic maintenance tasks. */
export function canRunSchedulers(config: Pick<AppConfig, 'serverRuntimeRole'> | undefined) {
  return isRuntimeRoleEnabled(config?.serverRuntimeRole, 'scheduler');
}

function isRuntimeRoleEnabled(role: ServerRuntimeRole = DEFAULT_SERVER_RUNTIME_ROLE, target: 'worker' | 'scheduler') {
  return role === 'all' || role === target;
}

function readServerRuntimeRole(value: string | undefined): ServerRuntimeRole {
  if (value === undefined) {
    return DEFAULT_SERVER_RUNTIME_ROLE;
  }

  if (serverRuntimeRoles.includes(value as ServerRuntimeRole)) {
    return value as ServerRuntimeRole;
  }

  throw new Error(`Invalid SERVER_RUNTIME_ROLE: ${value}`);
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
