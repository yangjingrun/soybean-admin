import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CRM_SEQUENCE_APPROVAL_REPOSITORY } from '../crm.tokens';
import type { CrmMessageRecord, CrmMessageStatus, CrmUserContext } from '../crm.types';
import { CrmDraftApprovalService } from './crm-draft-approval.service';
import { CrmFollowUpApprovalService } from './crm-follow-up-approval.service';

const initialDraftStepIndex = 1;
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];

interface CrmMessageDraftApprovalRouterRepository {
  findMessageById(args: { id: string; organizationId: string; ownerUserId?: string }): Promise<CrmMessageRecord | null>;
}

@Injectable()
export class CrmMessageDraftApprovalRouterService {
  constructor(
    @Inject(CRM_SEQUENCE_APPROVAL_REPOSITORY)
    private readonly sequenceRepository: CrmMessageDraftApprovalRouterRepository,
    @Inject(CrmDraftApprovalService)
    private readonly draftApprovalService: CrmDraftApprovalService,
    @Inject(CrmFollowUpApprovalService)
    private readonly followUpApprovalService: CrmFollowUpApprovalService
  ) {}

  /** Routes one owner draft approval to first-touch or follow-up approval rules. */
  async approveMessageDraft(id: string, context: CrmUserContext) {
    const message = await this.sequenceRepository.findMessageById({
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

    if (message.stepIndex === initialDraftStepIndex) {
      return this.draftApprovalService.approveInitialMessageDraft(id, context);
    }

    if (message.stepIndex > initialDraftStepIndex) {
      return this.followUpApprovalService.approveFollowUpMessageDraft(id, context);
    }

    throw new BadRequestException('当前草稿不是首封开发信');
  }
}
