import { Inject, Injectable } from '@nestjs/common';
import { CRM_EMAIL_SEND_GATEWAY, CRM_STORE } from './crm.tokens';
import type { CrmEmailSendGateway, CrmSendQueueJob, CrmStore } from './crm.types';

@Injectable()
export class CrmSendWorkerService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_EMAIL_SEND_GATEWAY) private readonly sendGateway: CrmEmailSendGateway
  ) {}

  /** Processes one queued CRM email with persisted guards before mock/real sending. */
  async processSendJob(job: CrmSendQueueJob) {
    const item = await this.store.getSequenceReviewItem({
      id: job.enrollmentId,
      organizationId: job.organizationId,
      ownerUserId: job.ownerUserId
    });

    if (!item || item.enrollment.runVersion !== job.runVersion || item.firstMessage?.id !== job.messageId) {
      return;
    }

    if (
      item.enrollment.status !== 'sequence_running' ||
      item.firstMessage.status !== 'queued' ||
      item.mailbox?.status !== 'active'
    ) {
      return;
    }

    try {
      await this.sendGateway.sendPlainText({
        enrollment: item.enrollment,
        message: item.firstMessage,
        account: item.account,
        contact: item.contact,
        mailbox: item.mailbox
      });
      await this.store.completeFirstMessageSend({
        enrollmentId: job.enrollmentId,
        messageId: job.messageId,
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        runVersion: job.runVersion,
        sentAt: new Date()
      });
    } catch (error) {
      await this.store.failFirstMessageSend({
        enrollmentId: job.enrollmentId,
        messageId: job.messageId,
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        runVersion: job.runVersion,
        reason: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
