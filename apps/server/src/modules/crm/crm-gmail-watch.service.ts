import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CRM_GMAIL_HISTORY_SYNC_QUEUE, CRM_GMAIL_WATCH_GATEWAY, CRM_GMAIL_WATCH_REPOSITORY } from './crm.tokens';
import type { CrmGmailWatchRepository } from './crm-gmail-watch.repository';
import { CrmGmailAuthorizationExpiredError, type CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import { createCrmOwnerFilter } from './shared/crm-scope';
import { toMailboxView } from './shared/crm-view-mappers';
import type { CrmGmailHistorySyncQueuePort, CrmMailboxRecord, CrmUserContext } from './crm.types';

@Injectable()
export class CrmGmailWatchService {
  constructor(
    @Inject(CRM_GMAIL_WATCH_REPOSITORY) private readonly store: CrmGmailWatchRepository,
    @Inject(CRM_GMAIL_WATCH_GATEWAY) private readonly gateway: CrmGmailWatchGateway,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService,
    @Optional()
    @Inject(CRM_GMAIL_HISTORY_SYNC_QUEUE)
    private readonly historySyncQueue?: CrmGmailHistorySyncQueuePort
  ) {}

  /** Renews Gmail watch for a scoped active mailbox without advancing an initialized checkpoint. */
  async renewMailboxWatch(id: string, context: CrmUserContext) {
    const mailbox = await this.store.findMailboxById({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException('邮箱未启用');
    }

    const renewal = await this.renewWatchOrMarkAuthorizationExpired(mailbox, context);
    const updatedMailbox = await this.store.updateMailbox(mailbox.id, {
      watchExpiration: renewal.watchExpiration,
      ...(mailbox.lastHistoryId ? {} : { lastHistoryId: renewal.historyId })
    });

    if (!updatedMailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    await this.recordWatchLog(context, updatedMailbox, renewal);

    return {
      mailbox: toMailboxView(updatedMailbox),
      watch: {
        historyId: renewal.historyId,
        watchExpiration: renewal.watchExpiration.toISOString()
      }
    };
  }

  /** Renews Gmail watch and enqueues an immediate incremental sync without advancing the checkpoint early. */
  async syncMailboxNow(id: string, context: CrmUserContext) {
    const mailbox = await this.requireActiveScopedMailbox(id, context);
    const renewal = await this.renewWatchOrMarkAuthorizationExpired(mailbox, context);
    const fromHistoryId = mailbox.lastHistoryId;
    const shouldReinitializeCheckpoint = hasHistoryExpiredSyncIssue(mailbox);
    const updatedMailbox = await this.store.updateMailbox(mailbox.id, {
      watchExpiration: renewal.watchExpiration,
      ...(!fromHistoryId || shouldReinitializeCheckpoint ? { lastHistoryId: renewal.historyId } : {}),
      ...(shouldReinitializeCheckpoint
        ? {
            syncIssueType: null,
            syncIssueAt: null,
            syncIssueMessage: null
          }
        : {})
    });

    if (!updatedMailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    await this.recordWatchLog(context, updatedMailbox, renewal);

    if (shouldReinitializeCheckpoint || !fromHistoryId || isHistoryIdAtOrBefore(renewal.historyId, fromHistoryId)) {
      return {
        mailbox: toMailboxView(updatedMailbox),
        watch: {
          historyId: renewal.historyId,
          watchExpiration: renewal.watchExpiration.toISOString()
        },
        sync: {
          queued: false,
          reason: shouldReinitializeCheckpoint
            ? 'checkpoint_reinitialized'
            : fromHistoryId
              ? 'already_current'
              : 'checkpoint_initialized',
          fromHistoryId,
          toHistoryId: renewal.historyId
        }
      };
    }

    const queue = this.requireHistorySyncQueue();
    const { jobId } = await queue.enqueueHistorySync({
      mailboxId: mailbox.id,
      organizationId: mailbox.organizationId,
      ownerUserId: mailbox.ownerUserId,
      emailAddress: mailbox.emailAddress,
      emailHash: mailbox.emailHash,
      historyId: renewal.historyId,
      pubsubMessageId: null,
      publishTime: null
    });

    return {
      mailbox: toMailboxView(updatedMailbox),
      watch: {
        historyId: renewal.historyId,
        watchExpiration: renewal.watchExpiration.toISOString()
      },
      sync: {
        queued: true,
        jobId,
        fromHistoryId,
        toHistoryId: renewal.historyId
      }
    };
  }

  private async requireActiveScopedMailbox(id: string, context: CrmUserContext) {
    const mailbox = await this.store.findMailboxById({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException('邮箱未启用');
    }

    return mailbox;
  }

  private async renewWatchOrMarkAuthorizationExpired(mailbox: CrmMailboxRecord, context: CrmUserContext) {
    try {
      return await this.gateway.renewWatch({ mailbox });
    } catch (error) {
      if (!(error instanceof CrmGmailAuthorizationExpiredError)) {
        throw error;
      }

      await this.markMailboxAuthorizationExpired(mailbox, context, error);
      throw new BadRequestException('Gmail 授权已失效，请重新授权');
    }
  }

  private requireHistorySyncQueue() {
    if (!this.historySyncQueue) {
      throw new BadRequestException('Gmail 同步队列未配置');
    }

    return this.historySyncQueue;
  }

  private async markMailboxAuthorizationExpired(
    mailbox: CrmMailboxRecord,
    context: CrmUserContext,
    error: CrmGmailAuthorizationExpiredError
  ) {
    const updatedMailbox = await this.store.updateMailbox(mailbox.id, {
      status: 'auth_expired',
      watchExpiration: null
    });

    if (!updatedMailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    await Promise.all([
      this.systemNotificationService?.create({
        userId: updatedMailbox.ownerUserId,
        userName: updatedMailbox.ownerUserName,
        module: 'crm',
        type: 'crm_mailbox_auth_expired',
        title: 'Gmail 授权已失效',
        content: `${updatedMailbox.maskedEmail} 授权已失效，请重新授权后再继续发送和同步。`,
        targetType: 'crmMailbox',
        targetId: updatedMailbox.id,
        routePath: '/crm/settings',
        metadata: {
          organizationId: updatedMailbox.organizationId,
          mailboxId: updatedMailbox.id,
          provider: updatedMailbox.provider,
          maskedEmail: updatedMailbox.maskedEmail
        }
      }),
      this.recordAuthorizationExpiredLog(context, updatedMailbox, error)
    ]);
  }

  private recordWatchLog(
    context: CrmUserContext,
    mailbox: CrmMailboxRecord,
    renewal: { historyId: string; watchExpiration: Date }
  ) {
    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action: 'gmail-watch-renew',
      message: 'CRM Gmail watch 续订完成',
      userId: context.userId,
      userName: context.userName,
      metadata: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        provider: mailbox.provider,
        maskedEmail: mailbox.maskedEmail,
        historyId: renewal.historyId,
        watchExpiration: renewal.watchExpiration.toISOString()
      }
    });
  }

  private recordAuthorizationExpiredLog(
    context: CrmUserContext,
    mailbox: CrmMailboxRecord,
    error: CrmGmailAuthorizationExpiredError
  ) {
    return this.systemLogService?.record({
      level: 'warn',
      status: 'failed',
      module: 'crm',
      action: 'gmail-auth-expired',
      message: 'CRM Gmail 授权失效',
      userId: context.userId,
      userName: context.userName,
      errorMessage: error.message,
      metadata: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        provider: mailbox.provider,
        maskedEmail: mailbox.maskedEmail,
        toStatus: mailbox.status
      }
    });
  }
}

function isHistoryIdAtOrBefore(historyId: string, lastHistoryId: string) {
  return BigInt(historyId) <= BigInt(lastHistoryId);
}

function hasHistoryExpiredSyncIssue(mailbox: CrmMailboxRecord) {
  return mailbox.syncIssueType === 'history_expired';
}
