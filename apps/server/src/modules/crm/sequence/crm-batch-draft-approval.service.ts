import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { CRM_SEQUENCE_REPOSITORY } from '../crm.tokens';
import type {
  CrmMessageRecord,
  CrmMessageStatus,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import type { CrmBatchDraftApprovalRepository } from './crm-batch-draft-approval.repository';

export interface SequenceBatchOperationInput {
  ids: string[];
}

type SequenceBatchItemStatus = 'success' | 'skipped' | 'failed';

interface SequenceBatchItemResult {
  id: string;
  status: SequenceBatchItemStatus;
  message: string;
  enrollmentId?: string;
  messageId?: string;
  stepIndex?: number;
}

export interface SequenceBatchOperateResult {
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: SequenceBatchItemResult[];
}

const initialDraftStepIndex = 1;
const approvedDraftStatus: CrmMessageStatus = 'draft_ready';

@Injectable()
export class CrmBatchDraftApprovalService {
  constructor(
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly approvalRepository: CrmBatchDraftApprovalRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Confirms owner pending drafts locally without queueing send jobs. */
  async batchApproveMessageDrafts(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    const reviewItems = await this.approvalRepository.listSequenceReviewItemsByIds({
      ids: input.ids,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const reviewItemById = new Map(reviewItems.map(item => [item.enrollment.id, item]));

    return this.runSequenceBatch(input.ids, async id => {
      const item = reviewItemById.get(id) ?? null;

      if (!item) {
        return this.createSequenceBatchResult(id, 'skipped', '邮件序列不存在或无权操作');
      }

      const pendingMessage = this.getPendingLocalApprovalMessage(item);

      if (!pendingMessage) {
        return this.createSequenceBatchResult(id, 'skipped', '当前序列没有可本地确认的待审草稿', {
          enrollmentId: item.enrollment.id
        });
      }

      const toEnrollmentStatus: CrmSequenceEnrollmentStatus =
        pendingMessage.stepIndex === initialDraftStepIndex ? 'ready_to_send' : item.enrollment.status;

      try {
        const approval = await this.approvalRepository.approveMessageDraft({
          messageId: pendingMessage.id,
          enrollmentId: item.enrollment.id,
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          accountId: pendingMessage.accountId,
          contactId: pendingMessage.contactId,
          fromEnrollmentStatus: item.enrollment.status,
          toEnrollmentStatus,
          fromMessageStatus: 'draft_pending_review',
          toMessageStatus: approvedDraftStatus,
          accountStatus: 'ready'
        });

        if (!approval) {
          return this.createSequenceBatchResult(id, 'skipped', '当前草稿状态已变化，请刷新后重试', {
            enrollmentId: item.enrollment.id,
            messageId: pendingMessage.id,
            stepIndex: pendingMessage.stepIndex
          });
        }

        await this.crmLogger?.record('draft-approve-batch', 'CRM 开发信草稿批量确认', context, {
          organizationId: context.organizationId,
          accountId: approval.message.accountId,
          contactId: approval.message.contactId,
          enrollmentId: approval.enrollment.id,
          messageId: approval.message.id,
          stepIndex: approval.message.stepIndex,
          fromStatus: item.enrollment.status,
          toStatus: approval.enrollment.status
        });

        return this.createSequenceBatchResult(id, 'success', '草稿已确认', {
          enrollmentId: approval.enrollment.id,
          messageId: approval.message.id,
          stepIndex: approval.message.stepIndex
        });
      } catch (error) {
        return this.createSequenceBatchExceptionResult(id, error, item.enrollment.id);
      }
    });
  }

  private async runSequenceBatch(
    ids: string[],
    operate: (id: string) => Promise<SequenceBatchItemResult>
  ): Promise<SequenceBatchOperateResult> {
    const results: SequenceBatchItemResult[] = [];

    for (const id of ids) {
      results.push(await operate(id));
    }

    return {
      totalCount: ids.length,
      successCount: results.filter(item => item.status === 'success').length,
      skippedCount: results.filter(item => item.status === 'skipped').length,
      failedCount: results.filter(item => item.status === 'failed').length,
      results
    };
  }

  private createSequenceBatchResult(
    id: string,
    status: SequenceBatchItemStatus,
    message: string,
    extra: Omit<SequenceBatchItemResult, 'id' | 'status' | 'message'> = {}
  ): SequenceBatchItemResult {
    return {
      id,
      status,
      message,
      ...extra
    };
  }

  private createSequenceBatchExceptionResult(
    id: string,
    error: unknown,
    enrollmentId?: string
  ): SequenceBatchItemResult {
    const message = error instanceof Error ? error.message : String(error);
    const status: SequenceBatchItemStatus =
      error instanceof HttpException && error.getStatus() < 500 ? 'skipped' : 'failed';

    return this.createSequenceBatchResult(id, status, message, {
      enrollmentId
    });
  }

  /** Returns the pending draft that can be confirmed locally without entering send scheduling. */
  private getPendingLocalApprovalMessage(item: CrmSequenceReviewRecord): CrmMessageRecord | null {
    const pendingMessage = [...item.messages]
      .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.getTime() - right.createdAt.getTime())
      .find(message => message.status === 'draft_pending_review');

    if (!pendingMessage) return null;

    if (pendingMessage.stepIndex === initialDraftStepIndex) {
      return item.enrollment.status === 'draft_review_pending' ? pendingMessage : null;
    }

    // Running follow-ups enter the scheduler path, so batch approval keeps them out.
    return item.enrollment.status === 'ready_to_send' ? pendingMessage : null;
  }
}
