import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildNextFollowUpDraft } from './crm-follow-up-draft';
import type { CrmGlobalConfigRecord, CrmMessageRecord, CrmSequenceReviewRecord } from './crm.types';

describe('crm-follow-up-draft', () => {
  it('builds a polite close step five without requiring a new signal', () => {
    const message = buildNextFollowUpDraft({
      item: createReviewItem(null),
      sourceMessage: createSourceMessage(),
      providerThreadId: 'thread-1',
      baseTime: new Date('2026-06-24T00:00:00.000Z'),
      followUpDelayDays: createFollowUpDelayDays(),
      templateGroup: null
    });

    assert.equal(message?.stepIndex, 5);
    assert.match(message?.bodyText ?? '', /close this sequence|better time to reconnect/i);
    assert.doesNotMatch(
      message?.bodyText ?? '',
      /last chance|urgent|checking in|short product overview|future reference/i
    );
  });

  it('uses the outreach strategy fallback instead of weak follow-up wording', () => {
    const message = buildNextFollowUpDraft({
      item: {
        ...createReviewItem(null),
        enrollment: { totalSteps: 2 } as CrmSequenceReviewRecord['enrollment']
      },
      sourceMessage: {
        ...createSourceMessage(),
        stepIndex: 1
      },
      providerThreadId: 'thread-1',
      baseTime: new Date('2026-06-24T00:00:00.000Z'),
      followUpDelayDays: createFollowUpDelayDays(),
      templateGroup: null
    });

    assert.equal(message?.stepIndex, 2);
    assert.doesNotMatch(message?.bodyText ?? '', /just following up|checking in|bumping/i);
    assert.match(message?.bodyText ?? '', /one current designation|cross-reference/i);
    assert.doesNotMatch(message?.bodyText ?? '', /2-3 regular options|short model list|short product list/i);
  });

  it('builds a role-specific choice-question step four', () => {
    const message = buildNextFollowUpDraft({
      item: {
        ...createReviewItem(null),
        enrollment: { totalSteps: 4, createdByName: 'Alice' } as CrmSequenceReviewRecord['enrollment']
      },
      sourceMessage: {
        ...createSourceMessage(),
        stepIndex: 3
      },
      providerThreadId: 'thread-1',
      baseTime: new Date('2026-06-24T00:00:00.000Z'),
      followUpDelayDays: createFollowUpDelayDays(),
      templateGroup: null
    });

    assert.equal(message?.stepIndex, 4);
    assert.match(message?.subject ?? '', /Which direction/i);
    assert.match(message?.bodyText ?? '', /A\. Compare one designation on price, MOQ, or lead time/);
    assert.match(message?.bodyText ?? '', /D\. Another colleague handles bearing purchasing/);
    assert.match(message?.bodyText ?? '', /E\. Not reviewing this now/);
    assert.match(message?.bodyText ?? '', /A letter is enough/);
  });

  it('uses enrollment display name and normalized first-name greeting for local follow-up drafts', () => {
    const message = buildNextFollowUpDraft({
      item: {
        ...createReviewItem(null),
        enrollment: { totalSteps: 2, createdByName: 'Yangjr' } as CrmSequenceReviewRecord['enrollment'],
        productLine: {
          name: '轴承',
          commonModelsText: '6000/6200/6300 系列深沟球轴承；302/303/322 系列圆锥滚子轴承'
        } as CrmSequenceReviewRecord['productLine']
      },
      sourceMessage: {
        ...createSourceMessage(),
        stepIndex: 1
      },
      providerThreadId: 'thread-1',
      baseTime: new Date('2026-06-24T00:00:00.000Z'),
      followUpDelayDays: createFollowUpDelayDays(),
      templateGroup: null
    });

    assert.match(message?.bodyText ?? '', /Hi Alex,/);
    assert.doesNotMatch(message?.bodyText ?? '', /Hi Alex Buyer,/);
    assert.match(message?.bodyText ?? '', /6000\/6200\/6300 deep groove ball bearings/);
    assert.doesNotMatch(message?.bodyText ?? '', /深沟球轴承|圆锥滚子轴承|系列/);
    assert.match(message?.bodyText ?? '', /Best,\nYangjr/);
  });
});

function createReviewItem(sourceSnapshot: Record<string, unknown> | null) {
  return {
    enrollment: { totalSteps: 5, createdByName: 'Alice' },
    account: {
      id: 'account-1',
      name: 'ABC Bearings',
      customerType: 'Distributor',
      sourceSnapshot
    },
    contact: {
      id: 'contact-1',
      fullName: 'Alex Buyer',
      title: 'Purchasing Manager'
    },
    productLine: null,
    policy: null,
    mailbox: null
  } as unknown as Pick<CrmSequenceReviewRecord, 'enrollment' | 'account' | 'contact' | 'productLine' | 'policy'> & {
    mailbox: null;
  };
}

function createSourceMessage(): CrmMessageRecord {
  return {
    id: 'message-4',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    mailboxId: 'mailbox-1',
    stepIndex: 4,
    subject: 'Previous note',
    bodyText: 'Previous body'
  } as unknown as CrmMessageRecord;
}

function createFollowUpDelayDays(): CrmGlobalConfigRecord['followUpDelayDays'] {
  return {
    step2Days: 3,
    step3Days: 8,
    step4Days: 12,
    step5Days: 18
  };
}
