import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { CrmAiDraftService } from '../crm-ai-draft.service';
import { renderEmailTemplateText, findPersonaProfile, type PersonaProfile } from '../crm-email-template-renderer';
import { buildPersonaMatch, type ResolvedPersonaMatch } from '../crm-persona-match';
import {
  CRM_ACCOUNT_REPOSITORY,
  CRM_MAILBOX_REPOSITORY,
  CRM_SEQUENCE_REPOSITORY,
  CRM_SETTINGS_REPOSITORY,
  CRM_SUPPRESSION_REPOSITORY
} from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmAiDraftMetadata,
  CrmAiWritingStepIndex,
  CrmContactRecord,
  CrmEmailTemplateGroupRecord,
  CrmMailboxRecord,
  CrmMessageRecord,
  CrmProductLineRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequencePolicyRecord,
  CrmUserContext
} from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { createCrmReadScope } from '../shared/crm-scope';
import type { CrmAccountRepository } from '../accounts/crm-account.repository';
import type { CrmMailboxRepository } from '../mailbox/crm-mailbox.repository';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import type { CrmSuppressionRepository } from '../suppression/crm-suppression.repository';
import type { CrmSequenceRepository } from './crm-sequence.repository';
import { toSequenceReviewView } from './crm-sequence-review-view';

const defaultSequenceStepCount = 5;
const initialDraftStepIndex: CrmAiWritingStepIndex = 1;
const activeSequenceStatuses: CrmSequenceEnrollmentStatus[] = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused'
];

export interface SequenceReviewCreateInput {
  accountId: string;
  contactId: string;
  productLineId?: string | null;
  mailboxId?: string | null;
  policyId?: string | null;
}

interface GeneratedDraft {
  subject: string;
  bodyText: string;
  aiDraft?: CrmAiDraftMetadata | null;
}

@Injectable()
export class CrmSequenceReviewCreationService {
  constructor(
    @Inject(CRM_ACCOUNT_REPOSITORY)
    private readonly accountRepository: CrmAccountRepository,
    @Inject(CRM_SETTINGS_REPOSITORY)
    private readonly settingsRepository: CrmSettingsRepository,
    @Inject(CRM_MAILBOX_REPOSITORY)
    private readonly mailboxRepository: CrmMailboxRepository,
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly sequenceRepository: CrmSequenceRepository,
    @Inject(CRM_SUPPRESSION_REPOSITORY)
    private readonly suppressionRepository: CrmSuppressionRepository,
    @Optional()
    @Inject(CrmAiDraftService)
    private readonly aiDraftService?: CrmAiDraftService | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Creates one first-email review item and deterministic draft without queueing any send job. */
  async createSequenceReviewItem(input: SequenceReviewCreateInput, context: CrmUserContext) {
    const { account, contact } = await this.requireScopedAccountAndContact(input.accountId, input.contactId, context);
    await this.assertContactNotBlacklisted(contact, context);
    const existingEnrollment = await this.sequenceRepository.findActiveEnrollmentByContact({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      contactId: contact.id,
      statuses: activeSequenceStatuses
    });

    if (existingEnrollment) {
      throw new BadRequestException('该联系人已有运行中或待审核的开发信序列');
    }

    const [productLine, mailbox, selectedPolicy, defaultPolicy] = await Promise.all([
      input.productLineId ? this.requireActiveProductLine(input.productLineId, context) : Promise.resolve(null),
      input.mailboxId ? this.requireOwnedActiveMailbox(input.mailboxId, context) : Promise.resolve(null),
      input.policyId ? this.requireActiveSequencePolicy(input.policyId, context) : Promise.resolve(null),
      input.policyId ? Promise.resolve(null) : this.settingsRepository.findDefaultSequencePolicy(context.organizationId)
    ]);
    const policy = selectedPolicy ?? defaultPolicy;
    await this.assertSameCompanySequencePolicy(account, contact, policy, context);
    const [defaultTemplateGroup, personaMatch] = await Promise.all([
      this.settingsRepository.findDefaultEmailTemplateGroup(context.organizationId),
      this.resolvePersonaProfileMatch(account, contact, context)
    ]);
    const draft = await this.generateConfiguredReviewDraft({
      account,
      contact,
      productLine,
      context,
      stepIndex: initialDraftStepIndex,
      previousMessages: [],
      fallbackDraft: generateFirstDraft({
        account,
        contact,
        productLine,
        context,
        personaProfile: personaMatch.templatePersona,
        templateGroup: defaultTemplateGroup
      })
    });
    const bundle = await this.runSequenceWrite(() =>
      this.sequenceRepository.createSequenceDraftBundle({
        enrollment: {
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          accountId: account.id,
          contactId: contact.id,
          productLineId: productLine?.id ?? null,
          mailboxId: mailbox?.id ?? null,
          policyId: policy?.id ?? null,
          name: buildSequenceName(account, contact),
          status: 'draft_review_pending',
          currentStep: initialDraftStepIndex,
          totalSteps: defaultSequenceStepCount,
          runVersion: 1,
          createdById: context.userId,
          createdByName: context.userName
        },
        message: {
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          accountId: account.id,
          contactId: contact.id,
          mailboxId: mailbox?.id ?? null,
          stepIndex: initialDraftStepIndex,
          threadMode: getSequencePolicyStep(policy, initialDraftStepIndex)?.threadMode ?? 'new_subject',
          subject: draft.subject,
          bodyText: draft.bodyText,
          status: 'draft_pending_review',
          metadata: createAiDraftMessageMetadata(draft.aiDraft)
        },
        timelineEvent: {
          organizationId: context.organizationId,
          accountId: account.id,
          contactId: contact.id,
          ownerUserId: context.userId,
          eventType: 'sequence_draft_generated',
          title: '生成首封开发信草稿',
          content: draft.subject,
          metadata: {
            productLineId: productLine?.id ?? null,
            mailboxId: mailbox?.id ?? null,
            policyId: policy?.id ?? null,
            personaProfileId: personaMatch.persona?.id ?? null,
            personaProfileName: personaMatch.persona?.name ?? null,
            personaMatchMethod: personaMatch.matchMethod,
            personaMatchedKeywords: personaMatch.matchedKeywords,
            personaFallbackReason: personaMatch.fallbackReason,
            aiDraft: draft.aiDraft ?? null
          }
        },
        accountStatus: 'manual_review_pending'
      })
    );

    await this.crmLogger?.record('sequence-review-create', 'CRM 首封开发信草稿生成', context, {
      organizationId: context.organizationId,
      accountId: account.id,
      contactId: contact.id,
      enrollmentId: bundle.enrollment.id,
      messageId: bundle.message.id,
      productLineId: productLine?.id ?? null,
      mailboxId: mailbox?.id ?? null,
      policyId: policy?.id ?? null
    });

    return {
      item: toSequenceReviewView(
        {
          enrollment: bundle.enrollment,
          account: bundle.account,
          contact,
          productLine,
          mailbox,
          policy,
          firstMessage: bundle.message,
          messages: [bundle.message]
        },
        context,
        personaMatch
      )
    };
  }

  private async requireScopedAccountAndContact(accountId: string, contactId: string, context: CrmUserContext) {
    const detail = await this.accountRepository.getAccountDetail({
      id: accountId,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });
    const contact = detail?.contacts.find(item => item.id === contactId) ?? null;

    if (!detail) {
      throw new NotFoundException('线索不存在');
    }

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }

    if (detail.account.status === 'archived' || detail.account.status === 'blocked') {
      throw new BadRequestException('当前线索不可开发');
    }

    if (detail.account.ownerUserId !== context.userId || contact.ownerUserId !== context.userId) {
      throw new BadRequestException('只能为自己的线索创建开发信序列');
    }

    return {
      account: detail.account,
      contact
    };
  }

  private async requireActiveProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.settingsRepository.findProductLineById({
      id,
      organizationId: context.organizationId
    });

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    if (productLine.status !== 'active') {
      throw new BadRequestException('产品资料已归档');
    }

    return productLine;
  }

  private async requireActiveSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.settingsRepository.findSequencePolicyById({
      id,
      organizationId: context.organizationId
    });

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    if (policy.status !== 'active') {
      throw new BadRequestException('序列策略已归档');
    }

    return policy;
  }

  private async requireOwnedActiveMailbox(id: string, context: CrmUserContext) {
    const mailbox = await this.mailboxRepository.findMailboxById({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    if (mailbox.status !== 'active') {
      throw new BadRequestException('邮箱未启用');
    }

    return mailbox;
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

  /**
   * Applies the sequence policy before creating another active sequence for the same account.
   */
  private async assertSameCompanySequencePolicy(
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
      statuses: activeSequenceStatuses
    });

    if (existingEnrollment && existingEnrollment.contactId !== contact.id) {
      throw new BadRequestException('同公司已有进行中的开发信序列，请使用允许多联系人策略后再创建');
    }
  }

  private async resolvePersonaProfileMatch(
    account: Pick<CrmAccountRecord, 'customerType'>,
    contact: Pick<CrmContactRecord, 'title'>,
    context: CrmUserContext
  ): Promise<ResolvedPersonaMatch> {
    const organizationProfiles = await this.settingsRepository.listActivePersonaProfiles(context.organizationId);
    return buildPersonaMatch(organizationProfiles, account, contact);
  }

  /** Generates an AI draft only when the selected product line explicitly enables it. */
  private async generateConfiguredReviewDraft(input: {
    account: CrmAccountRecord;
    contact: CrmContactRecord;
    productLine: CrmProductLineRecord | null;
    context: CrmUserContext;
    stepIndex: CrmAiWritingStepIndex;
    previousMessages: Array<Pick<CrmMessageRecord, 'stepIndex' | 'subject' | 'bodyText'>>;
    fallbackDraft: GeneratedDraft;
  }): Promise<GeneratedDraft> {
    const { account, contact, productLine, context, fallbackDraft, previousMessages, stepIndex } = input;

    if (!productLine?.aiWritingConfig?.enabled) {
      return fallbackDraft;
    }

    if (!this.aiDraftService) {
      throw new BadRequestException('AI 写信服务未初始化');
    }

    const draft = await this.aiDraftService.generateDraft({
      account: {
        name: account.name,
        country: account.country,
        domain: account.domain,
        customerType: account.customerType
      },
      contact: {
        fullName: contact.fullName,
        title: contact.title,
        maskedEmail: contact.maskedEmail,
        emailStatus: contact.emailStatus
      },
      productLine: {
        id: productLine.id,
        name: productLine.name,
        targetCustomerType: productLine.targetCustomerType,
        coreSellingPoints: productLine.coreSellingPoints,
        moq: productLine.moq,
        leadTime: productLine.leadTime,
        paymentTerms: productLine.paymentTerms,
        certifications: productLine.certifications,
        catalogUrl: productLine.catalogUrl,
        websiteUrl: productLine.websiteUrl,
        commonModelsText: productLine.commonModelsText
      },
      writingConfig: productLine.aiWritingConfig,
      stepIndex,
      previousMessages: previousMessages.map(message => ({
        stepIndex: message.stepIndex,
        subject: message.subject,
        bodyText: message.bodyText
      })),
      senderName: context.userName
    });

    if (!draft.subject && stepIndex === initialDraftStepIndex) {
      throw new BadRequestException('AI 返回首封主题不能为空');
    }

    return {
      subject: draft.subject || fallbackDraft.subject,
      bodyText: draft.bodyText,
      aiDraft: draft.metadata
    };
  }

  private async runSequenceWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('该联系人已有运行中或待审核的开发信序列');
      }

      throw error;
    }
  }
}

function toOwnerScope(context: CrmUserContext) {
  const scope = createCrmReadScope(context);
  return scope.ownerUserId ? { ownerUserId: scope.ownerUserId } : {};
}

function createAiDraftMessageMetadata(aiDraft?: CrmAiDraftMetadata | null) {
  return aiDraft ? { aiDraft } : null;
}

/** Builds a conservative first-touch draft from verified CRM fields only. */
function generateFirstDraft(options: {
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  productLine: CrmProductLineRecord | null;
  context: CrmUserContext;
  personaProfile?: PersonaProfile | null;
  templateGroup?: CrmEmailTemplateGroupRecord | null;
}): GeneratedDraft {
  const { account, contact, context, personaProfile, productLine, templateGroup } = options;
  const templateStep = templateGroup?.steps.find(step => step.stepIndex === initialDraftStepIndex);
  const greetingName = contact.fullName || contact.title || 'there';
  const productName = productLine?.name || 'our product line';
  const sellingPoint = productLine?.coreSellingPoints || `supporting ${account.customerType || 'B2B'} customers`;
  const persona = personaProfile ?? findPersonaProfile(contact.title);

  if (templateGroup?.status === 'active' && templateStep) {
    return {
      subject: renderEmailTemplateText(templateStep.subjectTemplate, {
        account,
        contact,
        persona,
        productLine,
        senderName: context.userName
      }),
      bodyText: renderEmailTemplateText(templateStep.bodyTemplate, {
        account,
        contact,
        persona,
        productLine,
        senderName: context.userName
      })
    };
  }

  const supplyInfo = [
    productLine?.moq ? `MOQ: ${productLine.moq}` : null,
    productLine?.leadTime ? `lead time: ${productLine.leadTime}` : null,
    productLine?.certifications ? `certifications: ${productLine.certifications}` : null
  ].filter(Boolean);
  const subject = productLine ? `${productName} for ${account.name}` : `Potential cooperation with ${account.name}`;
  const bodyLines = [
    `Hi ${greetingName},`,
    '',
    `I noticed ${account.name}${account.country ? ` in ${account.country}` : ''} and thought this might be relevant to your team.`,
    `We work on ${productName}, mainly focused on ${sellingPoint}.`,
    persona ? `For ${persona.label}, I kept this note focused on ${persona.draftFocusText}.` : null,
    supplyInfo.length ? `For reference, ${supplyInfo.join(', ')}.` : null,
    '',
    'Would it be useful if I sent a short product list for your review?',
    '',
    'Best regards,',
    context.userName || 'Sales team'
  ].filter((line): line is string => line !== null);

  return {
    subject,
    bodyText: bodyLines.join('\n')
  };
}

function buildSequenceName(account: CrmAccountRecord, contact: CrmContactRecord) {
  const contactLabel = contact.fullName || contact.title || contact.maskedEmail;

  return `${account.name} - ${contactLabel}`;
}

function getSequencePolicyStep(policy: CrmSequencePolicyRecord | null, stepIndex: number) {
  return policy?.steps.find(step => step.stepIndex === stepIndex) ?? null;
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
