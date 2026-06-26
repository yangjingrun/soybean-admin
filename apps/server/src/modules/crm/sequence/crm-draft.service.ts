import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CrmAiDraftService } from '../crm-ai-draft.service';
import { findPersonaProfile, type PersonaProfile } from '../crm-email-template-renderer';
import { getCrmOutreachStepStrategy, toCrmAiStepStrategy } from '../crm-outreach-step-strategy';
import { CRM_SEQUENCE_DRAFT_REPOSITORY } from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmAiDraftMetadata,
  CrmAiWritingStepIndex,
  CrmContactRecord,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmProductLineRecord,
  CrmUserContext
} from '../crm.types';
import { normalizeLimitedContent } from '../shared/crm-normalizers';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { resolveCrmSenderName } from '../shared/crm-context';
import { toMessageDraftVersionView, toMessageView } from '../shared/crm-view-mappers';
import type { CrmDraftRepository } from './crm-draft.repository';

const defaultSequenceStepCount = 5;
const initialDraftStepIndex: CrmAiWritingStepIndex = 1;
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];

interface MessageDraftUpdateInput {
  subject: string;
  bodyText: string;
}

interface GeneratedDraft {
  subject: string;
  bodyText: string;
  aiDraft?: CrmAiDraftMetadata | null;
}

@Injectable()
export class CrmDraftService {
  constructor(
    @Inject(CRM_SEQUENCE_DRAFT_REPOSITORY)
    private readonly draftRepository: CrmDraftRepository,
    @Optional()
    @Inject(CrmAiDraftService)
    private readonly aiDraftService?: CrmAiDraftService | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Saves human edits to one owner draft and keeps it in pending review. */
  async updateMessageDraft(id: string, input: MessageDraftUpdateInput, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);
    const updatedMessage = await this.draftRepository.updateMessage(
      message.id,
      context.organizationId,
      {
        subject: normalizeRequiredString(input.subject, '邮件主题不能为空'),
        bodyText: normalizeRequiredString(input.bodyText, '邮件正文不能为空'),
        status: 'draft_pending_review'
      },
      {
        status: 'draft_pending_review'
      }
    );

    if (!updatedMessage) {
      throw new NotFoundException('邮件草稿不存在');
    }

    await this.createDraftVersion(updatedMessage, context);
    await this.draftRepository.createTimelineEvent({
      organizationId: updatedMessage.organizationId,
      accountId: updatedMessage.accountId,
      contactId: updatedMessage.contactId,
      ownerUserId: context.userId,
      eventType: 'draft_updated',
      title: '用户修改首封开发信草稿',
      content: updatedMessage.subject,
      metadata: {
        enrollmentId: updatedMessage.enrollmentId,
        messageId: updatedMessage.id
      }
    });

    return {
      message: toMessageView(updatedMessage)
    };
  }

  /** Regenerates the current owner pending-review draft with product-line AI writing config. */
  async regenerateMessageAiDraft(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);
    const item = await this.requireOwnedSequenceReviewItem(message.enrollmentId, context);
    const productLine = this.requireAiWritingProductLine(item.productLine);
    const targetMessage = item.messages.find(itemMessage => itemMessage.id === message.id);

    if (!targetMessage) {
      throw new NotFoundException('邮件草稿不存在');
    }

    const draft = await this.generateConfiguredReviewDraft({
      account: item.account,
      contact: item.contact,
      productLine,
      context,
      stepIndex: toAiWritingStepIndex(message.stepIndex),
      previousMessages: item.messages
        .filter(itemMessage => itemMessage.stepIndex < message.stepIndex)
        .sort(
          (left, right) => left.stepIndex - right.stepIndex || left.createdAt.getTime() - right.createdAt.getTime()
        ),
      personaProfile: findPersonaProfile(item.contact.title),
      fallbackDraft: {
        subject: message.subject,
        bodyText: message.bodyText
      }
    });
    const updatedMessage = await this.draftRepository.updateMessage(
      message.id,
      context.organizationId,
      {
        subject: normalizeRequiredString(draft.subject, '邮件主题不能为空'),
        bodyText: normalizeRequiredString(draft.bodyText, '邮件正文不能为空'),
        status: 'draft_pending_review',
        metadata: mergeAiDraftMessageMetadata(message.metadata, draft.aiDraft)
      },
      {
        status: 'draft_pending_review'
      }
    );

    if (!updatedMessage) {
      throw new NotFoundException('邮件草稿不存在');
    }

    await this.createDraftVersion(updatedMessage, context);
    await this.draftRepository.createTimelineEvent({
      organizationId: updatedMessage.organizationId,
      accountId: updatedMessage.accountId,
      contactId: updatedMessage.contactId,
      ownerUserId: context.userId,
      eventType: 'ai_draft_regenerated',
      title: '重新生成 AI 开发信草稿',
      content: updatedMessage.subject,
      metadata: {
        enrollmentId: updatedMessage.enrollmentId,
        messageId: updatedMessage.id,
        productLineId: productLine.id,
        stepIndex: updatedMessage.stepIndex,
        aiDraft: draft.aiDraft ?? null
      }
    });

    await this.crmLogger?.record('ai-draft-regenerate', 'CRM AI 开发信草稿重新生成', context, {
      organizationId: context.organizationId,
      accountId: updatedMessage.accountId,
      contactId: updatedMessage.contactId,
      enrollmentId: updatedMessage.enrollmentId,
      messageId: updatedMessage.id,
      productLineId: productLine.id,
      stepIndex: updatedMessage.stepIndex
    });

    return {
      message: toMessageView(updatedMessage)
    };
  }

  /** Lists saved snapshots for one owner draft message. */
  async listMessageDraftVersions(id: string, context: CrmUserContext) {
    await this.requireOwnedMessage(id, context);
    const versions = await this.draftRepository.listMessageDraftVersions({
      messageId: id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    return {
      versions: versions.map(toMessageDraftVersionView)
    };
  }

  /** Restores one saved draft snapshot into the current pending-review message. */
  async restoreMessageDraftVersion(id: string, versionId: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);
    const restoredMessage = await this.draftRepository.restoreMessageDraftVersion({
      messageId: message.id,
      versionId,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!restoredMessage) {
      throw new NotFoundException('草稿版本不存在');
    }

    await this.draftRepository.createTimelineEvent({
      organizationId: restoredMessage.organizationId,
      accountId: restoredMessage.accountId,
      contactId: restoredMessage.contactId,
      ownerUserId: context.userId,
      eventType: 'draft_version_restored',
      title: '恢复开发信草稿历史版本',
      content: restoredMessage.subject,
      metadata: {
        enrollmentId: restoredMessage.enrollmentId,
        messageId: restoredMessage.id,
        versionId
      }
    });

    await this.crmLogger?.record('draft-version-restore', 'CRM 开发信草稿恢复历史版本', context, {
      enrollmentId: restoredMessage.enrollmentId,
      messageId: restoredMessage.id,
      versionId
    });

    return {
      message: toMessageView(restoredMessage)
    };
  }

  private async requireOwnedMessage(id: string, context: CrmUserContext) {
    const message = await this.draftRepository.findMessageById({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!message) {
      throw new NotFoundException('邮件草稿不存在');
    }

    return message;
  }

  private async requireOwnedEditableMessage(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedMessage(id, context);

    if (!editableDraftStatuses.includes(message.status)) {
      throw new BadRequestException('当前邮件状态不能修改');
    }

    return message;
  }

  private async requireOwnedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.draftRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
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

  /** Generates an AI draft only when the selected product line explicitly enables it. */
  private async generateConfiguredReviewDraft(input: {
    account: CrmAccountRecord;
    contact: CrmContactRecord;
    productLine: CrmProductLineRecord;
    context: CrmUserContext;
    stepIndex: CrmAiWritingStepIndex;
    previousMessages: Array<Pick<CrmMessageRecord, 'stepIndex' | 'subject' | 'bodyText'>>;
    fallbackDraft: GeneratedDraft;
    personaProfile?: PersonaProfile | null;
  }): Promise<GeneratedDraft> {
    const { account, contact, productLine, context, fallbackDraft, previousMessages, stepIndex, personaProfile } =
      input;
    const writingConfig = productLine.aiWritingConfig;

    if (!this.aiDraftService) {
      throw new BadRequestException('AI 写信服务未初始化');
    }

    if (!writingConfig?.enabled) {
      throw new BadRequestException('产品资料未启用 AI 写信');
    }

    const draft = await this.aiDraftService.generateDraft(
      {
        account: {
          name: account.name,
          country: account.country,
          city: account.city,
          timeZone: account.timeZone,
          domain: account.domain,
          customerType: account.customerType,
          sourceSnapshot: account.sourceSnapshot
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
        senderName: resolveCrmSenderName(context),
        baseDraft: {
          subject: fallbackDraft.subject,
          bodyText: fallbackDraft.bodyText
        },
        persona: personaProfile ?? findPersonaProfile(contact.title),
        stepStrategy: toCrmAiStepStrategy(getCrmOutreachStepStrategy(stepIndex))
      },
      context
    );

    if (!draft.subject && stepIndex === initialDraftStepIndex) {
      throw new BadRequestException('AI 返回首封主题不能为空');
    }

    return {
      subject: draft.subject || fallbackDraft.subject,
      bodyText: draft.bodyText,
      aiDraft: draft.metadata
    };
  }

  private createDraftVersion(message: CrmMessageRecord, context: CrmUserContext) {
    return this.draftRepository.createMessageDraftVersion({
      organizationId: message.organizationId,
      ownerUserId: message.ownerUserId,
      accountId: message.accountId,
      contactId: message.contactId,
      enrollmentId: message.enrollmentId,
      messageId: message.id,
      mailboxId: message.mailboxId,
      stepIndex: message.stepIndex,
      subject: message.subject,
      bodyText: message.bodyText,
      editorId: context.userId,
      editorName: context.userName
    });
  }
}

function mergeAiDraftMessageMetadata(metadata: unknown, aiDraft?: CrmAiDraftMetadata | null) {
  if (!aiDraft) return metadata ?? null;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { aiDraft };
  }

  return {
    ...metadata,
    aiDraft
  };
}

function toAiWritingStepIndex(stepIndex: number): CrmAiWritingStepIndex {
  if (stepIndex < 1 || stepIndex > defaultSequenceStepCount) {
    throw new BadRequestException('AI 写信步骤超出范围');
  }

  return stepIndex as CrmAiWritingStepIndex;
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  return normalizeLimitedContent(value, emptyMessage, Number.MAX_SAFE_INTEGER);
}
