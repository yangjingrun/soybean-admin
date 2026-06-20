import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { assertSuper } from '../../../shared/permission-policy';
import { CRM_SEND_QUEUE, CRM_SEND_QUEUE_RECONCILE_REPOSITORY } from '../crm.tokens';
import type { CrmSendQueuePort, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizePositiveInteger } from '../shared/crm-normalizers';
import type { CrmSendQueueReconcileRepository } from './crm-send-queue-reconcile.repository';

@Injectable()
export class CrmSendQueueReconcileService {
  constructor(
    @Inject(CRM_SEND_QUEUE_RECONCILE_REPOSITORY)
    private readonly reconcileRepository: CrmSendQueueReconcileRepository,
    @Optional()
    @Inject(CRM_SEND_QUEUE)
    private readonly sendQueue?: Pick<CrmSendQueuePort, 'hasJob'>,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Repairs stale queued messages whose BullMQ job has disappeared. */
  async reconcileSendQueue(
    input: { now?: Date; staleMinutes?: number; take?: number } = {},
    context: CrmUserContext
  ) {
    assertSuper(context, '无权维护 CRM 发送队列');

    if (!this.sendQueue) {
      throw new BadRequestException('CRM 邮件发送队列未启用');
    }

    const now = input.now ?? new Date();
    const staleMinutes = normalizePositiveInteger(input.staleMinutes, 10, 1, 1440);
    const take = normalizePositiveInteger(input.take, 100, 1, 500);
    const before = new Date(now.getTime() - staleMinutes * 60 * 1000);
    const candidates = await this.reconcileRepository.listStaleQueuedMessages({
      before,
      take
    });
    let repairedCount = 0;
    let skippedCount = 0;

    for (const message of candidates) {
      if (!message.bullJobId) {
        skippedCount += 1;
        continue;
      }

      if (await this.sendQueue.hasJob(message.bullJobId)) {
        skippedCount += 1;
        continue;
      }

      const repaired = await this.reconcileRepository.updateMessage(
        message.id,
        message.organizationId,
        { status: 'draft_ready', bullJobId: null },
        { status: 'queued' }
      );

      if (!repaired) {
        skippedCount += 1;
        continue;
      }

      repairedCount += 1;
      await this.reconcileRepository.createTimelineEvent({
        organizationId: repaired.organizationId,
        accountId: repaired.accountId,
        contactId: repaired.contactId,
        ownerUserId: repaired.ownerUserId,
        eventType: 'send_queue_reconciled',
        title: '发送队列对账修复',
        content: '数据库 queued 但 BullMQ job 不存在，已回退为待发送草稿',
        metadata: {
          messageId: repaired.id,
          previousBullJobId: message.bullJobId,
          repairedAt: now.toISOString()
        }
      });
    }

    const result = {
      scannedCount: candidates.length,
      repairedCount,
      skippedCount
    };

    await this.crmLogger?.record('send-queue-reconcile', 'CRM 发送队列对账修复', context, {
      organizationId: context.organizationId,
      before: before.toISOString(),
      take,
      ...result
    });

    return result;
  }
}
