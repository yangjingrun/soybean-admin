import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { parseGmailApiMessage } from './crm-gmail-message';

describe('parseGmailApiMessage', () => {
  it('parses a text/plain Gmail message into a history message', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Re: New supplier' },
            { name: 'From', value: 'Buyer <buyer@example.com>' }
          ],
          body: {
            data: encodeBase64Url('Thanks, please send the catalog.')
          }
        }
      })
    );

    assert.equal(result.providerMessageId, 'gmail-message-1');
    assert.equal(result.providerThreadId, 'gmail-thread-1');
    assert.equal(result.replyToProviderMessageId, null);
    assert.equal(result.subject, 'Re: New supplier');
    assert.equal(result.bodyText, 'Thanks, please send the catalog.');
    assert.equal(result.receivedAt.toISOString(), '2026-06-19T08:00:00.000Z');
    assert.equal(result.direction, 'inbound');
    assert.equal(result.messageType, 'customer_reply');
  });

  it('marks SENT-only Gmail messages as outbound history messages', () => {
    const result = parseGmailApiMessage(
      createMessage({
        labelIds: ['SENT'],
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'Subject', value: 'Re: New supplier' }],
          body: {
            data: encodeBase64Url('Thanks, I sent the catalog from Gmail.')
          }
        }
      })
    );

    assert.equal(result.direction, 'outbound');
    assert.equal(result.providerMessageId, 'gmail-message-1');
    assert.equal(result.providerThreadId, 'gmail-thread-1');
  });

  it('prefers nested text/plain over html content', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'multipart/alternative',
          headers: [{ name: 'Subject', value: 'Re: Product' }],
          parts: [
            {
              mimeType: 'text/html',
              body: {
                data: encodeBase64Url('<p>HTML body</p>')
              }
            },
            {
              mimeType: 'text/plain',
              body: {
                data: encodeBase64Url('Plain body')
              }
            }
          ]
        }
      })
    );

    assert.equal(result.bodyText, 'Plain body');
  });

  it('uses html text when a plain part is not present', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'text/html',
          headers: [{ name: 'Subject', value: 'Re: Product' }],
          body: {
            data: encodeBase64Url('<p>Hello&nbsp;&amp;&nbsp;thanks</p>')
          }
        }
      })
    );

    assert.equal(result.bodyText, 'Hello & thanks');
  });

  it('does not treat RFC In-Reply-To as a Gmail provider message id', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'Subject', value: 'Re: Product' },
            { name: 'In-Reply-To', value: '<rfc-message-id@example.com>' }
          ],
          body: {
            data: encodeBase64Url('Thread reply')
          }
        }
      })
    );

    assert.equal(result.replyToProviderMessageId, null);
    assert.equal(result.providerThreadId, 'gmail-thread-1');
  });

  it('classifies unsubscribe hints', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'Subject', value: 'Re: Product' }],
          body: {
            data: encodeBase64Url('Please remove me from your list.')
          }
        }
      })
    );

    assert.equal(result.messageType, 'unsubscribe_hint');
  });

  it('classifies vague rejection replies as pending unsubscribe review', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'Subject', value: 'Re: Product' }],
          body: {
            data: encodeBase64Url('Not interested right now, thanks.')
          }
        }
      })
    );

    assert.equal(result.messageType, 'unsubscribe_review_pending');
  });

  it('classifies delivery status messages as bounce', () => {
    const result = parseGmailApiMessage(
      createMessage({
        payload: {
          mimeType: 'multipart/report',
          headers: [
            { name: 'Subject', value: 'Delivery Status Notification (Failure)' },
            { name: 'From', value: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>' }
          ],
          parts: [
            {
              mimeType: 'message/delivery-status',
              body: {
                data: encodeBase64Url('Diagnostic-Code: smtp; 550 5.1.1 user unknown')
              }
            }
          ]
        }
      })
    );

    assert.equal(result.messageType, 'bounce');
  });

  it('throws BadRequestException for malformed required fields', () => {
    assert.throws(() => parseGmailApiMessage({ threadId: 'thread-1', internalDate: '1' }), BadRequestException);
    assert.throws(() => parseGmailApiMessage(createMessage({ internalDate: 'not-a-timestamp' })), BadRequestException);
    assert.throws(
      () =>
        parseGmailApiMessage(
          createMessage({
            payload: {
              mimeType: 'text/plain',
              body: {
                data: 'not base64url!'
              }
            }
          })
        ),
      BadRequestException
    );
  });
});

function createMessage(input: Record<string, unknown> = {}) {
  return {
    id: 'gmail-message-1',
    threadId: 'gmail-thread-1',
    internalDate: String(Date.parse('2026-06-19T08:00:00.000Z')),
    snippet: 'message snippet',
    labelIds: ['INBOX'],
    ...input
  };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}
