import { Inject, Injectable, Optional } from '@nestjs/common';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CrmGmailAuthorizationExpiredError } from './crm-email-send.gateway';
import { CRM_EMAIL_SEND_GATEWAY, CRM_STORE } from './crm.tokens';
import type {
  CrmEmailSendGateway,
  CrmMailboxRecord,
  CrmSendDeliveryClaimRecord,
  CrmSendQueueJob,
  CrmStore
} from './crm.types';

const followUpDelayMsByStep = new Map([[2, 3 * 24 * 60 * 60 * 1000]]);

@Injectable()
export class CrmSendWorkerService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_EMAIL_SEND_GATEWAY) private readonly sendGateway: CrmEmailSendGateway,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService
  ) {}

  /** Processes one queued CRM email with persisted guards before mock/real sending. */
  async processSendJob(job: CrmSendQueueJob) {
    const item = await this.store.claimFirstMessageSendDelivery({
      ...job,
      claimedAt: new Date()
    });

    if (!item) {
      return;
    }

    try {
      const sent = await this.sendGateway.sendPlainText({
        enrollment: item.enrollment,
        message: item.firstMessage,
        account: item.account,
        contact: item.contact,
        mailbox: item.mailbox
      });
      const sentAt = new Date();
      await this.store.completeFirstMessageSend({
        enrollmentId: job.enrollmentId,
        messageId: job.messageId,
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        runVersion: job.runVersion,
        sentAt,
        providerMessageId: sent.providerMessageId ?? null,
        providerThreadId: sent.providerThreadId ?? null,
        nextMessage: buildNextFollowUpDraft(item, sent.providerThreadId ?? null, sentAt)
      });
    } catch (error) {
      if (error instanceof CrmGmailAuthorizationExpiredError) {
        await this.markMailboxAuthorizationExpired(item.mailbox, job, error);
        throw error;
      }

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

  private async markMailboxAuthorizationExpired(
    mailbox: CrmMailboxRecord,
    job: CrmSendQueueJob,
    error: CrmGmailAuthorizationExpiredError
  ) {
    const result = await this.store.markMailboxAuthorizationExpired({
      mailboxId: mailbox.id,
      organizationId: job.organizationId,
      ownerUserId: job.ownerUserId,
      reason: error.message,
      expiredAt: new Date()
    });

    if (!result) {
      return;
    }

    await this.systemNotificationService?.create({
      userId: result.mailbox.ownerUserId,
      userName: result.mailbox.ownerUserName,
      module: 'crm',
      type: 'crm_mailbox_auth_expired',
      title: 'Gmail 授权已失效',
      content: `${result.mailbox.maskedEmail} 授权已失效，已暂停该邮箱待发送邮件，请重新授权后再继续发送。`,
      targetType: 'crmMailbox',
      targetId: result.mailbox.id,
      routePath: '/crm/settings',
      metadata: {
        organizationId: result.mailbox.organizationId,
        mailboxId: result.mailbox.id,
        provider: result.mailbox.provider,
        maskedEmail: result.mailbox.maskedEmail
      }
    });
  }
}

function buildNextFollowUpDraft(
  item: CrmSendDeliveryClaimRecord,
  providerThreadId: string | null,
  sentAt: Date
): Parameters<CrmStore['completeFirstMessageSend']>[0]['nextMessage'] {
  const nextStepIndex = item.firstMessage.stepIndex + 1;

  if (nextStepIndex > item.enrollment.totalSteps) {
    return null;
  }

  const delayMs = followUpDelayMsByStep.get(nextStepIndex);

  if (!delayMs) {
    return null;
  }

  const contactName = item.contact.fullName || item.contact.title || 'there';
  const senderName = item.mailbox.ownerUserName || 'there';

  return {
    organizationId: item.firstMessage.organizationId,
    ownerUserId: item.firstMessage.ownerUserId,
    accountId: item.firstMessage.accountId,
    contactId: item.firstMessage.contactId,
    mailboxId: item.mailbox.id,
    stepIndex: nextStepIndex,
    threadMode: 'same_thread',
    subject: item.firstMessage.subject,
    bodyText: `Hi ${contactName},\n\nJust following up in case this is relevant for your current sourcing plan.\n\nBest regards,\n${senderName}`,
    status: 'draft_pending_review',
    scheduledAt: new Date(sentAt.getTime() + delayMs),
    providerThreadId
  };
}
