import { CrmGmailApiEmailSendGateway, MockCrmEmailSendGateway } from './crm-email-send.gateway';
import { CrmGmailApiHistoryGateway, MockCrmGmailHistoryGateway } from './crm-gmail-history.gateway';
import { CrmGmailOAuthFlow } from './crm-gmail-oauth-flow';
import { CrmGmailOAuthTokenProvider } from './crm-gmail-oauth-token.provider';
import { CrmGmailApiWatchGateway, MockCrmGmailWatchGateway } from './crm-gmail-watch.gateway';

const gmailHistorySyncScopes = new Set([
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata'
]);

export interface CrmGmailIntegrationEnv {
  NODE_ENV?: string;
  CRM_GMAIL_OAUTH_CLIENT_ID?: string;
  CRM_GMAIL_OAUTH_CLIENT_SECRET?: string;
  CRM_GMAIL_OAUTH_REDIRECT_URI?: string;
  CRM_GMAIL_TOKEN_ENCRYPTION_KEY?: string;
  CRM_GMAIL_OAUTH_STATE_SECRET?: string;
  CRM_GMAIL_OAUTH_SCOPES?: string;
  CRM_GMAIL_PUBSUB_TOPIC_NAME?: string;
  CRM_GMAIL_PUBSUB_PUSH_SECRET?: string;
}

/** Creates the Gmail integration providers from platform env without leaking secrets to logs or clients. */
export function createCrmGmailIntegrationProviders(env: CrmGmailIntegrationEnv) {
  assertProductionGmailConfig(env);

  const tokenConfig = createTokenConfig(env);
  const oauthConfig = tokenConfig ? createOAuthFlowConfig(env, tokenConfig) : null;
  const scopes = parseOAuthScopes(env.CRM_GMAIL_OAUTH_SCOPES);
  const supportsHistorySync = canUseGmailHistorySync(scopes);
  const topicName = normalizeEnvString(env.CRM_GMAIL_PUBSUB_TOPIC_NAME);
  const tokenProvider = tokenConfig ? new CrmGmailOAuthTokenProvider(tokenConfig) : null;
  const historyGateway =
    tokenProvider && supportsHistorySync
      ? new CrmGmailApiHistoryGateway(tokenProvider)
      : new MockCrmGmailHistoryGateway();
  const emailSendGateway = tokenProvider
    ? new CrmGmailApiEmailSendGateway(tokenProvider)
    : new MockCrmEmailSendGateway();
  const watchGateway =
    tokenProvider && topicName && supportsHistorySync
      ? new CrmGmailApiWatchGateway(tokenProvider, { topicName })
      : new MockCrmGmailWatchGateway();

  return {
    oauthFlow: oauthConfig ? new CrmGmailOAuthFlow(oauthConfig) : null,
    tokenProvider,
    historyGateway,
    emailSendGateway,
    watchGateway
  };
}

function assertProductionGmailConfig(env: CrmGmailIntegrationEnv) {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const requiredKeys: Array<keyof CrmGmailIntegrationEnv> = [
    'CRM_GMAIL_OAUTH_CLIENT_ID',
    'CRM_GMAIL_OAUTH_CLIENT_SECRET',
    'CRM_GMAIL_OAUTH_REDIRECT_URI',
    'CRM_GMAIL_TOKEN_ENCRYPTION_KEY',
    'CRM_GMAIL_OAUTH_STATE_SECRET'
  ];
  const scopes = parseOAuthScopes(env.CRM_GMAIL_OAUTH_SCOPES);

  if (canUseGmailHistorySync(scopes)) {
    requiredKeys.push('CRM_GMAIL_PUBSUB_TOPIC_NAME', 'CRM_GMAIL_PUBSUB_PUSH_SECRET');
  }

  const missingKeys = requiredKeys.filter(key => !normalizeEnvString(env[key]));

  if (missingKeys.length > 0) {
    throw new Error(`CRM Gmail production config missing: ${missingKeys.join(', ')}`);
  }
}

function createTokenConfig(env: CrmGmailIntegrationEnv) {
  const clientId = normalizeEnvString(env.CRM_GMAIL_OAUTH_CLIENT_ID);
  const clientSecret = normalizeEnvString(env.CRM_GMAIL_OAUTH_CLIENT_SECRET);
  const tokenEncryptionKey = normalizeEnvString(env.CRM_GMAIL_TOKEN_ENCRYPTION_KEY);

  if (!clientId || !clientSecret || !tokenEncryptionKey) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    tokenEncryptionKey
  };
}

function createOAuthFlowConfig(
  env: CrmGmailIntegrationEnv,
  tokenConfig: NonNullable<ReturnType<typeof createTokenConfig>>
) {
  const redirectUri = normalizeEnvString(env.CRM_GMAIL_OAUTH_REDIRECT_URI);
  const stateSecret = normalizeEnvString(env.CRM_GMAIL_OAUTH_STATE_SECRET);
  const scopes = parseOAuthScopes(env.CRM_GMAIL_OAUTH_SCOPES);

  if (!redirectUri || !stateSecret) {
    return null;
  }

  return {
    ...tokenConfig,
    redirectUri,
    stateSecret,
    ...(scopes.length ? { scopes } : {})
  };
}

function normalizeEnvString(value?: string) {
  const normalized = value?.trim();
  return normalized || null;
}

function parseOAuthScopes(value?: string) {
  return (
    normalizeEnvString(value)
      ?.split(/[\s,]+/)
      .map(scope => scope.trim())
      .filter(Boolean) ?? []
  );
}

function canUseGmailHistorySync(scopes: string[]) {
  if (scopes.length === 0) {
    return true;
  }

  return scopes.some(scope => gmailHistorySyncScopes.has(scope));
}
