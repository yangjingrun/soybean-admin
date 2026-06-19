import { CrmGmailApiHistoryGateway, MockCrmGmailHistoryGateway } from './crm-gmail-history.gateway';
import { CrmGmailOAuthFlow } from './crm-gmail-oauth-flow';
import { CrmGmailOAuthTokenProvider } from './crm-gmail-oauth-token.provider';
import { CrmGmailApiWatchGateway, MockCrmGmailWatchGateway } from './crm-gmail-watch.gateway';

export interface CrmGmailIntegrationEnv {
  CRM_GMAIL_OAUTH_CLIENT_ID?: string;
  CRM_GMAIL_OAUTH_CLIENT_SECRET?: string;
  CRM_GMAIL_OAUTH_REDIRECT_URI?: string;
  CRM_GMAIL_TOKEN_ENCRYPTION_KEY?: string;
  CRM_GMAIL_OAUTH_STATE_SECRET?: string;
  CRM_GMAIL_PUBSUB_TOPIC_NAME?: string;
}

/** Creates the Gmail integration providers from platform env without leaking secrets to logs or clients. */
export function createCrmGmailIntegrationProviders(env: CrmGmailIntegrationEnv) {
  const tokenConfig = createTokenConfig(env);
  const oauthConfig = tokenConfig ? createOAuthFlowConfig(env, tokenConfig) : null;
  const topicName = normalizeEnvString(env.CRM_GMAIL_PUBSUB_TOPIC_NAME);
  const tokenProvider = tokenConfig ? new CrmGmailOAuthTokenProvider(tokenConfig) : null;
  const historyGateway = tokenProvider ? new CrmGmailApiHistoryGateway(tokenProvider) : new MockCrmGmailHistoryGateway();
  const watchGateway =
    tokenProvider && topicName
      ? new CrmGmailApiWatchGateway(tokenProvider, { topicName })
      : new MockCrmGmailWatchGateway();

  return {
    oauthFlow: oauthConfig ? new CrmGmailOAuthFlow(oauthConfig) : null,
    tokenProvider,
    historyGateway,
    watchGateway
  };
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

  if (!redirectUri || !stateSecret) {
    return null;
  }

  return {
    ...tokenConfig,
    redirectUri,
    stateSecret
  };
}

function normalizeEnvString(value?: string) {
  const normalized = value?.trim();
  return normalized || null;
}
