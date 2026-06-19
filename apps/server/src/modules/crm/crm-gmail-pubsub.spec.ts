import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { parseGmailPubSubPushPayload } from './crm-gmail-pubsub';

describe('parseGmailPubSubPushPayload', () => {
  it('parses a Gmail Pub/Sub push envelope', () => {
    const result = parseGmailPubSubPushPayload(
      createEnvelope({
        emailAddress: 'user@gmail.com',
        historyId: '123456'
      })
    );

    assert.equal(result.emailAddress, 'user@gmail.com');
    assert.equal(result.emailHash, sha256('user@gmail.com'));
    assert.equal(result.historyId, '123456');
    assert.equal(result.pubsubMessageId, 'message-1');
    assert.equal(result.publishTime?.toISOString(), '2026-06-19T08:00:00.000Z');
  });

  it('normalizes email casing and surrounding spaces before hashing', () => {
    const result = parseGmailPubSubPushPayload(
      createEnvelope({
        emailAddress: '  User.Name@GoogleMail.COM ',
        historyId: 7890
      })
    );

    assert.equal(result.emailAddress, 'user.name@googlemail.com');
    assert.equal(result.emailHash, sha256('user.name@googlemail.com'));
    assert.equal(result.historyId, '7890');
  });

  it('throws BadRequestException for malformed envelopes and missing Gmail fields', () => {
    assertBadRequest({});
    assertBadRequest({ message: {} });
    assertBadRequest(createEnvelope({ historyId: '1' }));
    assertBadRequest(createEnvelope({ emailAddress: 'user@gmail.com' }));
  });

  it('throws BadRequestException for non Gmail addresses', () => {
    assertBadRequest(
      createEnvelope({
        emailAddress: 'user@example.com',
        historyId: '123456'
      })
    );
  });

  it('throws BadRequestException for invalid base64 or non JSON data', () => {
    assertBadRequest({
      message: {
        data: 'not base64 data'
      }
    });
    assertBadRequest({
      message: {
        data: Buffer.from('not json').toString('base64')
      }
    });
  });
});

function createEnvelope(data: Record<string, unknown>) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: 'message-1',
      publishTime: '2026-06-19T08:00:00.000Z',
      attributes: {
        source: 'gmail-watch'
      }
    },
    subscription: 'projects/demo/subscriptions/gmail-watch'
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function assertBadRequest(payload: unknown) {
  assert.throws(() => parseGmailPubSubPushPayload(payload), BadRequestException);
}
