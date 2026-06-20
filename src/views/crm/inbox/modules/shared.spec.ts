import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInboxReplyDraftMetadataItems,
  findPendingUnsubscribeReviewMessage,
  inboxMessageTypeLabelMap,
  inboxMessageTypeTagTypeMap
} from './shared';

describe('crm inbox shared helpers', () => {
  function createMessage(overrides: Partial<Api.Crm.InboxMessageRecord> = {}): Api.Crm.InboxMessageRecord {
    return {
      id: 'message-1',
      accountId: 'account-1',
      bodyText: 'Please send details.',
      contactId: 'contact-1',
      createdAt: '2026-06-20T08:00:00.000Z',
      direction: 'inbound',
      enrollmentId: null,
      fromEmail: 'buyer@example.com',
      fromEmailHash: 'hash-1',
      mailboxId: 'mailbox-1',
      maskedFromEmail: 'b***@example.com',
      messageType: 'customer_reply',
      organizationId: 'org-1',
      ownerUserId: 'owner-1',
      provider: 'gmail',
      providerMessageId: 'gmail-message-1',
      receivedAt: '2026-06-20T08:00:00.000Z',
      replyToMessageId: null,
      sentAt: null,
      snippet: 'Please send details.',
      subject: 'Re: Quote',
      threadId: 'thread-1',
      updatedAt: '2026-06-20T08:00:00.000Z',
      ...overrides
    };
  }

  it('builds AI reply draft metadata display items with risk notes', () => {
    const items = buildInboxReplyDraftMetadataItems({
      generated: true,
      reason: 'Kept reply concise and avoided unsupported claims.',
      riskNotes: ['确认交期后再承诺', '不要直接报价'],
      productLineId: 'product-line-1',
      productLineName: 'Bearing',
      generatedAt: '2026-06-20T08:00:00.000Z'
    });

    assert.deepEqual(items, [
      { key: 'reason', label: '润色说明', value: 'Kept reply concise and avoided unsupported claims.' },
      { key: 'risk-0', label: '风险提示 1', value: '确认交期后再承诺' },
      { key: 'risk-1', label: '风险提示 2', value: '不要直接报价' },
      { key: 'product-line', label: '产品资料', value: 'Bearing' }
    ]);
  });

  it('omits empty AI reply draft metadata fields', () => {
    assert.deepEqual(
      buildInboxReplyDraftMetadataItems({
        generated: true,
        reason: '',
        riskNotes: [],
        productLineId: null,
        productLineName: null
      }),
      []
    );
  });

  it('labels unsubscribe review pending messages separately', () => {
    assert.equal(inboxMessageTypeLabelMap.unsubscribe_review_pending, '疑似退订');
    assert.equal(inboxMessageTypeTagTypeMap.unsubscribe_review_pending, 'warning');
  });

  it('finds the latest inbound unsubscribe message that still needs review', () => {
    const firstPending = createMessage({
      id: 'pending-1',
      messageType: 'unsubscribe_review_pending',
      receivedAt: '2026-06-20T08:00:00.000Z'
    });
    const outboundPending = createMessage({
      id: 'outbound-pending',
      direction: 'outbound',
      messageType: 'unsubscribe_review_pending',
      receivedAt: null,
      sentAt: '2026-06-20T08:30:00.000Z'
    });
    const latestPending = createMessage({
      id: 'pending-2',
      messageType: 'unsubscribe_review_pending',
      receivedAt: '2026-06-20T09:00:00.000Z'
    });

    assert.equal(findPendingUnsubscribeReviewMessage([firstPending, outboundPending, latestPending])?.id, 'pending-2');
  });
});
