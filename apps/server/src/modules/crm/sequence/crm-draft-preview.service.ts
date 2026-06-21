import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CrmAiDraftService } from '../crm-ai-draft.service';
import { renderEmailTemplateText, findPersonaProfile, type PersonaProfile } from '../crm-email-template-renderer';
import { buildPersonaMatch, type ResolvedPersonaMatch } from '../crm-persona-match';
import { CRM_ACCOUNT_REPOSITORY, CRM_SEQUENCE_REPOSITORY, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmAiDraftMetadata,
  CrmAiDraftPreviewInput,
  CrmAiWritingStepIndex,
  CrmContactRecord,
  CrmEmailTemplateGroupRecord,
  CrmMessageRecord,
  CrmProductLineRecord,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import type {
  CrmDraftPreviewAccountRepository,
  CrmDraftPreviewSequenceRepository,
  CrmDraftPreviewSettingsRepository
} from './crm-draft-preview.repository';

const defaultSequenceStepCount = 5;
const initialDraftStepIndex: CrmAiWritingStepIndex = 1;

interface GeneratedDraft {
  subject: string;
  bodyText: string;
  aiDraft?: CrmAiDraftMetadata | null;
}

@Injectable()
export class CrmDraftPreviewService {
  constructor(
    @Inject(CRM_ACCOUNT_REPOSITORY)
    private readonly accountRepository: CrmDraftPreviewAccountRepository,
    @Inject(CRM_SETTINGS_REPOSITORY)
    private readonly settingsRepository: CrmDraftPreviewSettingsRepository,
    @Inject(CRM_SEQUENCE_REPOSITORY)
    private readonly sequenceRepository: CrmDraftPreviewSequenceRepository,
    @Optional()
    @Inject(CrmAiDraftService)
    private readonly aiDraftService?: CrmAiDraftService | null
  ) {}

  /** Previews a configured AI draft without creating messages or timeline events. */
  async previewAiDraft(input: CrmAiDraftPreviewInput, context: CrmUserContext) {
    const stepIndex = toAiWritingStepIndex(input.stepIndex);
    const { account, contact } = await this.requireScopedAccountAndContact(input.accountId, input.contactId, context);
    const productLine = this.requireAiWritingProductLine(await this.requireActiveProductLine(input.productLineId, context));
    const sequenceItem = input.enrollmentId ? await this.requireOwnedSequenceReviewItem(input.enrollmentId, context) : null;

    if (sequenceItem) {
      this.assertPreviewMatchesSequence(input, sequenceItem, productLine.id);
    }

    const [defaultTemplateGroup, personaMatch] =
      stepIndex === initialDraftStepIndex
        ? await Promise.all([
            this.settingsRepository.findDefaultEmailTemplateGroup(context.organizationId),
            this.resolvePersonaProfileMatch(account, contact, context)
          ])
        : [null, null];
    const previousMessages =
      input.previousMessages?.map(message => ({
        stepIndex: toAiWritingStepIndex(message.stepIndex),
        subject: message.subject,
        bodyText: message.bodyText
      })) ??
      sequenceItem?.messages
        .filter(message => message.stepIndex < stepIndex)
        .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.getTime() - right.createdAt.getTime()) ??
      [];
    const fallbackDraft =
      stepIndex === initialDraftStepIndex
        ? generateFirstDraft({
            account,
            contact,
            productLine,
            context,
            personaProfile: personaMatch?.templatePersona ?? null,
            templateGroup: defaultTemplateGroup
          })
        : { subject: '', bodyText: '' };
    const draft = await this.generateConfiguredReviewDraft({
      account,
      contact,
      productLine,
      context,
      stepIndex,
      previousMessages,
      fallbackDraft
    });

    return {
      preview: {
        subject: draft.subject,
        bodyText: draft.bodyText,
        aiDraft: draft.aiDraft ?? null
      }
    };
  }

  private async requireScopedAccountAndContact(accountId: string, contactId: string, context: CrmUserContext) {
    const detail = await this.accountRepository.getAccountDetail({
      id: accountId,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
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

  private requireAiWritingProductLine(productLine: CrmProductLineRecord | null) {
    if (!productLine) {
      throw new BadRequestException('请选择已启用 AI 写信的产品资料');
    }

    if (productLine.status !== 'active') {
      throw new BadRequestException('产品资料已归档');
    }

    if (!productLine.aiWritingConfig?.enabled) {
      throw new BadRequestException('产品资料未启用 AI 写信');
    }

    return productLine;
  }

  private async requireOwnedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.sequenceRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
  }

  private assertPreviewMatchesSequence(
    input: CrmAiDraftPreviewInput,
    item: CrmSequenceReviewRecord,
    productLineId: string
  ) {
    if (item.account.id !== input.accountId || item.contact.id !== input.contactId || item.productLine?.id !== productLineId) {
      throw new BadRequestException('预览参数与邮件序列不匹配');
    }

    if (input.messageId && !item.messages.some(message => message.id === input.messageId)) {
      throw new BadRequestException('预览参考邮件不属于当前序列');
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
    productLine: CrmProductLineRecord;
    context: CrmUserContext;
    stepIndex: CrmAiWritingStepIndex;
    previousMessages: Array<Pick<CrmMessageRecord, 'stepIndex' | 'subject' | 'bodyText'>>;
    fallbackDraft: GeneratedDraft;
  }): Promise<GeneratedDraft> {
    const { account, contact, productLine, context, fallbackDraft, previousMessages, stepIndex } = input;
    const writingConfig = productLine.aiWritingConfig;

    if (!this.aiDraftService) {
      throw new BadRequestException('AI 写信服务未初始化');
    }

    if (!writingConfig?.enabled) {
      throw new BadRequestException('产品资料未启用 AI 写信');
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
      writingConfig,
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
}

function toAiWritingStepIndex(stepIndex: number): CrmAiWritingStepIndex {
  if (stepIndex < 1 || stepIndex > defaultSequenceStepCount) {
    throw new BadRequestException('AI 写信步骤超出范围');
  }

  return stepIndex as CrmAiWritingStepIndex;
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
