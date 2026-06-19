import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailApiHistoryGateway, MockCrmGmailHistoryGateway } from './crm-gmail-history.gateway';
import { CrmGmailOAuthFlow } from './crm-gmail-oauth-flow';
import { CrmGmailOAuthTokenProvider } from './crm-gmail-oauth-token.provider';
import { createCrmGmailIntegrationProviders } from './crm-gmail-provider.factory';
import { CrmGmailApiWatchGateway, MockCrmGmailWatchGateway } from './crm-gmail-watch.gateway';

describe('createCrmGmailIntegrationProviders', () => {
  it('creates real Gmail OAuth, token, history and watch providers when all platform config is present', () => {
    const providers = createCrmGmailIntegrationProviders(createEnv());

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.tokenProvider instanceof CrmGmailOAuthTokenProvider);
    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof CrmGmailApiWatchGateway);
  });

  it('keeps watch mocked when Pub/Sub topic is not configured', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_PUBSUB_TOPIC_NAME: ''
    });

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof MockCrmGmailWatchGateway);
  });

  it('falls back to null OAuth flow and mocked Gmail gateways when token config is incomplete', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_TOKEN_ENCRYPTION_KEY: ''
    });

    assert.equal(providers.oauthFlow, null);
    assert.equal(providers.tokenProvider, null);
    assert.ok(providers.historyGateway instanceof MockCrmGmailHistoryGateway);
    assert.ok(providers.watchGateway instanceof MockCrmGmailWatchGateway);
  });
});

function createEnv() {
  return {
    CRM_GMAIL_OAUTH_CLIENT_ID: 'client-id-1',
    CRM_GMAIL_OAUTH_CLIENT_SECRET: 'client-secret-1',
    CRM_GMAIL_OAUTH_REDIRECT_URI: 'https://app.example.com/crm/gmail-oauth-callback',
    CRM_GMAIL_TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
    CRM_GMAIL_OAUTH_STATE_SECRET: 'state-secret-1',
    CRM_GMAIL_PUBSUB_TOPIC_NAME: 'projects/example-project/topics/gmail-push'
  };
}
