import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CRM_SEQUENCE_REPOSITORY } from '../crm.tokens';
import type { CrmAiWritingStepIndex, CrmMessageStatus, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { toMessageView, toSequenceEnrollmentView } from '../shared/crm-view-mappers';
import type { CrmDraftApprovalRepository } from './crm-draft-approval.repository';

const initialDraftStepIndex: CrmAiWritingStepIndex = 1;
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];

@Injectable()
export class CrmDraftApprovalService {
  constructor(
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly approvalRepository: CrmDraftApprovalRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Confirms one owner first-touch draft without queueing any send job. */
  async approveInitialMessageDraft(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);

    if (message.stepIndex !== initialDraftStepIndex) {
      throw new BadRequestException('当前草稿不是首封开发信');
    }

    const reviewItem = await this.requireOwnedSequenceReviewItem(message.enrollmentId, context);

    if (reviewItem.enrollment.status !== 'draft_review_pending') {
      throw new BadRequestException('当前序列状态不能确认草稿');
    }

    const approval = await this.approvalRepository.approveMessageDraft({
      messageId: message.id,
      enrollmentId: reviewItem.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      accountId: message.accountId,
      contactId: message.contactId,
      fromEnrollmentStatus: 'draft_review_pending',
      toEnrollmentStatus: 'ready_to_send',
      fromMessageStatus: 'draft_pending_review',
      toMessageStatus: 'draft_ready',
      accountStatus: 'ready'
    });

    if (!approval) {
      throw new BadRequestException('当前草稿状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('draft-approve', 'CRM 首封开发信人工确认', context, {
      organizationId: context.organizationId,
      accountId: approval.message.accountId,
      contactId: approval.message.contactId,
      enrollmentId: approval.enrollment.id,
      messageId: approval.message.id,
      fromStatus: reviewItem.enrollment.status,
      toStatus: approval.enrollment.status
    });

    return {
      enrollment: toSequenceEnrollmentView(approval.enrollment),
      message: toMessageView(approval.message)
    };
  }

  private async requireOwnedEditableMessage(id: string, context: CrmUserContext) {
    const message = await this.approvalRepository.findMessageById({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!message) {
      throw new NotFoundException('邮件草稿不存在');
    }

    if (!editableDraftStatuses.includes(message.status)) {
      throw new BadRequestException('当前邮件状态不能修改');
    }

    return message;
  }

  private async requireOwnedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.approvalRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
  }
}
