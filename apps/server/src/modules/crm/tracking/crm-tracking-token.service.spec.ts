import assert from 'node:assert/strict';
import test from 'node:test';
import { CrmTrackingTokenService } from './crm-tracking-token.service';

test('CrmTrackingTokenService signs and verifies message ids', () => {
  const service = new CrmTrackingTokenService(createConfig('secret-1'));

  const token = service.signMessageId('message-1');

  assert.equal(service.verifyMessageToken(token), 'message-1');
});

test('CrmTrackingTokenService rejects tampered tokens', () => {
  const service = new CrmTrackingTokenService(createConfig('secret-1'));
  const token = service.signMessageId('message-1');
  const [, signature] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ v: 1, messageId: 'message-2' })).toString('base64url');
  const tampered = `${tamperedPayload}.${signature}`;

  assert.equal(service.verifyMessageToken(tampered), null);
});

test('CrmTrackingTokenService requires a configured secret', () => {
  const service = new CrmTrackingTokenService(createConfig(undefined));

  assert.throws(() => service.signMessageId('message-1'), /CRM_TRACKING_TOKEN_SECRET/);
  assert.equal(service.verifyMessageToken('invalid'), null);
});

function createConfig(secret: string | undefined) {
  return {
    config: {
      crmTrackingTokenSecret: secret
    }
  };
}
