import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CrmMessageRecord, CrmUserContext } from '../crm.types';
import { CrmMessageDraftApprovalRouterService } from './crm-message-draft-approval-router.service';

describe('CrmMessageDraftApprovalRouterService', () => {
  it('routes first-touch draft approval to the initial approval service', async () => {
    const calls: string[] = [];
    const service = createService({
      message: createMessage({ stepIndex: 1 }),
      initialApproval: {
        async approveInitialMessageDraft(id) {
          calls.push(`initial:${id}`);

          return { ok: true };
        }
      }
    });

    const result = await service.approveMessageDraft('message-1', createContext());

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, ['initial:message-1']);
  });

  it('routes follow-up draft approval to the follow-up approval service', async () => {
    const calls: string[] = [];
    const service = createService({
      message: createMessage({ stepIndex: 2 }),
      followUpApproval: {
        async approveFollowUpMessageDraft(id) {
          calls.push(`follow-up:${id}`);

          return { ok: true };
        }
      }
    });

    const result = await service.approveMessageDraft('message-1', createContext());

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, ['follow-up:message-1']);
  });

  it('rejects missing owner drafts with the existing not-found semantic', async () => {
    const service = createService({ message: null });

    await assert.rejects(() => service.approveMessageDraft('missing', createContext()), NotFoundException);
  });

  it('rejects non-editable drafts before routing approval', async () => {
    const service = createService({ message: createMessage({ status: 'draft_ready' }) });

    await assert.rejects(() => service.approveMessageDraft('message-1', createContext()), BadRequestException);
  });
});

function createService(input: {
  message?: CrmMessageRecord | null;
  initialApproval?: { approveInitialMessageDraft(id: string, context: CrmUserContext): Promise<unknown> };
  followUpApproval?: { approveFollowUpMessageDraft(id: string, context: CrmUserContext): Promise<unknown> };
}) {
  return new CrmMessageDraftApprovalRouterService(
    {
      async findMessageById() {
        return input.message === undefined ? createMessage() : input.message;
      }
    },
    (input.initialApproval ?? {
      async approveInitialMessageDraft() {
        throw new Error('initial approval should not be called');
      }
    }) as never,
    (input.followUpApproval ?? {
      async approveFollowUpMessageDraft() {
        throw new Error('follow-up approval should not be called');
      }
    }) as never
  );
}

function createContext(): CrmUserContext {
  return {
    userId: 'user-1',
    userName: 'Alice',
    roles: ['R_USER'],
    organizationId: 'org-1',
    organizationRole: 'member'
  };
}

function createMessage(overrides: Partial<CrmMessageRecord> = {}): CrmMessageRecord {
  return {
    id: 'message-1',
    organizationId: 'org-1',
    enrollmentId: 'enrollment-1',
    accountId: 'account-1',
    contactId: 'contact-1',
    ownerUserId: 'user-1',
    mailboxId: null,
    stepIndex: 1,
    threadMode: 'same_thread',
    status: 'draft_pending_review',
    subject: 'Hello',
    bodyText: 'Body',
    providerMessageId: null,
    providerThreadId: null,
    metadata: null,
    scheduledAt: null,
    sentAt: null,
    bullJobId: null,
    createdAt: new Date('2026-06-18T09:00:00.000Z'),
    updatedAt: new Date('2026-06-18T09:00:00.000Z'),
    ...overrides,
    recipientTimeZone: overrides.recipientTimeZone ?? null
  };
}
