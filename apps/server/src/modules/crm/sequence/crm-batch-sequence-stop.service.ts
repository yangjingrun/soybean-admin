import { Inject, Injectable, Optional } from '@nestjs/common';
import { CRM_SEQUENCE_REPOSITORY } from '../crm.tokens';
import type { CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import type { CrmBatchSequenceStopRepository } from './crm-batch-sequence-stop.repository';
import { stoppableSequenceStatuses } from './crm-sequence-control-rules';
import {
  createSequenceBatchExceptionResult,
  createSequenceBatchResult,
  runSequenceBatch,
  type SequenceBatchOperateResult,
  type SequenceBatchOperationInput
} from './crm-sequence-batch';

@Injectable()
export class CrmBatchSequenceStopService {
  constructor(
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly sequenceStopRepository: CrmBatchSequenceStopRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Stops eligible owner sequences and invalidates queued jobs by bumping runVersion. */
  async batchStopSequenceEnrollments(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    return runSequenceBatch(input.ids, async id => {
      const item = await this.sequenceStopRepository.getSequenceReviewItem({
        id,
        organizationId: context.organizationId,
        ownerUserId: context.userId
      });

      if (!item) {
        return createSequenceBatchResult(id, 'skipped', '邮件序列不存在或无权操作');
      }

      if (!stoppableSequenceStatuses.includes(item.enrollment.status)) {
        return createSequenceBatchResult(id, 'skipped', '当前序列状态不能停止', {
          enrollmentId: item.enrollment.id
        });
      }

      try {
        const stopped = await this.sequenceStopRepository.stopSequenceEnrollment({
          enrollmentId: item.enrollment.id,
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          fromStatuses: stoppableSequenceStatuses,
          accountStatus: 'paused',
          actorUserId: context.userId
        });

        if (!stopped) {
          return createSequenceBatchResult(id, 'skipped', '当前序列状态已变化，请刷新后重试', {
            enrollmentId: item.enrollment.id
          });
        }

        await this.crmLogger?.record('sequence-stopped', 'CRM 开发信序列已停止', context, {
          organizationId: context.organizationId,
          accountId: stopped.account.id,
          contactId: stopped.enrollment.contactId,
          enrollmentId: stopped.enrollment.id,
          messageId: stopped.message?.id ?? item.firstMessage?.id ?? null,
          fromStatus: item.enrollment.status,
          toStatus: stopped.enrollment.status,
          runVersion: stopped.enrollment.runVersion
        });

        return createSequenceBatchResult(id, 'success', '开发信序列已停止', {
          enrollmentId: stopped.enrollment.id,
          messageId: stopped.message?.id,
          stepIndex: stopped.message?.stepIndex
        });
      } catch (error) {
        return createSequenceBatchExceptionResult(id, error, item.enrollment.id);
      }
    });
  }
}
