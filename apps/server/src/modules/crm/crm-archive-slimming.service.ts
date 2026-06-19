import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { CRM_STORE } from './crm.tokens';
import type { CrmStore } from './crm.types';

const defaultArchiveRecoveryMs = 30 * 24 * 60 * 60 * 1000;
const defaultSlimmingIntervalMs = 24 * 60 * 60 * 1000;
const defaultSlimmingBatchSize = 100;

export interface CrmArchiveSlimmingResult {
  checkedCount: number;
  slimmedCount: number;
  failedCount: number;
}

@Injectable()
export class CrmArchiveSlimmingService implements OnModuleInit, OnModuleDestroy {
  private slimmingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder
  ) {}

  onModuleInit() {
    if (isArchiveSlimmingDisabled()) {
      return;
    }

    void this.slimDueArchivedAccounts();
    this.slimmingTimer = setInterval(() => {
      void this.slimDueArchivedAccounts();
    }, getPositiveEnvNumber('CRM_ARCHIVE_SLIMMING_INTERVAL_MS', defaultSlimmingIntervalMs));
    this.slimmingTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.slimmingTimer) {
      clearInterval(this.slimmingTimer);
      this.slimmingTimer = null;
    }
  }

  /** Slims archived account fields after the recovery window while preserving dedupe-critical identity. */
  async slimDueArchivedAccounts(now = new Date()): Promise<CrmArchiveSlimmingResult> {
    const archivedBefore = new Date(now.getTime() - defaultArchiveRecoveryMs);
    const accounts = await this.store.listAccountsForArchiveSlimming({
      archivedBefore,
      take: getPositiveEnvNumber('CRM_ARCHIVE_SLIMMING_BATCH_SIZE', defaultSlimmingBatchSize)
    });
    const result: CrmArchiveSlimmingResult = {
      checkedCount: accounts.length,
      failedCount: 0,
      slimmedCount: 0
    };

    for (const account of accounts) {
      const slimmed = await this.store.slimArchivedAccount({
        id: account.id,
        organizationId: account.organizationId,
        archivedBefore,
        slimmedAt: now
      });

      if (slimmed) {
        result.slimmedCount += 1;
      } else {
        result.failedCount += 1;
      }
    }

    if (result.checkedCount > 0) {
      await this.recordSummaryLog(result, archivedBefore);
    }

    return result;
  }

  private recordSummaryLog(result: CrmArchiveSlimmingResult, archivedBefore: Date) {
    return this.systemLogService?.record({
      level: result.failedCount > 0 ? 'warn' : 'info',
      status: result.failedCount > 0 ? 'failed' : 'success',
      module: 'crm',
      action: 'archive-slimming-summary',
      message: 'CRM 归档线索自动瘦身完成',
      metadata: {
        ...result,
        archivedBefore: archivedBefore.toISOString()
      }
    });
  }
}

function isArchiveSlimmingDisabled() {
  return process.env.CRM_ARCHIVE_SLIMMING_DISABLED === 'true';
}

function getPositiveEnvNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}
