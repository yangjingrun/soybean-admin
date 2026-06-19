import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { describe, it } from 'node:test';
import { CrmGmailPubSubOidcVerifier } from './crm-gmail-pubsub-oidc.verifier';

describe('CrmGmailPubSubOidcVerifier', () => {
  it('accepts tokeninfo responses for the configured audience and service account', async () => {
    const calls: string[] = [];
    const verifier = new CrmGmailPubSubOidcVerifier(async url => {
      calls.push(url);

      return createTokenInfoResponse({
        aud: 'https://api.example.com/crm/gmail/pubsub/push',
        email: 'pubsub-push@example.iam.gserviceaccount.com',
        email_verified: 'true',
        iss: 'https://accounts.google.com'
      });
    });

    await verifier.verify({
      token: 'oidc-token-1',
      audience: 'https://api.example.com/crm/gmail/pubsub/push',
      serviceAccountEmail: 'pubsub-push@example.iam.gserviceaccount.com'
    });

    assert.equal(calls[0], 'https://oauth2.googleapis.com/tokeninfo?id_token=oidc-token-1');
  });

  it('rejects tokeninfo responses with mismatched claims', async () => {
    const verifier = new CrmGmailPubSubOidcVerifier(async () =>
      createTokenInfoResponse({
        aud: 'https://other.example.com/webhook',
        email: 'pubsub-push@example.iam.gserviceaccount.com',
        email_verified: 'true',
        iss: 'https://accounts.google.com'
      })
    );

    await assert.rejects(
      () =>
        verifier.verify({
          token: 'oidc-token-1',
          audience: 'https://api.example.com/crm/gmail/pubsub/push',
          serviceAccountEmail: 'pubsub-push@example.iam.gserviceaccount.com'
        }),
      UnauthorizedException
    );
  });
});

function createTokenInfoResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  } as Response;
}
