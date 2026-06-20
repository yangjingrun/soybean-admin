import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CrmAiDraftService } from '../crm-ai-draft.service';
import { buildNextFollowUpDraft } from '../crm-follow-up-draft';
import { buildPersonaMatch } from '../crm-persona-match';
import { CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY } from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmAiDraftMetadata,
  CrmAiWritingStepIndex,
  CrmContactRecord,
  CrmEmailTemplateGroupRecord,
  CrmGlobalConfigRecord,
  CrmMessageRecord,
  CrmPersonaProfileRecord,
  CrmProductLineRecord,
  CrmSequenceReviewRecord,
  CrmUserContext
} from '../crm.types';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { toMessageView, toSequenceEnrollmentView } from '../shared/crm-view-mappers';
import { isPrismaUniqueConflict } from '../store/prisma-error.helpers';
import type { CrmNextDraftRepository } from './crm-next-draft.repository';
import {
  blockingNextDraftMessageStatuses,
  getNextDraftSkipMessage,
  nextDraftEnrollmentStatuses,
  requireNextDraftSourceMessage
} from './crm-next-draft-rules';
import {
  createSequenceBatchExceptionResult,
  createSequenceBatchResult,
  runSequenceBatch,
  type SequenceBatchOperateResult,
  type SequenceBatchOperationInput
} from './crm-sequence-batch';

const defaultSequenceStepCount = 5;

interface GeneratedDraft {
  subject: string;
  bodyText: string;
  aiDraft?: CrmAiDraftMetadata | null;
}

type NextDraftGenerationContext = {
  globalConfig: CrmGlobalConfigRecord;
  defaultTemplateGroup: CrmEmailTemplateGroupRecord | null;
  personaProfiles: CrmPersonaProfileRecord[];
};

@Injectable()
export class CrmNextDraftService {
  constructor(
    @Inject(CRM_SEQUENCE_NEXT_DRAFT_REPOSITORY)
    private readonly nextDraftRepository: CrmNextDraftRepository,
    @Optional()
    @Inject(CrmAiDraftService)
    private readonly aiDraftService?: CrmAiDraftService | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Locally creates the next follow-up draft without Gmail, BullMQ, or mutating existing message statuses. */
  async generateNextDraft(id: string, context: CrmUserContext) {
    const item = await this.nextDraftRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return this.generateNextDraftFromReviewItem(item, context);
  }

  /** Generates follow-up drafts for eligible owner sequences while returning per-item outcomes. */
  async batchGenerateNextDrafts(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    const reviewItems = await this.nextDraftRepository.listSequenceReviewItemsByIds({
      ids: input.ids,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const reviewItemById = new Map(reviewItems.map(item => [item.enrollment.id, item]));
    let generationContextPromise: Promise<NextDraftGenerationContext> | null = null;

    return runSequenceBatch(input.ids, async id => {
      const item = reviewItemById.get(id) ?? null;

      if (!item) {
        return createSequenceBatchResult(id, 'skipped', '邮件序列不存在或无权操作');
      }

      const skipMessage = getNextDraftSkipMessage(item);

      if (skipMessage) {
        return createSequenceBatchResult(id, 'skipped', skipMessage, {
          enrollmentId: item.enrollment.id
        });
      }

      try {
        generationContextPromise ??= this.loadNextDraftGenerationContext(context.organizationId);
        const generationContext = await generationContextPromise;
        const generated = await this.generateNextDraftFromReviewItem(item, context, generationContext);

        return createSequenceBatchResult(id, 'success', `第 ${generated.message.stepIndex} 封草稿已生成`, {
          enrollmentId: generated.enrollment.id,
          messageId: generated.message.id,
          stepIndex: generated.message.stepIndex
        });
      } catch (error) {
        return createSequenceBatchExceptionResult(id, error, item.enrollment.id);
      }
    });
  }

  private async generateNextDraftFromReviewItem(
    item: CrmSequenceReviewRecord,
    context: CrmUserContext,
    generationContext?: NextDraftGenerationContext
  ) {
    const sourceMessage = requireNextDraftSourceMessage(item);
    const resolvedGenerationContext =
      generationContext ?? (await this.loadNextDraftGenerationContext(context.organizationId));
    const personaMatch = buildPersonaMatch(resolvedGenerationContext.personaProfiles, item.account, item.contact);
    const baseNextMessage = buildNextFollowUpDraft({
      item,
      sourceMessage,
      providerThreadId: sourceMessage.providerThreadId,
      baseTime: new Date(),
      followUpDelayDays: resolvedGenerationContext.globalConfig.followUpDelayDays,
      personaProfile: personaMatch.templatePersona,
      templateGroup: resolvedGenerationContext.defaultTemplateGroup,
      senderName: context.userName
    });

    if (!baseNextMessage) {
      throw new BadRequestException('当前序列没有可生成的下一步草稿');
    }

    const configuredDraft = await this.generateConfiguredReviewDraft({
      account: item.account,
      contact: item.contact,
      productLine: item.productLine,
      context,
      stepIndex: toAiWritingStepIndex(baseNextMessage.stepIndex),
      previousMessages: item.messages,
      fallbackDraft: {
        subject: baseNextMessage.subject,
        bodyText: baseNextMessage.bodyText
      }
    });
    const nextMessage: typeof baseNextMessage = {
      ...baseNextMessage,
      subject: configuredDraft.subject,
      bodyText: configuredDraft.bodyText,
      metadata: createAiDraftMessageMetadata(configuredDraft.aiDraft)
    };

    const bundle = await this.runFollowUpDraftWrite(() =>
      this.nextDraftRepository.createFollowUpDraftBundle({
        enrollmentId: item.enrollment.id,
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        expectedEnrollmentStatus: nextDraftEnrollmentStatuses,
        blockingMessageStatuses: blockingNextDraftMessageStatuses,
        message: nextMessage,
        timelineEvent: {
          organizationId: nextMessage.organizationId,
          accountId: nextMessage.accountId,
          contactId: nextMessage.contactId,
          ownerUserId: context.userId,
          eventType: 'sequence_follow_up_draft_generated',
          title: '生成后续开发信草稿',
          content: nextMessage.subject,
          metadata: {
            enrollmentId: item.enrollment.id,
            personaProfileId: personaMatch.persona?.id ?? null,
            personaProfileName: personaMatch.persona?.name ?? null,
            personaMatchMethod: personaMatch.matchMethod,
            personaMatchedKeywords: personaMatch.matchedKeywords,
            personaFallbackReason: personaMatch.fallbackReason,
            stepIndex: nextMessage.stepIndex,
            aiDraft: configuredDraft.aiDraft ?? null
          }
        }
      })
    );

    if (!bundle) {
      throw new NotFoundException('开发信序列不存在');
    }

    await this.crmLogger?.record('follow-up-draft-generate', 'CRM 后续开发信草稿本地生成', context, {
      organizationId: context.organizationId,
      accountId: bundle.message.accountId,
      contactId: bundle.message.contactId,
      enrollmentId: item.enrollment.id,
      messageId: bundle.message.id,
      stepIndex: bundle.message.stepIndex
    });

    return {
      enrollment: toSequenceEnrollmentView(bundle.enrollment),
      message: toMessageView(bundle.message)
    };
  }

  /** Loads organization-level resources reused by local next draft generation. */
  private async loadNextDraftGenerationContext(organizationId: string): Promise<NextDraftGenerationContext> {
    const [globalConfig, defaultTemplateGroup, personaProfiles] = await Promise.all([
      this.nextDraftRepository.getGlobalConfig(),
      this.nextDraftRepository.findDefaultEmailTemplateGroup(organizationId),
      this.nextDraftRepository.listActivePersonaProfiles(organizationId)
    ]);

    return {
      globalConfig,
      defaultTemplateGroup,
      personaProfiles
    };
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

    return {
      subject: draft.subject || fallbackDraft.subject,
      bodyText: draft.bodyText,
      aiDraft: draft.metadata
    };
  }

  private async runFollowUpDraftWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('已存在下一步草稿或待发送消息，请先处理后再生成');
      }

      throw error;
    }
  }
}

function createAiDraftMessageMetadata(aiDraft?: CrmAiDraftMetadata | null) {
  return aiDraft ? { aiDraft } : null;
}

function toAiWritingStepIndex(stepIndex: number): CrmAiWritingStepIndex {
  if (stepIndex < 1 || stepIndex > defaultSequenceStepCount) {
    throw new BadRequestException('AI 写信步骤超出范围');
  }

  return stepIndex as CrmAiWritingStepIndex;
}
