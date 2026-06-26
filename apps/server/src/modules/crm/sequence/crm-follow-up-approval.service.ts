import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CRM_SEQUENCE_APPROVAL_REPOSITORY } from '../crm.tokens';
import type { CrmMessageStatus, CrmSequenceEnrollmentStatus, CrmUserContext } from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { toMessageView, toSequenceEnrollmentView } from '../shared/crm-view-mappers';
import type { CrmFollowUpApprovalRepository } from './crm-follow-up-approval.repository';

const initialDraftStepIndex = 1;
const approvedDraftStatus: CrmMessageStatus = 'draft_ready';
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];
const nextDraftEnrollmentStatuses: CrmSequenceEnrollmentStatus[] = ['ready_to_send', 'sequence_running'];

@Injectable()
export class CrmFollowUpApprovalService {
  constructor(
    @Inject(CRM_SEQUENCE_APPROVAL_REPOSITORY)
    private readonly approvalRepository: CrmFollowUpApprovalRepository,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Confirms one owner follow-up draft into the local send scheduling pool. */
  async approveFollowUpMessageDraft(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);

    if (message.stepIndex <= initialDraftStepIndex) {
      throw new BadRequestException('当前草稿不是后续开发信');
    }

    const reviewItem = await this.requireOwnedSequenceReviewItem(message.enrollmentId, context);

    if (!nextDraftEnrollmentStatuses.includes(reviewItem.enrollment.status)) {
      throw new BadRequestException('当前序列状态不能确认后续草稿');
    }

    if (reviewItem.enrollment.status === 'ready_to_send') {
      const approval = await this.approvalRepository.approveMessageDraft({
        messageId: message.id,
        enrollmentId: reviewItem.enrollment.id,
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        accountId: message.accountId,
        contactId: message.contactId,
        fromEnrollmentStatus: 'ready_to_send',
        toEnrollmentStatus: 'ready_to_send',
        fromMessageStatus: 'draft_pending_review',
        toMessageStatus: approvedDraftStatus,
        accountStatus: 'ready'
      });

      if (!approval) {
        throw new BadRequestException('当前草稿状态已变化，请刷新后重试');
      }

      await this.crmLogger?.record('follow-up-draft-approve-local', 'CRM 后续开发信人工确认', context, {
        organizationId: context.organizationId,
        accountId: approval.message.accountId,
        contactId: approval.message.contactId,
        enrollmentId: approval.enrollment.id,
        messageId: approval.message.id,
        stepIndex: approval.message.stepIndex
      });

      return {
        enrollment: toSequenceEnrollmentView(approval.enrollment),
        message: toMessageView(approval.message)
      };
    }

    if (!reviewItem.mailbox || reviewItem.mailbox.status !== 'active') {
      throw new BadRequestException('发送邮箱未启用');
    }

    if (!message.scheduledAt) {
      throw new BadRequestException('后续开发信缺少计划发送时间');
    }

    const approval = await this.approvalRepository.approveMessageDraft({
      messageId: message.id,
      enrollmentId: reviewItem.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      accountId: message.accountId,
      contactId: message.contactId,
      fromEnrollmentStatus: 'sequence_running',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: 'draft_pending_review',
      toMessageStatus: approvedDraftStatus,
      accountStatus: 'sequence_running'
    });

    if (!approval) {
      throw new BadRequestException('当前草稿状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('follow-up-draft-approve', 'CRM 后续开发信人工确认并等待发送调度', context, {
      organizationId: context.organizationId,
      accountId: approval.message.accountId,
      contactId: approval.message.contactId,
      enrollmentId: approval.enrollment.id,
      messageId: approval.message.id,
      stepIndex: approval.message.stepIndex,
      scheduledAt: approval.message.scheduledAt?.toISOString() ?? null
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
