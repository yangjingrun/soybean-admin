import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CRM_GMAIL_WATCH_GATEWAY, CRM_STORE } from './crm.tokens';
import { CrmGmailAuthorizationExpiredError, type CrmGmailWatchGateway } from './crm-gmail-watch.gateway';
import type { CrmMailboxRecord, CrmStore } from './crm.types';

const defaultRenewalIntervalMs = 6 * 60 * 60 * 1000;
const defaultRenewalWindowMs = 24 * 60 * 60 * 1000;
const defaultRenewalBatchSize = 50;

export interface CrmGmailWatchRenewalResult {
  checkedCount: number;
  renewedCount: number;
  authorizationExpiredCount: number;
  failedCount: number;
}

@Injectable()
export class CrmGmailWatchRenewalService implements OnModuleInit, OnModuleDestroy {
  private renewalRunning = false;
  private renewalTimer: ReturnType<typeof setInterval> | null = null;

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

  onModuleInit() {
    if (isWatchRenewalDisabled()) {
      return;
    }

    void this.runScheduledRenewal();
    this.renewalTimer = setInterval(() => {
      void this.runScheduledRenewal();
    }, getPositiveEnvNumber('CRM_GMAIL_WATCH_RENEWAL_INTERVAL_MS', defaultRenewalIntervalMs));
    this.renewalTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  /** Renews active Gmail watches that are missing or close to expiration without advancing live checkpoints. */
  async renewDueMailboxWatches(now = new Date()): Promise<CrmGmailWatchRenewalResult> {
    const renewBefore = new Date(now.getTime() + getPositiveEnvNumber('CRM_GMAIL_WATCH_RENEWAL_WINDOW_MS', defaultRenewalWindowMs));
    const mailboxes = await this.store.listMailboxesForWatchRenewal({
      provider: 'gmail',
      renewBefore,
      take: getPositiveEnvNumber('CRM_GMAIL_WATCH_RENEWAL_BATCH_SIZE', defaultRenewalBatchSize)
    });
    const result: CrmGmailWatchRenewalResult = {
      checkedCount: mailboxes.length,
      renewedCount: 0,
      authorizationExpiredCount: 0,
      failedCount: 0
    };

    for (const mailbox of mailboxes) {
      try {
        const renewal = await this.gateway.renewWatch({ mailbox });
        const updated = await this.store.updateMailbox(mailbox.id, {
          watchExpiration: renewal.watchExpiration,
          ...(mailbox.lastHistoryId ? {} : { lastHistoryId: renewal.historyId })
        });

        if (updated) {
          result.renewedCount += 1;
          await this.recordRenewalLog(updated, renewal);
        } else {
          result.failedCount += 1;
          await this.recordRenewalFailureLog(mailbox, 'mailbox_update_conflict');
        }
      } catch (error) {
        if (error instanceof CrmGmailAuthorizationExpiredError) {
          result.authorizationExpiredCount += 1;
          await this.markMailboxAuthorizationExpired(mailbox, error);
          continue;
        }

        result.failedCount += 1;
        await this.recordRenewalFailureLog(mailbox, error instanceof Error ? error.message : String(error));
      }
    }

    if (result.checkedCount > 0) {
      await this.recordRenewalSummaryLog(result);
    }

    return result;
  }

  private async runScheduledRenewal() {
    if (this.renewalRunning) {
      return;
    }

    this.renewalRunning = true;

    try {
      await this.renewDueMailboxWatches();
    } catch (error) {
      await this.recordScheduledRenewalFailureLog(error instanceof Error ? error.message : String(error));
    } finally {
      this.renewalRunning = false;
    }
  }

  private async markMailboxAuthorizationExpired(mailbox: CrmMailboxRecord, error: CrmGmailAuthorizationExpiredError) {
    const expired = await this.store.markMailboxAuthorizationExpired({
      mailboxId: mailbox.id,
      organizationId: mailbox.organizationId,
      ownerUserId: mailbox.ownerUserId,
      reason: error.message,
      expiredAt: new Date()
    });

    if (!expired) {
      await this.recordRenewalFailureLog(mailbox, 'authorization_expired_update_conflict');
      return;
    }

    await Promise.all([
      this.systemNotificationService?.create({
        userId: expired.mailbox.ownerUserId,
        userName: expired.mailbox.ownerUserName,
        module: 'crm',
        type: 'crm_mailbox_auth_expired',
        title: 'Gmail 授权已失效',
        content: `${expired.mailbox.maskedEmail} 授权已失效，已暂停该邮箱待发送邮件，请重新授权后再继续发送和同步。`,
        targetType: 'crmMailbox',
        targetId: expired.mailbox.id,
        routePath: '/crm/settings',
        metadata: {
          organizationId: expired.mailbox.organizationId,
          mailboxId: expired.mailbox.id,
          provider: expired.mailbox.provider,
          maskedEmail: expired.mailbox.maskedEmail,
          pausedEnrollmentCount: expired.pausedEnrollmentCount,
          resetMessageCount: expired.resetMessageCount
        }
      }),
      this.systemLogService?.record({
        level: 'warn',
        status: 'failed',
        module: 'crm',
        action: 'gmail-watch-auto-renew-auth-expired',
        message: 'CRM Gmail watch 自动续订发现授权失效',
        userId: expired.mailbox.ownerUserId,
        userName: expired.mailbox.ownerUserName ?? undefined,
        errorMessage: error.message,
        metadata: {
          organizationId: expired.mailbox.organizationId,
          mailboxId: expired.mailbox.id,
          provider: expired.mailbox.provider,
          maskedEmail: expired.mailbox.maskedEmail,
          pausedEnrollmentCount: expired.pausedEnrollmentCount,
          resetMessageCount: expired.resetMessageCount
        }
      })
    ]);
  }

  private recordRenewalLog(mailbox: CrmMailboxRecord, renewal: { historyId: string; watchExpiration: Date }) {
    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action: 'gmail-watch-auto-renew',
      message: 'CRM Gmail watch 自动续订完成',
      userId: mailbox.ownerUserId,
      userName: mailbox.ownerUserName ?? undefined,
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

  private recordRenewalFailureLog(mailbox: CrmMailboxRecord, reason: string) {
    return this.systemLogService?.record({
      level: 'warn',
      status: 'failed',
      module: 'crm',
      action: 'gmail-watch-auto-renew-failed',
      message: 'CRM Gmail watch 自动续订失败',
      userId: mailbox.ownerUserId,
      userName: mailbox.ownerUserName ?? undefined,
      errorMessage: reason,
      metadata: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        provider: mailbox.provider,
        maskedEmail: mailbox.maskedEmail
      }
    });
  }

  private recordRenewalSummaryLog(result: CrmGmailWatchRenewalResult) {
    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action: 'gmail-watch-auto-renew-summary',
      message: 'CRM Gmail watch 自动续订批次完成',
      metadata: result
    });
  }

  private recordScheduledRenewalFailureLog(reason: string) {
    return this.systemLogService?.record({
      level: 'error',
      status: 'failed',
      module: 'crm',
      action: 'gmail-watch-auto-renew-scheduled-failed',
      message: 'CRM Gmail watch 自动续订调度失败',
      errorMessage: reason,
      metadata: {
        reason
      }
    });
  }
}

function isWatchRenewalDisabled() {
  return process.env.CRM_GMAIL_WATCH_RENEWAL_DISABLED?.trim().toLowerCase() === 'true';
}

function getPositiveEnvNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
