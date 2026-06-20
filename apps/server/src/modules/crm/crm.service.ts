import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { assertOrganizationAdmin } from '../../shared/permission-policy';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CrmLoggerService } from './shared/crm-logger.service';
import type { CrmEmailDnsResolver } from './shared/crm-email-utils';
import { createCrmReadScope } from './shared/crm-scope';
import type { CrmGmailOAuthFlowPort } from './crm-gmail-oauth-flow';
import { normalizeOwnerConcurrentSendLimit } from './crm-global-config';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmAccountService } from './accounts/crm-account.service';
import { CrmAiDraftTaskService } from './ai-draft-task/crm-ai-draft-task.service';
import { CrmAiDraftService } from './crm-ai-draft.service';
import { CrmAiReplyDraftService } from './crm-ai-reply-draft.service';
import { CrmInboxService } from './inbox/crm-inbox.service';
import { CrmMailboxService } from './mailbox/crm-mailbox.service';
import { CrmPersonaProfileService } from './persona-profiles/crm-persona-profile.service';
import type {
  PersonaProfileCreateInput,
  PersonaProfileUpdateInput
} from './persona-profiles/crm-persona-profile-rules';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from './sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from './sequence/crm-batch-sequence-stop.service';
import { CrmDraftApprovalService } from './sequence/crm-draft-approval.service';
import { CrmDraftPreviewService } from './sequence/crm-draft-preview.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmFollowUpApprovalService } from './sequence/crm-follow-up-approval.service';
import { nextDraftEnrollmentStatuses } from './sequence/crm-next-draft-rules';
import { CrmNextDraftService } from './sequence/crm-next-draft.service';
import { CrmSendQueueReconcileService } from './sequence/crm-send-queue-reconcile.service';
import { CrmSequenceControlService } from './sequence/crm-sequence-control.service';
import {
  type SequenceBatchOperateResult,
  type SequenceBatchOperationInput
} from './sequence/crm-sequence-batch';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CrmSequencePolicyService } from './sequence-policies/crm-sequence-policy.service';
import {
  type SequencePolicyWriteInput
} from './sequence-policies/crm-sequence-policy-rules';
import { CrmSettingsService } from './settings/crm-settings.service';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import { CrmEmailTemplateGroupService } from './template-groups/crm-email-template-group.service';
import {
  type EmailTemplateGroupCreateInput,
  type EmailTemplateGroupUpdateInput
} from './template-groups/crm-email-template-group-rules';
import {
  CRM_AI_DRAFT_TASK_QUEUE,
  CRM_EMAIL_DNS_RESOLVER,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_SEND_QUEUE,
  CRM_STORE
} from './crm.tokens';
import type {
  CrmAiDraftMetadata,
  CrmAiDraftTaskQueuePort,
  CrmAiDraftQueueConfigInput,
  CrmAccountStatus,
  CrmAiDraftPreviewInput,
  CrmMailboxStatus,
  CrmEmailTemplateStatus,
  CrmEmailSendGateway,
  CrmGlobalConfigRecord,
  CrmInboxThreadStatus,
  CrmMessageDraftVersionRecord,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmPersonaProfileStatus,
  CrmProductLineStatus,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewRecord,
  CrmSequenceReviewTodoType,
  CrmStrategyStatsRecord,
  CrmSendQueuePort,
  CrmStore,
  CrmUserContext,
  ImportCrmLeadInput
} from './crm.types';

const initialDraftStepIndex = 1;
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];
const approvedDraftStatus: CrmMessageStatus = 'draft_ready';

interface ProductLineCreateInput {
  name: string;
  targetCustomerType?: string | null;
  coreSellingPoints?: string | null;
  moq?: string | null;
  leadTime?: string | null;
  paymentTerms?: string | null;
  certifications?: string | null;
  catalogUrl?: string | null;
  websiteUrl?: string | null;
  commonModelsText?: string | null;
  aiWritingConfig?: unknown;
}

interface ProductLineUpdateInput extends Partial<ProductLineCreateInput> {
  status?: CrmProductLineStatus;
}

interface SequenceReviewCreateInput {
  accountId: string;
  contactId: string;
  productLineId?: string | null;
  mailboxId?: string | null;
  policyId?: string | null;
}

interface CreateAiDraftTaskInput {
  enrollmentIds: string[];
}

interface AiDraftTaskListQuery {
  current?: number;
  size?: number;
}

interface MessageDraftUpdateInput {
  subject: string;
  bodyText: string;
}

interface GmailOAuthCompleteInput {
  code: string;
  state: string;
}

@Injectable()
export class CrmService {
  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Optional()
    @Inject(CRM_EMAIL_DNS_RESOLVER)
    _dnsResolver?: CrmEmailDnsResolver,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(CRM_SEND_QUEUE)
    private readonly sendQueue?: CrmSendQueuePort,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService,
    @Optional()
    @Inject(CRM_EMAIL_SEND_GATEWAY)
    private readonly sendGateway?: CrmEmailSendGateway,
    @Optional()
    @Inject(CRM_GMAIL_OAUTH_FLOW)
    _gmailOAuthFlow?: CrmGmailOAuthFlowPort | null,
    @Optional()
    @Inject(CrmGmailWatchService)
    _gmailWatchService?: Pick<CrmGmailWatchService, 'renewMailboxWatch'> | null,
    @Optional()
    @Inject(CrmAiDraftService)
    _aiDraftService?: CrmAiDraftService | null,
    @Optional()
    @Inject(CrmAiReplyDraftService)
    private readonly aiReplyDraftService?: Pick<CrmAiReplyDraftService, 'polishReplyDraft'> | null,
    @Optional()
    @Inject(CRM_AI_DRAFT_TASK_QUEUE)
    _aiDraftTaskQueue?: CrmAiDraftTaskQueuePort | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService,
    @Optional()
    @Inject(CrmSettingsService)
    private readonly settingsService?: CrmSettingsService,
    @Optional()
    @Inject(CrmSuppressionService)
    private readonly suppressionService?: CrmSuppressionService,
    @Optional()
    @Inject(CrmAccountService)
    private readonly accountService?: CrmAccountService,
    @Optional()
    @Inject(CrmMailboxService)
    private readonly mailboxService?: CrmMailboxService,
    @Optional()
    @Inject(CrmPersonaProfileService)
    private readonly personaProfileService?: CrmPersonaProfileService,
    @Optional()
    @Inject(CrmProductLineService)
    private readonly productLineService?: CrmProductLineService,
    @Optional()
    @Inject(CrmSequenceService)
    private readonly sequenceService?: CrmSequenceService,
    @Optional()
    @Inject(CrmSequenceControlService)
    private readonly sequenceControlService?: CrmSequenceControlService,
    @Optional()
    @Inject(CrmSendQueueReconcileService)
    private readonly sendQueueReconcileService?: CrmSendQueueReconcileService,
    @Optional()
    @Inject(CrmSequencePolicyService)
    private readonly sequencePolicyService?: CrmSequencePolicyService,
    @Optional()
    @Inject(CrmEmailTemplateGroupService)
    private readonly templateGroupService?: CrmEmailTemplateGroupService,
    @Optional()
    @Inject(CrmDraftService)
    private readonly draftService?: CrmDraftService,
    @Optional()
    @Inject(CrmDraftPreviewService)
    private readonly draftPreviewService?: CrmDraftPreviewService,
    @Optional()
    @Inject(CrmNextDraftService)
    private readonly nextDraftService?: CrmNextDraftService,
    @Optional()
    @Inject(CrmDraftApprovalService)
    private readonly draftApprovalService?: CrmDraftApprovalService,
    @Optional()
    @Inject(CrmFollowUpApprovalService)
    private readonly followUpApprovalService?: CrmFollowUpApprovalService,
    @Optional()
    @Inject(CrmBatchDraftApprovalService)
    private readonly batchDraftApprovalService?: CrmBatchDraftApprovalService,
    @Optional()
    @Inject(CrmBatchSequenceStopService)
    private readonly batchSequenceStopService?: CrmBatchSequenceStopService,
    @Optional()
    @Inject(CrmAiDraftTaskService)
    private readonly aiDraftTaskService?: CrmAiDraftTaskService,
    @Optional()
    @Inject(CrmInboxService)
    private readonly inboxService?: CrmInboxService
  ) {}

  /** Imports one lead candidate into the organization CRM with domain and email dedupe. */
  async importAccountFromLead(input: ImportCrmLeadInput, context: CrmUserContext) {
    return this.requireAccountService().importAccountFromLead(input, context);
  }

  /** Lists accounts within the current organization and applies member ownership isolation. */
  async listAccounts(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmAccountStatus;
    } = {}
  ) {
    return this.requireAccountService().listAccounts(context, query);
  }

  /** Returns one account detail within the current user's organization scope. */
  async getAccountDetail(id: string, context: CrmUserContext) {
    return this.requireAccountService().getAccountDetail(id, context);
  }

  /** Changes the scoped account status and records a timeline event. */
  async updateAccountStatus(
    id: string,
    input: {
      status: CrmAccountStatus;
      remark?: string | null;
    },
    context: CrmUserContext
  ) {
    return this.requireAccountService().updateAccountStatus(id, input, context);
  }

  /** Adds a user note to the scoped account timeline. */
  async addAccountNote(
    id: string,
    input: {
      content: string;
    },
    context: CrmUserContext
  ) {
    return this.requireAccountService().addAccountNote(id, input, context);
  }

  /** Archives the scoped account and records the archive reason in timeline. */
  async archiveAccount(
    id: string,
    input: {
      reason?: string | null;
    },
    context: CrmUserContext
  ) {
    return this.requireAccountService().archiveAccount(id, input, context);
  }

  /** Restores an archived account while the full recovery window is still open. */
  async restoreAccount(id: string, context: CrmUserContext) {
    return this.requireAccountService().restoreAccount(id, context);
  }

  /** Verifies one scoped contact email with basic syntax and MX lookup. */
  async verifyContactEmail(id: string, context: CrmUserContext) {
    return this.requireAccountService().verifyContactEmail(id, context);
  }

  /** Reads platform-wide CRM settings maintained by super administrators. */
  async getGlobalConfig() {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.getGlobalConfig();
  }

  /** Saves platform-wide CRM settings maintained by super administrators. */
  async saveGlobalConfig(
    input: {
      emailVerificationCooldownDays: number;
      ownerConcurrentSendLimit?: number;
      ownerDailySendLimitMax?: number;
      followUpDelayDays?: CrmGlobalConfigRecord['followUpDelayDays'];
    },
    context: CrmUserContext
  ) {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.saveGlobalConfig(input, context);
  }

  /** Reads the current owner's send scheduling preference with platform cap context. */
  async getSendPreference(context: CrmUserContext) {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.getSendPreference(context);
  }

  /** Saves the current owner's daily send scheduling preference. */
  async saveSendPreference(
    input: {
      dailySendLimit: number;
      followUpSharePercent: number;
    },
    context: CrmUserContext
  ) {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.saveSendPreference(input, context);
  }

  /** Reads organization-level CRM permission settings. */
  async getOrganizationConfig(context: CrmUserContext) {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.getOrganizationConfig(context);
  }

  /** Saves organization-level CRM permission settings for organization administrators. */
  async saveOrganizationConfig(
    input: {
      allowAdminViewMemberEmailBody: boolean;
    },
    context: CrmUserContext
  ) {
    if (!this.settingsService) {
      throw new BadRequestException('CRM 配置服务未启用');
    }

    return this.settingsService.saveOrganizationConfig(input, context);
  }

  /** Lists organization-level unsubscribe blacklist entries without exposing raw emails. */
  async listBlacklistEntries(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
    } = {}
  ) {
    return this.requireSuppressionService().listBlacklistEntries(context, query);
  }

  /** Removes one organization blacklist entry after recording an audit reason. */
  async removeBlacklistEntry(id: string, input: { reason?: string | null }, context: CrmUserContext) {
    return this.requireSuppressionService().removeBlacklistEntry(id, input, context);
  }

  /** Creates a Gmail mock authorization record without storing any OAuth token. */
  async mockAuthorizeMailbox(input: { emailAddress: string }, context: CrmUserContext) {
    return this.requireMailboxService().mockAuthorizeMailbox(input, context);
  }

  /** Creates a Google consent URL for the current user mailbox authorization flow. */
  createGmailOAuthAuthorizationUrl(context: CrmUserContext) {
    return this.requireMailboxService().createGmailOAuthAuthorizationUrl(context);
  }

  /** Completes Gmail OAuth authorization and stores the encrypted refresh token for the mailbox owner. */
  async completeGmailOAuthAuthorization(input: GmailOAuthCompleteInput, context: CrmUserContext) {
    return this.requireMailboxService().completeGmailOAuthAuthorization(input, context);
  }

  /** Lists mailboxes within the current organization and applies member ownership isolation. */
  async listMailboxes(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmMailboxStatus;
    } = {}
  ) {
    return this.requireMailboxService().listMailboxes(context, query);
  }

  /** Pauses a scoped mailbox after verifying the current user can read it. */
  async pauseMailbox(id: string, context: CrmUserContext) {
    return this.requireMailboxService().pauseMailbox(id, context);
  }

  /** Resumes a scoped mailbox after verifying the current user can read it. */
  async resumeMailbox(id: string, context: CrmUserContext) {
    return this.requireMailboxService().resumeMailbox(id, context);
  }

  /** Lists organization-level product lines for the current organization. */
  async listProductLines(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmProductLineStatus;
    } = {}
  ) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.listProductLines(context, query);
  }

  /** Creates an organization-level product line after checking name uniqueness. */
  async createProductLine(input: ProductLineCreateInput, context: CrmUserContext) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.createProductLine(input, context);
  }

  /** Updates an organization-level product line through organization scoped reads and writes. */
  async updateProductLine(id: string, input: ProductLineUpdateInput, context: CrmUserContext) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.updateProductLine(id, input, context);
  }

  /** Lists AI prompt versions for an organization-scoped product line. */
  async listProductLineAiPromptVersions(id: string, context: CrmUserContext) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.listProductLineAiPromptVersions(id, context);
  }

  /** Restores a saved AI prompt version to the current product-line config. */
  async restoreProductLineAiPromptVersion(id: string, versionId: string, context: CrmUserContext) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.restoreProductLineAiPromptVersion(id, versionId, context);
  }

  /** Archives an organization-level product line through organization scoped reads and writes. */
  async archiveProductLine(id: string, context: CrmUserContext) {
    if (!this.productLineService) {
      throw new BadRequestException('CRM 产品资料服务未启用');
    }

    return this.productLineService.archiveProductLine(id, context);
  }

  /** Lists organization-level persona profiles used by CRM draft generation. */
  async listPersonaProfiles(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmPersonaProfileStatus;
    } = {}
  ) {
    if (!this.personaProfileService) {
      throw new BadRequestException('CRM 画像服务未启用');
    }

    return this.personaProfileService.listPersonaProfiles(context, query);
  }

  /** Creates an organization-level persona profile after checking manager permission. */
  async createPersonaProfile(input: PersonaProfileCreateInput, context: CrmUserContext) {
    if (!this.personaProfileService) {
      throw new BadRequestException('CRM 画像服务未启用');
    }

    return this.personaProfileService.createPersonaProfile(input, context);
  }

  /** Updates one organization persona profile through scoped reads and writes. */
  async updatePersonaProfile(id: string, input: PersonaProfileUpdateInput, context: CrmUserContext) {
    if (!this.personaProfileService) {
      throw new BadRequestException('CRM 画像服务未启用');
    }

    return this.personaProfileService.updatePersonaProfile(id, input, context);
  }

  /** Archives one persona profile instead of deleting it. */
  async archivePersonaProfile(id: string, context: CrmUserContext) {
    if (!this.personaProfileService) {
      throw new BadRequestException('CRM 画像服务未启用');
    }

    return this.personaProfileService.archivePersonaProfile(id, context);
  }

  /** Marks one active persona profile as the organization default. */
  async setDefaultPersonaProfile(id: string, context: CrmUserContext) {
    if (!this.personaProfileService) {
      throw new BadRequestException('CRM 画像服务未启用');
    }

    return this.personaProfileService.setDefaultPersonaProfile(id, context);
  }

  /** Lists organization-level email template groups for CRM sequence drafting. */
  async listEmailTemplateGroups(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmEmailTemplateStatus;
    } = {}
  ) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.listEmailTemplateGroups(context, query);
  }

  /** Creates one organization-level email template group with exactly five sequence steps. */
  async createEmailTemplateGroup(input: EmailTemplateGroupCreateInput, context: CrmUserContext) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.createEmailTemplateGroup(input, context);
  }

  /** Updates one organization-level email template group and replaces step rows when provided. */
  async updateEmailTemplateGroup(id: string, input: EmailTemplateGroupUpdateInput, context: CrmUserContext) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.updateEmailTemplateGroup(id, input, context);
  }

  /** Archives one organization-level email template group instead of deleting it. */
  async archiveEmailTemplateGroup(id: string, context: CrmUserContext) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.archiveEmailTemplateGroup(id, context);
  }

  /** Marks one active organization-level email template group as the default drafting template. */
  async setDefaultEmailTemplateGroup(id: string, context: CrmUserContext) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.setDefaultEmailTemplateGroup(id, context);
  }

  /** Returns the read-only default template and persona rules used by first-draft generation. */
  async getTemplateDefaults(context: CrmUserContext) {
    if (!this.templateGroupService) {
      throw new BadRequestException('CRM 邮件模板服务未启用');
    }

    return this.templateGroupService.getTemplateDefaults(context);
  }

  /** Lists organization sequence policies for sequence creation and settings. */
  async listSequencePolicies(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: unknown;
    } = {}
  ) {
    if (!this.sequencePolicyService) {
      throw new BadRequestException('CRM 序列策略服务未启用');
    }

    return this.sequencePolicyService.listSequencePolicies(context, query);
  }

  /** Creates one organization sequence policy. */
  async createSequencePolicy(input: SequencePolicyWriteInput, context: CrmUserContext) {
    if (!this.sequencePolicyService) {
      throw new BadRequestException('CRM 序列策略服务未启用');
    }

    return this.sequencePolicyService.createSequencePolicy(input, context);
  }

  /** Updates one organization sequence policy. */
  async updateSequencePolicy(id: string, input: SequencePolicyWriteInput, context: CrmUserContext) {
    if (!this.sequencePolicyService) {
      throw new BadRequestException('CRM 序列策略服务未启用');
    }

    return this.sequencePolicyService.updateSequencePolicy(id, input, context);
  }

  /** Archives one sequence policy instead of deleting it. */
  async archiveSequencePolicy(id: string, context: CrmUserContext) {
    if (!this.sequencePolicyService) {
      throw new BadRequestException('CRM 序列策略服务未启用');
    }

    return this.sequencePolicyService.archiveSequencePolicy(id, context);
  }

  /** Marks one active organization sequence policy as default. */
  async setDefaultSequencePolicy(id: string, context: CrmUserContext) {
    if (!this.sequencePolicyService) {
      throw new BadRequestException('CRM 序列策略服务未启用');
    }

    return this.sequencePolicyService.setDefaultSequencePolicy(id, context);
  }

  /** Creates one first-email review item and deterministic draft without queueing any send job. */
  async createSequenceReviewItem(input: SequenceReviewCreateInput, context: CrmUserContext) {
    return this.requireSequenceService().createSequenceReviewItem(input, context);
  }

  /** Previews a configured AI draft without creating messages or send jobs. */
  async previewAiDraft(input: CrmAiDraftPreviewInput, context: CrmUserContext) {
    return this.requireDraftPreviewService().previewAiDraft(input, context);
  }

  /** Lists first-email review items within the current organization scope. */
  async listSequenceReviewItems(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmSequenceEnrollmentStatus;
      todoType?: CrmSequenceReviewTodoType;
      messageStatus?: CrmMessageStatus;
      dateScope?: 'today';
    } = {}
  ) {
    return this.requireSequenceService().listSequenceReviewItems(context, query);
  }

  /** Reads local CRM funnel stats grouped by template, policy, persona and product line. */
  async listStrategyStats(context: CrmUserContext): Promise<CrmStrategyStatsRecord> {
    return this.store.listStrategyStats({
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });
  }

  /** Reads the current user's action-first CRM workbench overview. */
  async getWorkbenchOverview(context: CrmUserContext, now = new Date()) {
    return this.store.getWorkbenchOverview({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      now
    });
  }

  /** Returns one review item detail with the first draft message. */
  async getSequenceReviewItem(id: string, context: CrmUserContext) {
    return this.requireSequenceService().getSequenceReviewItem(id, context);
  }

  /** Saves human edits to one draft and keeps it in pending review. */
  async updateMessageDraft(id: string, input: MessageDraftUpdateInput, context: CrmUserContext) {
    if (this.draftService) {
      return this.draftService.updateMessageDraft(id, input, context);
    }

    const message = await this.requireOwnedEditableMessage(id, context);
    const updatedMessage = await this.store.updateMessage(
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

    await this.store.createMessageDraftVersion({
      organizationId: updatedMessage.organizationId,
      ownerUserId: updatedMessage.ownerUserId,
      accountId: updatedMessage.accountId,
      contactId: updatedMessage.contactId,
      enrollmentId: updatedMessage.enrollmentId,
      messageId: updatedMessage.id,
      mailboxId: updatedMessage.mailboxId,
      stepIndex: updatedMessage.stepIndex,
      subject: updatedMessage.subject,
      bodyText: updatedMessage.bodyText,
      editorId: context.userId,
      editorName: context.userName
    });

    await this.store.createTimelineEvent({
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
    return this.requireDraftService().regenerateMessageAiDraft(id, context);
  }

  /** Lists saved snapshots for one owner draft message. */
  async listMessageDraftVersions(id: string, context: CrmUserContext) {
    if (this.draftService) {
      return this.draftService.listMessageDraftVersions(id, context);
    }

    await this.requireOwnedMessage(id, context);
    const versions = await this.store.listMessageDraftVersions({
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
    if (this.draftService) {
      return this.draftService.restoreMessageDraftVersion(id, versionId, context);
    }

    const message = await this.requireOwnedEditableMessage(id, context);
    const restoredMessage = await this.store.restoreMessageDraftVersion({
      messageId: message.id,
      versionId,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!restoredMessage) {
      throw new NotFoundException('草稿版本不存在');
    }

    await this.store.createTimelineEvent({
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

    await this.recordCrmLog('draft-version-restore', 'CRM 开发信草稿恢复历史版本', context, {
      enrollmentId: restoredMessage.enrollmentId,
      messageId: restoredMessage.id,
      versionId
    });

    return {
      message: toMessageView(restoredMessage)
    };
  }

  /** Marks one reviewed draft as ready for the future send queue without sending it. */
  async approveMessageDraft(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);

    if (message.stepIndex === initialDraftStepIndex && this.draftApprovalService) {
      return this.draftApprovalService.approveInitialMessageDraft(id, context);
    }

    if (message.stepIndex > initialDraftStepIndex && this.followUpApprovalService) {
      return this.followUpApprovalService.approveFollowUpMessageDraft(id, context);
    }

    const reviewItem = await this.requireOwnedSequenceReviewItem(message.enrollmentId, context);

    if (message.stepIndex > initialDraftStepIndex) {
      return this.approveFollowUpMessageDraft(message, reviewItem, context);
    }

    if (message.stepIndex !== initialDraftStepIndex) {
      throw new BadRequestException('当前草稿不是首封开发信');
    }

    if (reviewItem.enrollment.status !== 'draft_review_pending') {
      throw new BadRequestException('当前序列状态不能确认草稿');
    }

    const approval = await this.store.approveMessageDraft({
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

    await this.recordCrmLog('draft-approve', 'CRM 首封开发信人工确认', context, {
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

  /** Locally creates the next follow-up draft without Gmail, BullMQ, or mutating existing message statuses. */
  async generateNextDraft(id: string, context: CrmUserContext) {
    if (!this.nextDraftService) {
      throw new BadRequestException('CRM 后续草稿生成服务未启用');
    }

    return this.nextDraftService.generateNextDraft(id, context);
  }

  /** Generates follow-up drafts for eligible owner sequences while returning per-item outcomes. */
  async batchGenerateNextDrafts(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    if (!this.nextDraftService) {
      throw new BadRequestException('CRM 后续草稿生成服务未启用');
    }

    return this.nextDraftService.batchGenerateNextDrafts(input, context);
  }

  /** Creates a local CRM AI draft task and queues pending items for review-only draft generation. */
  async createAiDraftTask(input: CreateAiDraftTaskInput, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.createAiDraftTask(input, context);
  }

  async getCurrentAiDraftTask(context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.getCurrentAiDraftTask(context);
  }

  async listAiDraftTasks(context: CrmUserContext, query: AiDraftTaskListQuery = {}) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.listAiDraftTasks(context, query);
  }

  async getAiDraftTaskDetail(id: string, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.getAiDraftTaskDetail(id, context);
  }

  async retryFailedAiDraftTask(id: string, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.retryFailedAiDraftTask(id, context);
  }

  async cancelAiDraftTask(id: string, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.cancelAiDraftTask(id, context);
  }

  async markAiDraftTaskRead(id: string, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.markAiDraftTaskRead(id, context);
  }

  async getAiDraftQueueConfig() {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.getAiDraftQueueConfig();
  }

  async saveAiDraftQueueConfig(input: CrmAiDraftQueueConfigInput, context: CrmUserContext) {
    if (!this.aiDraftTaskService) {
      throw new BadRequestException('CRM AI 草稿任务服务未启用');
    }

    return this.aiDraftTaskService.saveAiDraftQueueConfig(input, context);
  }

  /** Confirms pending owner drafts locally without Gmail, BullMQ, or send queue side effects. */
  async batchApproveMessageDrafts(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    if (!this.batchDraftApprovalService) {
      throw new BadRequestException('CRM 批量草稿确认服务未启用');
    }

    return this.batchDraftApprovalService.batchApproveMessageDrafts(input, context);
  }

  /** Confirms a follow-up draft locally, or schedules it when the sequence is already sending. */
  private async approveFollowUpMessageDraft(
    message: CrmMessageRecord,
    reviewItem: CrmSequenceReviewRecord,
    context: CrmUserContext
  ) {
    if (!nextDraftEnrollmentStatuses.includes(reviewItem.enrollment.status)) {
      throw new BadRequestException('当前序列状态不能确认后续草稿');
    }

    if (reviewItem.enrollment.status === 'ready_to_send') {
      const approval = await this.store.approveMessageDraft({
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

      await this.recordCrmLog('follow-up-draft-approve-local', 'CRM 后续开发信人工确认', context, {
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

    const approval = await this.store.approveMessageDraft({
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

    await this.recordCrmLog('follow-up-draft-approve', 'CRM 后续开发信人工确认并等待发送调度', context, {
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

  /** Starts the approved first message by placing it into the local send scheduling pool. */
  async startFirstMessageSend(id: string, context: CrmUserContext) {
    return this.requireSequenceControlService().startFirstMessageSend(id, context);
  }

  /** Stops a sequence and invalidates queued jobs by bumping runVersion. */
  async stopSequenceEnrollment(id: string, context: CrmUserContext) {
    return this.requireSequenceControlService().stopSequenceEnrollment(id, context);
  }

  /** Stops eligible owner sequences in isolation so one failure does not abort the whole batch. */
  async batchStopSequenceEnrollments(
    input: SequenceBatchOperationInput,
    context: CrmUserContext
  ): Promise<SequenceBatchOperateResult> {
    if (!this.batchSequenceStopService) {
      throw new BadRequestException('CRM 批量序列停止服务未启用');
    }

    return this.batchSequenceStopService.batchStopSequenceEnrollments(input, context);
  }

  /** Repairs stale queued messages that lost their BullMQ job. */
  async reconcileSendQueue(input: { now?: Date; staleMinutes?: number; take?: number } = {}, context: CrmUserContext) {
    return this.requireSendQueueReconcileService().reconcileSendQueue(input, context);
  }

  /** Lists customer reply inbox threads in the current organization scope. */
  async listInboxThreads(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmInboxThreadStatus;
      mailboxId?: string;
    } = {}
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.listInboxThreads(context, query);
  }

  /** Returns one customer reply inbox thread with messages and timeline. */
  async getInboxThread(id: string, context: CrmUserContext) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.getInboxThread(id, context);
  }

  /** Polishes a user-provided reply topic and saves it as an owner-only local draft. */
  async polishInboxReplyDraft(
    id: string,
    input: {
      topic: string;
      productLineId?: string | null;
    },
    context: CrmUserContext
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.polishInboxReplyDraft(id, input, context);
  }

  /** Saves a manually edited local reply draft without AI or Gmail side effects. */
  async saveInboxReplyDraft(
    id: string,
    input: {
      topic: string;
      bodyText: string;
    },
    context: CrmUserContext
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.saveInboxReplyDraft(id, input, context);
  }

  /** Updates one owner-scoped inbox thread processing status. */
  async updateInboxThreadStatus(
    id: string,
    input: {
      status: CrmInboxThreadStatus;
    },
    context: CrmUserContext
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.updateInboxThreadStatus(id, input, context);
  }

  /** Sends a plain-text reply from the owner mailbox and marks the inbox thread handled. */
  async replyInboxThread(
    id: string,
    input: {
      bodyText: string;
    },
    context: CrmUserContext
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.replyInboxThread(id, input, context);
  }

  /** Mock-ingests a customer reply for a sent outbound message before Gmail sync is wired. */
  async mockCustomerReply(
    outboundMessageId: string,
    input: {
      subject?: string | null;
      bodyText: string;
      receivedAt?: string | null;
    },
    context: CrmUserContext
  ) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.mockCustomerReply(outboundMessageId, input, context);
  }

  /** Confirms a weak unsubscribe signal and applies the blacklist transaction for the owner. */
  async confirmInboxMessageUnsubscribe(id: string, context: CrmUserContext) {
    if (!this.inboxService) {
      throw new BadRequestException('CRM 收件箱服务未启用');
    }

    return this.inboxService.confirmInboxMessageUnsubscribe(id, context);
  }

  private requireAccountService() {
    if (!this.accountService) {
      throw new BadRequestException('CRM 线索服务未启用');
    }

    return this.accountService;
  }

  private requireMailboxService() {
    if (!this.mailboxService) {
      throw new BadRequestException('CRM 邮箱服务未启用');
    }

    return this.mailboxService;
  }

  private requireSuppressionService() {
    if (!this.suppressionService) {
      throw new BadRequestException('CRM 退订黑名单服务未启用');
    }

    return this.suppressionService;
  }

  private requireSequenceService() {
    if (!this.sequenceService) {
      throw new BadRequestException('CRM 邮件序列服务未启用');
    }

    return this.sequenceService;
  }

  private requireSequenceControlService() {
    if (!this.sequenceControlService) {
      throw new BadRequestException('CRM 邮件序列控制服务未启用');
    }

    return this.sequenceControlService;
  }

  private requireSendQueueReconcileService() {
    if (!this.sendQueueReconcileService) {
      throw new BadRequestException('CRM 发送队列对账服务未启用');
    }

    return this.sendQueueReconcileService;
  }

  private requireDraftPreviewService() {
    if (!this.draftPreviewService) {
      throw new BadRequestException('CRM 草稿预览服务未启用');
    }

    return this.draftPreviewService;
  }

  private requireDraftService() {
    if (!this.draftService) {
      throw new BadRequestException('CRM 草稿服务未启用');
    }

    return this.draftService;
  }

  private async requireOwnedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.store.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
  }

  /** Ensures one owner does not keep more queued outbound emails than the platform allows. */
  private async assertOwnerSendConcurrencyAvailable(context: CrmUserContext) {
    const [globalConfig, queuedCount] = await Promise.all([
      this.store.getGlobalConfig(),
      this.store.countOwnerQueuedMessages({
        organizationId: context.organizationId,
        ownerUserId: context.userId
      })
    ]);
    const limit = normalizeOwnerConcurrentSendLimit(globalConfig.ownerConcurrentSendLimit);

    if (queuedCount >= limit) {
      throw new BadRequestException(`当前用户已有 ${queuedCount} 封邮件在发送队列中，已达到并发上限 ${limit} 封`);
    }
  }

  private async requireOwnedMessage(id: string, context: CrmUserContext) {
    const message = await this.store.findMessageById({
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
    const message = await this.store.findMessageById({
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

  private async enqueueFirstMessage(
    enrollment: CrmSequenceEnrollmentRecord,
    message: CrmMessageRecord,
    delayMs?: number
  ) {
    if (!this.sendQueue) {
      throw new BadRequestException('CRM 邮件发送队列未启用');
    }

    return this.sendQueue.enqueueFirstMessage(
      {
        enrollmentId: enrollment.id,
        messageId: message.id,
        organizationId: enrollment.organizationId,
        ownerUserId: enrollment.ownerUserId,
        runVersion: enrollment.runVersion
      },
      delayMs ? { delayMs } : undefined
    );
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

  private recordCrmLog(action: string, message: string, context: CrmUserContext, metadata: Record<string, unknown>) {
    if (this.crmLogger) {
      return this.crmLogger.record(action, message, context, metadata);
    }

    return this.systemLogService?.record({
      level: 'info',
      status: 'success',
      module: 'crm',
      action,
      message,
      userId: context.userId,
      userName: context.userName,
      metadata
    });
  }

  private requireOrganizationConfigManager(context: CrmUserContext) {
    assertOrganizationAdmin(context, '仅组织管理员可修改 CRM 权限配置');
  }

}

function toSequenceEnrollmentView(record: CrmSequenceEnrollmentRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toMessageView(record: CrmMessageRecord) {
  return {
    ...record,
    aiDraft: readCrmMessageAiDraftMetadata(record.metadata),
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    sentAt: record.sentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toMessageDraftVersionView(record: CrmMessageDraftVersionRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

function toOwnerScope(context: CrmUserContext) {
  const scope = createCrmReadScope(context);
  return scope.ownerUserId ? { ownerUserId: scope.ownerUserId } : {};
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}

function readCrmMessageAiDraftMetadata(metadata: unknown): CrmAiDraftMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const value = (metadata as { aiDraft?: unknown }).aiDraft;

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Partial<CrmAiDraftMetadata>;

  if (record.generated !== true || typeof record.reason !== 'string' || !Array.isArray(record.riskNotes)) {
    return null;
  }

  if (!record.snapshot || typeof record.snapshot !== 'object' || Array.isArray(record.snapshot)) {
    return null;
  }

  return record as CrmAiDraftMetadata;
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
