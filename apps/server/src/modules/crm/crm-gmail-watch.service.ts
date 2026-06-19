import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { CRM_GMAIL_WATCH_GATEWAY, CRM_STORE } from './crm.tokens';
import type { CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord, CrmStore, CrmUserContext } from './crm.types';

@Injectable()
export class CrmGmailWatchService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Inject(CRM_GMAIL_WATCH_GATEWAY) private readonly gateway: CrmGmailWatchGateway,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder
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

    const renewal = await this.gateway.renewWatch({ mailbox });
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
