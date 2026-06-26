import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBatchGenerateCrmNextSequenceDraftsRequestConfig,
  buildCreateCrmAiDraftTaskRequestConfig,
  buildCreateCrmFirstOutreachAiDraftTaskRequestConfig,
  buildGenerateCrmNextSequenceDraftRequestConfig,
  buildRegenerateCrmMessageAiDraftRequestConfig,
  buildRetryFailedCrmAiDraftTaskRequestConfig,
  crmAiWritingRequestTimeout
} from './sequence.shared';

describe('crm sequence api helpers', () => {
  it('disables the common 10s timeout for CRM AI writing requests', () => {
    const batchPayload = { ids: ['enrollment-1'] };
    const aiDraftTaskPayload = { enrollmentIds: ['enrollment-1'] };
    const firstOutreachPayload = {
      targets: [{ accountId: 'account-1', contactId: 'contact-1' }],
      mailboxId: 'mailbox-1'
    };

    const configs = [
      buildRegenerateCrmMessageAiDraftRequestConfig('message-1'),
      buildGenerateCrmNextSequenceDraftRequestConfig('enrollment-1'),
      buildBatchGenerateCrmNextSequenceDraftsRequestConfig(batchPayload),
      buildCreateCrmAiDraftTaskRequestConfig(aiDraftTaskPayload),
      buildCreateCrmFirstOutreachAiDraftTaskRequestConfig(firstOutreachPayload),
      buildRetryFailedCrmAiDraftTaskRequestConfig('task-1')
    ];

    assert.equal(crmAiWritingRequestTimeout, 0);
    assert.equal(
      configs.every(config => config.timeout === crmAiWritingRequestTimeout),
      true
    );
  });
});
