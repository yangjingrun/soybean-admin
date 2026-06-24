import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInboxReplySubmitPayload,
  buildInboxReplyDraftMetadataItems,
  canRestoreInboxReplyPolishSnapshot,
  createInboxReplyPolishSnapshot,
  findPendingUnsubscribeReviewMessage,
  formatInboxMessageBody,
  inboxPageGuide,
  inboxMessageTypeLabelMap,
  inboxMessageTypeTagTypeMap,
  inboxThreadStatusLabelMap
} from './shared';
describe('crm inbox shared helpers', () => {
  function createMessage(overrides = {}) {
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
    assert.equal(inboxPageGuide.title, '客户回信承接开发信结果');
    assert.match(inboxPageGuide.description, /待处理回信/);
    assert.match(inboxPageGuide.description, /不再联系名单/);
    assert.equal(inboxThreadStatusLabelMap.pending, '待处理回信');
    assert.equal(inboxThreadStatusLabelMap.archived, '已忽略');
    assert.equal(inboxMessageTypeLabelMap.unsubscribe_review_pending, '疑似拒绝/退订');
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
  it('validates reply sending inputs and builds the API payload', () => {
    assert.deepEqual(buildInboxReplySubmitPayload({ canOperate: false, topic: 'Quote', bodyText: 'Thanks' }), {
      ok: false,
      message: '当前账号不可发送该回复'
    });
    assert.deepEqual(buildInboxReplySubmitPayload({ canOperate: true, topic: ' ', bodyText: 'Thanks' }), {
      ok: false,
      message: '请先填写回复主题或要点'
    });
    assert.deepEqual(buildInboxReplySubmitPayload({ canOperate: true, topic: 'Quote', bodyText: ' ' }), {
      ok: false,
      message: '回复正文不能为空'
    });
    assert.deepEqual(buildInboxReplySubmitPayload({ canOperate: true, topic: ' Quote ', bodyText: ' Thanks ' }), {
      ok: true,
      payload: { bodyText: 'Thanks' }
    });
  });
  it('formats inbox message bodies for drawer display', () => {
    assert.equal(
      formatInboxMessageBody(
        'Hi&nbsp;陈思远,\r\n\r\n\r\nI&amp;nbsp;noticed&amp;nbsp;深圳智拓&amp;nbsp;in&amp;nbsp;中国\r\n&lt;yjr0196@gmail.com&gt;\r\n'
      ),
      'Hi 陈思远,\n\nI noticed 深圳智拓 in 中国\n<yjr0196@gmail.com>'
    );
  });
  it('creates an undo snapshot that can only restore the same inbox thread', () => {
    const snapshot = createInboxReplyPolishSnapshot({
      threadId: 'thread-1',
      topic: 'Original topic',
      bodyText: 'Original body'
    });
    assert.deepEqual(snapshot, {
      threadId: 'thread-1',
      topic: 'Original topic',
      bodyText: 'Original body'
    });
    assert.equal(canRestoreInboxReplyPolishSnapshot(snapshot, 'thread-1'), true);
    assert.equal(canRestoreInboxReplyPolishSnapshot(snapshot, 'thread-2'), false);
    assert.equal(canRestoreInboxReplyPolishSnapshot(null, 'thread-1'), false);
  });
});
