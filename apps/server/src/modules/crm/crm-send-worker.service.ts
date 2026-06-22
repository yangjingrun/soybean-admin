import { Inject, Injectable, Optional } from '@nestjs/common';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CrmGmailAuthorizationExpiredError } from './crm-email-send.gateway';
import { buildNextFollowUpDraft } from './crm-follow-up-draft';
import { CrmSendAvailabilityService } from './crm-send-availability.service';
import type { CrmSendWorkerRepository } from './crm-send-worker.repository';
import { CRM_EMAIL_SEND_GATEWAY, CRM_SEND_WORKER_REPOSITORY } from './crm.tokens';
import type {
  CrmEmailSendGateway,
  CrmEmailTemplateGroupRecord,
  CrmGlobalConfigRecord,
  CrmMailboxRecord,
  CrmSendDeliveryClaimRecord,
  CrmSendQueueJob
} from './crm.types';

interface NextFollowUpDraftContext {
  followUpDelayDays: CrmGlobalConfigRecord['followUpDelayDays'];
  templateGroup: CrmEmailTemplateGroupRecord | null;
}

@Injectable()
export class CrmSendWorkerService {
  constructor(
    @Inject(CRM_SEND_WORKER_REPOSITORY) private readonly store: CrmSendWorkerRepository,
    @Inject(CRM_EMAIL_SEND_GATEWAY) private readonly sendGateway: CrmEmailSendGateway,
    private readonly availabilityService: CrmSendAvailabilityService,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService
  ) {}

  /** Processes one queued CRM email with persisted guards before mock/real sending. */
  async processSendJob(job: CrmSendQueueJob, now = new Date()) {
    const target = await this.store.findQueuedMessageSendTarget(job);

    if (!target) {
      return;
    }

    const availability = this.availabilityService.evaluate({
      now,
      country: target.account.country ?? '',
      timeZone: target.account.timeZone,
      city: target.account.city
    });

    if (!availability.canSend) {
      if (availability.nextAvailableAt) {
        await this.store.deferQueuedMessageSend({
          ...job,
          scheduledAt: availability.nextAvailableAt
        });
      }

      return;
    }

    const item = await this.store.claimFirstMessageSendDelivery({
      ...job,
      claimedAt: now
    });

    if (!item) {
      return;
    }

    try {
      const nextDraftContext = await this.prepareNextFollowUpDraftContext(item);
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
        nextMessage: this.buildNextFollowUpDraft(item, nextDraftContext, sent.providerThreadId ?? null, sentAt)
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

  /** Loads local follow-up context before the external send to keep retryable jobs idempotent. */
  private async prepareNextFollowUpDraftContext(
    item: CrmSendDeliveryClaimRecord
  ): Promise<NextFollowUpDraftContext | null> {
    if (item.firstMessage.stepIndex + 1 > item.enrollment.totalSteps) {
      return null;
    }

    const [globalConfig, defaultTemplateGroup] = await Promise.all([
      this.store.getGlobalConfig(),
      this.store.findDefaultEmailTemplateGroup(item.enrollment.organizationId)
    ]);

    return {
      followUpDelayDays: globalConfig.followUpDelayDays,
      templateGroup: defaultTemplateGroup
    };
  }

  private buildNextFollowUpDraft(
    item: CrmSendDeliveryClaimRecord,
    context: NextFollowUpDraftContext | null,
    providerThreadId: string | null,
    sentAt: Date
  ) {
    if (!context) {
      return null;
    }

    return buildNextFollowUpDraft({
      item,
      sourceMessage: item.firstMessage,
      providerThreadId,
      baseTime: sentAt,
      followUpDelayDays: context.followUpDelayDays,
      templateGroup: context.templateGroup
    });
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
