import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CrmGmailApiEmailSendGateway, MockCrmEmailSendGateway } from './crm-email-send.gateway';
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
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('creates real Gmail providers in production only when all required config is present', () => {
    const providers = createCrmGmailIntegrationProviders({
      NODE_ENV: 'production',
      ...createEnv()
    });

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.tokenProvider instanceof CrmGmailOAuthTokenProvider);
    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof CrmGmailApiWatchGateway);
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('fails fast in production when required Gmail config is missing', () => {
    assert.throws(
      () =>
        createCrmGmailIntegrationProviders({
          NODE_ENV: 'production',
          ...createEnv(),
          CRM_GMAIL_TOKEN_ENCRYPTION_KEY: '',
          CRM_GMAIL_PUBSUB_TOPIC_NAME: '',
          CRM_GMAIL_PUBSUB_PUSH_SECRET: ' '
        }),
      /CRM Gmail production config missing: CRM_GMAIL_TOKEN_ENCRYPTION_KEY, CRM_GMAIL_PUBSUB_TOPIC_NAME, CRM_GMAIL_PUBSUB_PUSH_SECRET/
    );
  });

  it('allows production send-only Gmail mode without Pub/Sub config', () => {
    const providers = createCrmGmailIntegrationProviders({
      NODE_ENV: 'production',
      ...createEnv(),
      CRM_GMAIL_OAUTH_SCOPES:
        'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
      CRM_GMAIL_PUBSUB_TOPIC_NAME: '',
      CRM_GMAIL_PUBSUB_PUSH_SECRET: ''
    });

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.tokenProvider instanceof CrmGmailOAuthTokenProvider);
    assert.ok(providers.historyGateway instanceof MockCrmGmailHistoryGateway);
    assert.ok(providers.watchGateway instanceof MockCrmGmailWatchGateway);
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('still requires Pub/Sub config in production full-sync Gmail mode', () => {
    assert.throws(
      () =>
        createCrmGmailIntegrationProviders({
          NODE_ENV: 'production',
          ...createEnv(),
          CRM_GMAIL_OAUTH_SCOPES:
            'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
          CRM_GMAIL_PUBSUB_TOPIC_NAME: '',
          CRM_GMAIL_PUBSUB_PUSH_SECRET: ''
        }),
      /CRM Gmail production config missing: CRM_GMAIL_PUBSUB_TOPIC_NAME, CRM_GMAIL_PUBSUB_PUSH_SECRET/
    );
  });

  it('keeps watch mocked when Pub/Sub topic is not configured but still enables Gmail sending', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_PUBSUB_TOPIC_NAME: ''
    });

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof MockCrmGmailWatchGateway);
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('uses send-only Gmail mode when configured scopes cannot read mailbox history', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_OAUTH_SCOPES:
        'https://www.googleapis.com/auth/gmail.send, https://www.googleapis.com/auth/userinfo.email'
    });

    assert.ok(providers.oauthFlow instanceof CrmGmailOAuthFlow);
    assert.ok(providers.tokenProvider instanceof CrmGmailOAuthTokenProvider);
    assert.ok(providers.historyGateway instanceof MockCrmGmailHistoryGateway);
    assert.ok(providers.watchGateway instanceof MockCrmGmailWatchGateway);
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('keeps real watch and history gateways when configured scopes include Gmail modify', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_OAUTH_SCOPES: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send'
    });

    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof CrmGmailApiWatchGateway);
    assert.ok(providers.emailSendGateway instanceof CrmGmailApiEmailSendGateway);
  });

  it('ignores blank custom Gmail OAuth scope entries and keeps the default full sync mode', () => {
    const providers = createCrmGmailIntegrationProviders({
      ...createEnv(),
      CRM_GMAIL_OAUTH_SCOPES: ' ,  '
    });

    assert.ok(providers.historyGateway instanceof CrmGmailApiHistoryGateway);
    assert.ok(providers.watchGateway instanceof CrmGmailApiWatchGateway);
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
    assert.ok(providers.emailSendGateway instanceof MockCrmEmailSendGateway);
  });
});

function createEnv() {
  return {
    CRM_GMAIL_OAUTH_CLIENT_ID: 'client-id-1',
    CRM_GMAIL_OAUTH_CLIENT_SECRET: 'client-secret-1',
    CRM_GMAIL_OAUTH_REDIRECT_URI: 'https://app.example.com/crm/gmail-oauth-callback',
    CRM_GMAIL_TOKEN_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
    CRM_GMAIL_OAUTH_STATE_SECRET: 'state-secret-1',
    CRM_GMAIL_PUBSUB_TOPIC_NAME: 'projects/example-project/topics/gmail-push',
    CRM_GMAIL_PUBSUB_PUSH_SECRET: 'push-secret-1'
  };
}
