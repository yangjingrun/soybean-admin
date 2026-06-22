import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CRM_SEQUENCE_REPOSITORY, CRM_SUPPRESSION_REPOSITORY } from '../crm.tokens';
import type { CrmAccountRecord, CrmContactRecord, CrmSequencePolicyRecord, CrmUserContext } from '../crm.types';
import type { CrmSuppressionRepository } from '../suppression/crm-suppression.repository';
import { activeSequenceBlockingStatuses, firstDraftCreationBlockingStatuses } from './crm-sequence-control-rules';
import type { CrmSequenceRepository } from './crm-sequence.repository';

interface SequenceReviewEligibilityInput {
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  policy: CrmSequencePolicyRecord | null;
  context: CrmUserContext;
}

@Injectable()
export class CrmSequenceEligibilityService {
  constructor(
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly sequenceRepository: CrmSequenceRepository,
    @Inject(CRM_SUPPRESSION_REPOSITORY)
    private readonly suppressionRepository: CrmSuppressionRepository
  ) {}

  /** Checks all reusable business rules before creating a new sequence review item. */
  async assertCanCreateSequenceReview(input: SequenceReviewEligibilityInput) {
    await this.assertLeadCanStartSequence(input.account, input.contact, input.context);
    await this.assertPolicyAllowsSequence(input.account, input.contact, input.policy, input.context);
  }

  /** Checks owner-only, account status, blacklist, and same-contact sequence history rules. */
  async assertLeadCanStartSequence(account: CrmAccountRecord, contact: CrmContactRecord, context: CrmUserContext) {
    this.assertOwnerCanDevelop(account, contact, context);
    await this.assertContactNotBlacklisted(contact, context);
    await this.assertNoContactSequenceHistory(contact, context);
  }

  /** Applies same-company sequence strategy after the concrete policy has been resolved. */
  async assertPolicyAllowsSequence(
    account: CrmAccountRecord,
    contact: CrmContactRecord,
    policy: CrmSequencePolicyRecord | null,
    context: CrmUserContext
  ) {
    if (policy?.sameCompanyContactStrategy === 'allow_multiple_contacts') {
      return;
    }

    const existingEnrollment = await this.sequenceRepository.findActiveEnrollmentByAccount({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      accountId: account.id,
      statuses: activeSequenceBlockingStatuses
    });

    if (existingEnrollment && existingEnrollment.contactId !== contact.id) {
      throw new BadRequestException('同公司已有进行中的开发信序列，请使用允许多联系人策略后再创建');
    }
  }

  private assertOwnerCanDevelop(account: CrmAccountRecord, contact: CrmContactRecord, context: CrmUserContext) {
    if (account.status === 'archived' || account.status === 'blocked') {
      throw new BadRequestException('当前线索不可开发');
    }

    if (account.ownerUserId !== context.userId || contact.ownerUserId !== context.userId) {
      throw new BadRequestException('只能为自己的线索创建开发信序列');
    }
  }

  private async assertContactNotBlacklisted(contact: CrmContactRecord, context: CrmUserContext) {
    const blacklistEntry = await this.suppressionRepository.findBlacklistEntry({
      organizationId: context.organizationId,
      emailHash: contact.emailHash
    });

    if (blacklistEntry) {
      throw new BadRequestException('该邮箱已在组织黑名单中，不能继续开发');
    }
  }

  private async assertNoContactSequenceHistory(contact: CrmContactRecord, context: CrmUserContext) {
    const existingEnrollment = await this.sequenceRepository.findActiveEnrollmentByContact({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      contactId: contact.id,
      statuses: firstDraftCreationBlockingStatuses
    });

    if (existingEnrollment) {
      throw new BadRequestException('该联系人已生成过开发信，不能再次生成首封草稿');
    }
  }
}
