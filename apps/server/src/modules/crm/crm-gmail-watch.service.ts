import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CRM_GMAIL_WATCH_GATEWAY, CRM_STORE } from './crm.tokens';
import { CrmGmailAuthorizationExpiredError, type CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord, CrmStore, CrmUserContext } from './crm.types';

@Injectable()
export class CrmGmailWatchService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_GMAIL_WATCH_GATEWAY) private readonly gateway: CrmGmailWatchGateway,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService
  ) {}

  /** Renews Gmail watch for a scoped active mailbox and stores the returned checkpoint. */
  async renewMailboxWatch(id: string, context: CrmUserContext) {
    const mailbox = await this.store.findMailboxById({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
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
      lastHistoryId: renewal.historyId
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

function toMailboxView(record: CrmMailboxRecord) {
  return {
    ...record,
    authorizedAt: record.authorizedAt.toISOString(),
    watchExpiration: record.watchExpiration?.toISOString() ?? null,
    pausedAt: record.pausedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toOwnerScope(context: CrmUserContext) {
  return isOrganizationAdmin(context) ? {} : { ownerUserId: context.userId };
}

function isOrganizationAdmin(context: CrmUserContext) {
  return context.organizationRole === 'admin' || context.roles.includes('R_SUPER');
}
