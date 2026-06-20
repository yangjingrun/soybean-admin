import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolveMx } from 'node:dns/promises';
import { Prisma } from '../../generated/prisma/client';
import { createPageResult } from '../../shared/pagination';
import {
  assertOrganizationAdmin,
  assertSuper,
  isOrganizationAdmin as hasOrganizationAdminRole,
  isSuper
} from '../../shared/permission-policy';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import { CrmLoggerService } from './shared/crm-logger.service';
import type { CrmEmailDnsResolver } from './shared/crm-email-utils';
import { createCrmReadScope } from './shared/crm-scope';
import type { CrmGmailOAuthFlowPort } from './crm-gmail-oauth-flow';
import {
  normalizeEmailVerificationCooldownDays,
  normalizeOwnerConcurrentSendLimit
} from './crm-global-config';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { CrmAccountService } from './accounts/crm-account.service';
import { CrmAiDraftTaskService } from './ai-draft-task/crm-ai-draft-task.service';
import { CrmAiDraftService } from './crm-ai-draft.service';
import { CrmAiReplyDraftService } from './crm-ai-reply-draft.service';
import { CrmInboxService } from './inbox/crm-inbox.service';
import { CrmMailboxService } from './mailbox/crm-mailbox.service';
import { CrmProductLineService } from './product-lines/crm-product-line.service';
import { CrmBatchDraftApprovalService } from './sequence/crm-batch-draft-approval.service';
import { CrmBatchSequenceStopService } from './sequence/crm-batch-sequence-stop.service';
import { CrmDraftApprovalService } from './sequence/crm-draft-approval.service';
import { CrmDraftService } from './sequence/crm-draft.service';
import { CrmFollowUpApprovalService } from './sequence/crm-follow-up-approval.service';
import { getNextDraftSkipMessage, nextDraftEnrollmentStatuses } from './sequence/crm-next-draft-rules';
import { CrmNextDraftService } from './sequence/crm-next-draft.service';
import {
  type SequenceBatchOperateResult,
  type SequenceBatchOperationInput
} from './sequence/crm-sequence-batch';
import { CrmSequenceService } from './sequence/crm-sequence.service';
import { CrmSettingsService } from './settings/crm-settings.service';
import { CrmSuppressionService } from './suppression/crm-suppression.service';
import { requireEnabledCrmProductLineAiWritingConfig } from './crm-ai-draft-prompt';
import {
  defaultSequencePolicySteps,
  normalizeSequencePolicyLinkPolicy,
  normalizeSequencePolicySameCompanyStrategy,
  normalizeSequencePolicyStatus,
  normalizeSequencePolicySteps
} from './crm-sequence-policy';
import {
  defaultTemplateSteps,
  defaultTemplateVariables,
  findPersonaProfile,
  personaProfiles,
  renderEmailTemplateText,
  type PersonaProfile
} from './crm-email-template-renderer';
import { buildPersonaMatch, toTemplatePersonaProfile, type ResolvedPersonaMatch } from './crm-persona-match';
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
  CrmAiDraftTaskCreateLimitReason,
  CrmAiDraftTaskCreateItemInput,
  CrmAiDraftTaskItemRecord,
  CrmAiDraftTaskQueuePort,
  CrmAiDraftTaskRecord,
  CrmAiDraftQueueConfigInput,
  CrmAiWritingStepIndex,
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintType,
  CrmArchivedFingerprintUpsertInput,
  CrmAiDraftPreviewInput,
  CrmBlacklistRecord,
  CrmMailboxProvider,
  CrmMailboxRecord,
  CrmMailboxStatus,
  CrmContactRecord,
  CrmEmailTemplateGroupRecord,
  CrmEmailTemplateGroupUpdateInput,
  CrmEmailTemplateStatus,
  CrmEmailTemplateStepInput,
  CrmEmailVerificationReason,
  CrmEmailStatus,
  CrmEmailSendGateway,
  CrmGlobalConfigRecord,
  CrmInboxThreadStatus,
  CrmMessageDraftVersionRecord,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmMessageThreadMode,
  CrmPersonaMatchInfo,
  CrmPersonaProfileRecord,
  CrmPersonaProfileStatus,
  CrmPersonaProfileUpdateInput,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequencePolicyRecord,
  CrmSequenceReviewRecord,
  CrmSequenceReviewTodoType,
  CrmStrategyStatsRecord,
  CrmSendQueuePort,
  CrmStore,
  CrmTimelineEventRecord,
  CrmUserContext,
  ImportCrmLeadInput
} from './crm.types';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const maxNoteLength = 2000;
const gmailProvider: CrmMailboxProvider = 'gmail';
const gmailHistorySyncScopes = new Set([
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata'
]);
const defaultMailboxDailyLimit = 50;
const defaultMailboxHourlyLimit = 10;
const defaultEmailTemplateStatus: CrmEmailTemplateStatus = 'active';
const defaultPersonaProfileStatus: CrmPersonaProfileStatus = 'active';
const defaultSequenceStepCount = 5;
const initialDraftStepIndex = 1;
const accountArchiveRecoveryDays = 30;
const activeSequenceStatuses: CrmSequenceEnrollmentStatus[] = [
  'draft_review_pending',
  'ready_to_send',
  'sequence_running',
  'paused'
];
const editableDraftStatuses: CrmMessageStatus[] = ['draft_pending_review'];
const approvedDraftStatus: CrmMessageStatus = 'draft_ready';
const stoppableSequenceStatuses: CrmSequenceEnrollmentStatus[] = [...activeSequenceStatuses];
const noMxErrorCodes = new Set(['ENODATA', 'ENOTFOUND']);

const publicEmailPrefixes = new Set([
  'admin',
  'contact',
  'hello',
  'info',
  'office',
  'purchasing',
  'sales',
  'service',
  'support'
]);

interface EmailVerificationProbeResult {
  status: Extract<CrmEmailStatus, 'valid' | 'invalid' | 'risky' | 'unreachable'>;
  domain: string | null;
  reason: CrmEmailVerificationReason;
}

interface EmailVerificationResult extends EmailVerificationProbeResult {
  cacheHit: boolean;
}

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

interface PersonaProfileCreateInput {
  name: string;
  description?: string | null;
  titleKeywordsText?: string | null;
  customerTypeKeywordsText?: string | null;
  painPoints?: string | null;
  focusText?: string | null;
  avoidText?: string | null;
  isDefault?: boolean;
}

interface PersonaProfileUpdateInput extends Partial<PersonaProfileCreateInput> {
  status?: CrmPersonaProfileStatus;
}

interface EmailTemplateStepInput {
  stepIndex: number;
  name: string;
  threadMode: CrmMessageThreadMode;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

interface EmailTemplateCreateInput {
  name: string;
  language?: string | null;
  description?: string | null;
  steps: EmailTemplateStepInput[];
}

interface EmailTemplateUpdateInput extends Partial<Omit<EmailTemplateCreateInput, 'steps'>> {
  status?: CrmEmailTemplateStatus;
  isDefault?: boolean;
  steps?: EmailTemplateStepInput[];
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

interface SequencePolicyWriteInput {
  name?: string;
  description?: string | null;
  status?: unknown;
  isDefault?: boolean;
  steps?: unknown;
  linkPolicy?: unknown;
  allowLowRiskAutoSend?: boolean;
  sameCompanyContactStrategy?: unknown;
}

interface MessageDraftUpdateInput {
  subject: string;
  bodyText: string;
}

interface GmailOAuthCompleteInput {
  code: string;
  state: string;
}

interface GeneratedDraft {
  subject: string;
  bodyText: string;
  aiDraft?: CrmAiDraftMetadata | null;
}

@Injectable()
export class CrmService {
  private readonly dnsResolver: CrmEmailDnsResolver;

  constructor(
    @Inject(CRM_STORE) private readonly store: CrmStore,
    @Optional()
    @Inject(CRM_EMAIL_DNS_RESOLVER)
    dnsResolver?: CrmEmailDnsResolver,
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
    private readonly gmailOAuthFlow?: CrmGmailOAuthFlowPort | null,
    @Optional()
    @Inject(CrmGmailWatchService)
    private readonly gmailWatchService?: Pick<CrmGmailWatchService, 'renewMailboxWatch'> | null,
    @Optional()
    @Inject(CrmAiDraftService)
    private readonly aiDraftService?: CrmAiDraftService | null,
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
    @Inject(CrmProductLineService)
    private readonly productLineService?: CrmProductLineService,
    @Optional()
    @Inject(CrmSequenceService)
    private readonly sequenceService?: CrmSequenceService,
    @Optional()
    @Inject(CrmDraftService)
    private readonly draftService?: CrmDraftService,
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
  ) {
    this.dnsResolver = dnsResolver ?? { resolveMx };
  }

  /** Imports one lead candidate into the organization CRM with domain and email dedupe. */
  async importAccountFromLead(input: ImportCrmLeadInput, context: CrmUserContext) {
    if (this.accountService) {
      return this.accountService.importAccountFromLead(input, context);
    }

    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException('客户名称不能为空');
    }

    const domain = normalizeDomain(input.websiteUrl);
    const archivedMatches = await this.findArchivedImportMatches(domain, input, context);
    const existingAccount = domain
      ? await this.store.findAccountByDomain(context.organizationId, context.userId, domain)
      : null;
    const account =
      existingAccount ??
      (await this.store.createAccount({
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        name,
        normalizedName: normalizeName(name),
        websiteUrl: normalizeNullableString(input.websiteUrl),
        domain,
        country: normalizeNullableString(input.country),
        customerType: normalizeNullableString(input.customerType),
        status: input.contact?.email ? 'email_verification_pending' : 'missing_contact',
        sourceTaskId: normalizeNullableString(input.sourceTaskId)
      }));

    if (!existingAccount) {
      await this.store.createTimelineEvent({
        organizationId: context.organizationId,
        accountId: account.id,
        ownerUserId: context.userId,
        eventType: 'account_imported',
        title: 'AI 获客导入客户公司',
        metadata: {
          sourceTaskId: input.sourceTaskId ?? null,
          domain,
          sourceSnapshot: normalizeLeadSourceSnapshot(input.sourceSnapshot)
        }
      });
    }

    await this.createArchivedMatchTimelineIfNeeded(account, archivedMatches, context);

    const contact = await this.importContactIfPresent(account, input, context);
    const updatedAccount = contact ? await this.applyImportedContactAccountStatus(account, contact) : account;

    return {
      account: updatedAccount,
      contact
    };
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
    if (this.accountService) {
      return this.accountService.listAccounts(context, query);
    }

    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listAccounts({
      organizationId: context.organizationId,
      ...toOwnerScope(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toAccountView)
    });
  }

  /** Returns one account detail within the current user's organization scope. */
  async getAccountDetail(id: string, context: CrmUserContext) {
    if (this.accountService) {
      return this.accountService.getAccountDetail(id, context);
    }

    const detail = await this.requireScopedAccountDetail(id, context);

    return toAccountDetailView(detail);
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
    if (this.accountService) {
      return this.accountService.updateAccountStatus(id, input, context);
    }

    return this.changeAccountStatus(id, input.status, 'status_changed', '线索状态变更', input.remark, context);
  }

  /** Adds a user note to the scoped account timeline. */
  async addAccountNote(
    id: string,
    input: {
      content: string;
    },
    context: CrmUserContext
  ) {
    if (this.accountService) {
      return this.accountService.addAccountNote(id, input, context);
    }

    const detail = await this.requireScopedAccountDetail(id, context);
    const content = normalizeLimitedContent(input.content, '备注内容不能为空');
    const event = await this.store.createTimelineEvent({
      organizationId: detail.account.organizationId,
      accountId: detail.account.id,
      ownerUserId: context.userId,
      eventType: 'note_added',
      title: '新增备注',
      content
    });

    return {
      event: toTimelineEventView(event)
    };
  }

  /** Archives the scoped account and records the archive reason in timeline. */
  async archiveAccount(
    id: string,
    input: {
      reason?: string | null;
    },
    context: CrmUserContext
  ) {
    if (this.accountService) {
      return this.accountService.archiveAccount(id, input, context);
    }

    const detail = await this.requireScopedAccountDetail(id, context);
    const fromStatus = detail.account.status;
    const archiveReason = normalizeNullableString(input.reason);
    const archivedAt = new Date();
    const account = await this.store.updateAccount(detail.account.id, {
      status: 'archived',
      archivedAt,
      archiveReason,
      archiveSlimmedAt: null
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.store.createTimelineEvent({
      organizationId: account.organizationId,
      accountId: account.id,
      ownerUserId: context.userId,
      eventType: 'account_archived',
      title: '归档线索',
      content: archiveReason,
      metadata: {
        fromStatus,
        toStatus: 'archived'
      }
    });

    await this.upsertArchivedFingerprints(account, detail.contacts, archiveReason, archivedAt);

    return {
      account: toAccountView(account),
      event: toTimelineEventView(event)
    };
  }

  /** Restores an archived account while the full recovery window is still open. */
  async restoreAccount(id: string, context: CrmUserContext) {
    if (this.accountService) {
      return this.accountService.restoreAccount(id, context);
    }

    const detail = await this.requireScopedAccountDetail(id, context);

    if (detail.account.status !== 'archived') {
      throw new BadRequestException('只有已归档线索可以恢复');
    }

    if (!detail.account.archivedAt || isPastArchiveRecoveryWindow(detail.account.archivedAt)) {
      throw new BadRequestException('归档已超过 30 天，不能直接恢复');
    }

    const account = await this.store.updateAccount(detail.account.id, {
      status: 'candidate',
      archivedAt: null,
      archiveReason: null,
      archiveSlimmedAt: null
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.store.createTimelineEvent({
      organizationId: account.organizationId,
      accountId: account.id,
      ownerUserId: context.userId,
      eventType: 'account_restored',
      title: '恢复归档线索',
      metadata: {
        fromStatus: 'archived',
        toStatus: account.status
      }
    });

    return {
      account: toAccountView(account),
      event: toTimelineEventView(event)
    };
  }

  /** Verifies one scoped contact email with basic syntax and MX lookup. */
  async verifyContactEmail(id: string, context: CrmUserContext) {
    if (this.accountService) {
      return this.accountService.verifyContactEmail(id, context);
    }

    const contact = await this.store.findContactById({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }

    const verification = await this.verifyEmailWithCache(contact.email, context);
    const result = await this.applyContactEmailVerification(contact, verification, context);

    return {
      contact: toContactView(result.contact),
      event: toTimelineEventView(result.event)
    };
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
    if (this.suppressionService) {
      return this.suppressionService.listBlacklistEntries(context, query);
    }

    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listBlacklistEntries({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toBlacklistView)
    });
  }

  /** Removes one organization blacklist entry after recording an audit reason. */
  async removeBlacklistEntry(id: string, input: { reason?: string | null }, context: CrmUserContext) {
    if (this.suppressionService) {
      return this.suppressionService.removeBlacklistEntry(id, input, context);
    }

    const reason = normalizeNullableString(input.reason);
    if (!reason) {
      throw new BadRequestException('解除黑名单必须填写解除原因');
    }

    const entry = await this.store.deleteBlacklistEntry({
      id,
      organizationId: context.organizationId
    });

    if (!entry) {
      throw new NotFoundException('黑名单记录不存在');
    }

    await this.recordCrmLog('blacklist-entry-removed', 'CRM 退订黑名单已解除', context, {
      organizationId: context.organizationId,
      blacklistEntryId: entry.id,
      maskedEmail: entry.maskedEmail,
      reason,
      sourceAccountId: entry.sourceAccountId,
      sourceContactId: entry.sourceContactId,
      sourceMessageId: entry.sourceMessageId
    });

    return {
      blacklistEntry: toBlacklistView(entry)
    };
  }

  /** Creates a Gmail mock authorization record without storing any OAuth token. */
  async mockAuthorizeMailbox(input: { emailAddress: string }, context: CrmUserContext) {
    if (this.mailboxService) {
      return this.mailboxService.mockAuthorizeMailbox(input, context);
    }

    const emailAddress = normalizeMailboxEmail(input.emailAddress);
    const emailHash = hashEmail(emailAddress);
    const existingMailbox = await this.store.findMailboxByProviderAndEmailHash(gmailProvider, emailHash);

    if (existingMailbox) {
      if (isOwnedMailbox(existingMailbox, context)) {
        await this.recordMailboxLog(
          'mailbox-mock-authorize',
          'CRM 邮箱 mock 授权完成',
          context,
          existingMailbox,
          existingMailbox.status,
          existingMailbox.status
        );

        return { mailbox: toMailboxView(existingMailbox) };
      }

      throw new BadRequestException('该 Gmail 地址已绑定');
    }

    const mailbox = await this.store.createMailbox({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      provider: gmailProvider,
      emailAddress,
      emailHash,
      maskedEmail: maskEmail(emailAddress),
      status: 'active',
      dailyLimit: defaultMailboxDailyLimit,
      hourlyLimit: defaultMailboxHourlyLimit,
      warmupStage: 'new',
      watchExpiration: null,
      lastHistoryId: null,
      authorizedAt: new Date(),
      pausedAt: null
    });

    if (!isOwnedMailbox(mailbox, context)) {
      throw new BadRequestException('该 Gmail 地址已绑定');
    }

    await this.recordMailboxLog(
      'mailbox-mock-authorize',
      'CRM 邮箱 mock 授权完成',
      context,
      mailbox,
      null,
      mailbox.status
    );

    return { mailbox: toMailboxView(mailbox) };
  }

  /** Creates a Google consent URL for the current user mailbox authorization flow. */
  createGmailOAuthAuthorizationUrl(context: CrmUserContext) {
    if (this.mailboxService) {
      return this.mailboxService.createGmailOAuthAuthorizationUrl(context);
    }

    return this.requireGmailOAuthFlow().createAuthorizationUrl({
      organizationId: context.organizationId,
      userId: context.userId
    });
  }

  /** Completes Gmail OAuth authorization and stores the encrypted refresh token for the mailbox owner. */
  async completeGmailOAuthAuthorization(input: GmailOAuthCompleteInput, context: CrmUserContext) {
    if (this.mailboxService) {
      return this.mailboxService.completeGmailOAuthAuthorization(input, context);
    }

    const flow = this.requireGmailOAuthFlow();
    flow.verifyState(input.state, {
      organizationId: context.organizationId,
      userId: context.userId
    });

    const gmailMailbox = await flow.exchangeCodeForMailbox(input.code);
    const emailAddress = normalizeMailboxEmail(gmailMailbox.emailAddress);
    const emailHash = hashEmail(emailAddress);
    const existingMailbox = await this.store.findMailboxByProviderAndEmailHash(gmailProvider, emailHash);

    if (existingMailbox) {
      if (!isOwnedMailbox(existingMailbox, context)) {
        throw new BadRequestException('该 Gmail 地址已绑定');
      }

      const updatedMailbox = await this.store.updateMailbox(existingMailbox.id, {
        status: 'active',
        encryptedRefreshToken: gmailMailbox.encryptedRefreshToken,
        watchExpiration: null,
        lastHistoryId: gmailMailbox.historyId,
        authorizedAt: new Date(),
        pausedAt: null
      });

      if (!updatedMailbox) {
        throw new NotFoundException('邮箱不存在');
      }

      await this.recordMailboxLog(
        'mailbox-gmail-oauth-authorize',
        'CRM Gmail OAuth 授权完成',
        context,
        updatedMailbox,
        existingMailbox.status,
        updatedMailbox.status
      );

      return this.renewWatchAfterOAuthAuthorization(updatedMailbox, context);
    }

    const mailbox = await this.store.createMailbox({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      ownerUserName: context.userName,
      provider: gmailProvider,
      emailAddress,
      emailHash,
      maskedEmail: maskEmail(emailAddress),
      status: 'active',
      dailyLimit: defaultMailboxDailyLimit,
      hourlyLimit: defaultMailboxHourlyLimit,
      warmupStage: 'new',
      encryptedRefreshToken: gmailMailbox.encryptedRefreshToken,
      watchExpiration: null,
      lastHistoryId: gmailMailbox.historyId,
      authorizedAt: new Date(),
      pausedAt: null
    });

    if (!isOwnedMailbox(mailbox, context)) {
      throw new BadRequestException('该 Gmail 地址已绑定');
    }

    await this.recordMailboxLog(
      'mailbox-gmail-oauth-authorize',
      'CRM Gmail OAuth 授权完成',
      context,
      mailbox,
      null,
      mailbox.status
    );

    return this.renewWatchAfterOAuthAuthorization(mailbox, context);
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
    if (this.mailboxService) {
      return this.mailboxService.listMailboxes(context, query);
    }

    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listMailboxes({
      organizationId: context.organizationId,
      ...toOwnerScope(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toMailboxView)
    });
  }

  /** Pauses a scoped mailbox after verifying the current user can read it. */
  async pauseMailbox(id: string, context: CrmUserContext) {
    if (this.mailboxService) {
      return this.mailboxService.pauseMailbox(id, context);
    }

    return this.changeMailboxStatus(id, 'paused', new Date(), 'mailbox-pause', 'CRM 邮箱暂停', context);
  }

  /** Resumes a scoped mailbox after verifying the current user can read it. */
  async resumeMailbox(id: string, context: CrmUserContext) {
    if (this.mailboxService) {
      return this.mailboxService.resumeMailbox(id, context);
    }

    return this.changeMailboxStatus(id, 'active', null, 'mailbox-resume', 'CRM 邮箱恢复', context);
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listPersonaProfiles({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toPersonaProfileView)
    });
  }

  /** Creates an organization-level persona profile after checking manager permission. */
  async createPersonaProfile(input: PersonaProfileCreateInput, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const data = normalizePersonaProfileCreateInput(input);
    await this.assertPersonaProfileNameAvailable(context.organizationId, data.name);
    const personaProfile = await this.runPersonaProfileWrite(() =>
      this.store.createPersonaProfile({
        organizationId: context.organizationId,
        ...data,
        status: defaultPersonaProfileStatus,
        isDefault: Boolean(input.isDefault),
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordPersonaProfileLog(
      'persona-profile-create',
      'CRM 职位/客户画像新建',
      context,
      personaProfile,
      null,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Updates one organization persona profile through scoped reads and writes. */
  async updatePersonaProfile(id: string, input: PersonaProfileUpdateInput, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);
    const fromStatus = currentPersonaProfile.status;
    const data = normalizePersonaProfileUpdateInput(input);
    const nextStatus = data.status ?? currentPersonaProfile.status;

    if (data.name && data.name !== currentPersonaProfile.name) {
      await this.assertPersonaProfileNameAvailable(context.organizationId, data.name, currentPersonaProfile.id);
    }

    if (data.isDefault && nextStatus !== 'active') {
      throw new BadRequestException('只能将启用画像设为默认');
    }

    if (data.status === 'archived') {
      data.isDefault = false;
    }

    const personaProfile = await this.runPersonaProfileWrite(() =>
      this.store.updatePersonaProfile(currentPersonaProfile.id, context.organizationId, data)
    );

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-update',
      'CRM 职位/客户画像更新',
      context,
      personaProfile,
      fromStatus,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Archives one persona profile instead of deleting it. */
  async archivePersonaProfile(id: string, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);
    const personaProfile = await this.store.updatePersonaProfile(currentPersonaProfile.id, context.organizationId, {
      status: 'archived',
      isDefault: false
    });

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-archive',
      'CRM 职位/客户画像归档',
      context,
      personaProfile,
      currentPersonaProfile.status,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
  }

  /** Marks one active persona profile as the organization default. */
  async setDefaultPersonaProfile(id: string, context: CrmUserContext) {
    this.requireOrganizationConfigManager(context);
    const currentPersonaProfile = await this.requireScopedPersonaProfile(id, context);

    if (currentPersonaProfile.status !== 'active') {
      throw new BadRequestException('只能将启用画像设为默认');
    }

    const personaProfile = await this.store.setDefaultPersonaProfile(currentPersonaProfile.id, context.organizationId);

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    await this.recordPersonaProfileLog(
      'persona-profile-default',
      'CRM 默认职位/客户画像更新',
      context,
      personaProfile,
      currentPersonaProfile.status,
      personaProfile.status
    );

    return { personaProfile: toPersonaProfileView(personaProfile) };
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listEmailTemplateGroups({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toEmailTemplateGroupView)
    });
  }

  /** Creates one organization-level email template group with exactly five sequence steps. */
  async createEmailTemplateGroup(input: EmailTemplateCreateInput, context: CrmUserContext) {
    const data = normalizeEmailTemplateCreateInput(input);
    await this.assertEmailTemplateNameAvailable(context.organizationId, data.name);
    const templateGroup = await this.runEmailTemplateWrite(() =>
      this.store.createEmailTemplateGroup({
        organizationId: context.organizationId,
        ...data,
        status: defaultEmailTemplateStatus,
        isDefault: false,
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordEmailTemplateLog(
      'email-template-create',
      'CRM 邮件模板新建',
      context,
      templateGroup,
      null,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Updates one organization-level email template group and replaces step rows when provided. */
  async updateEmailTemplateGroup(id: string, input: EmailTemplateUpdateInput, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);
    const fromStatus = currentTemplate.status;
    const data = normalizeEmailTemplateUpdateInput(input);

    if (data.name && data.name !== currentTemplate.name) {
      await this.assertEmailTemplateNameAvailable(context.organizationId, data.name, currentTemplate.id);
    }

    const templateGroup = await this.runEmailTemplateWrite(() =>
      this.store.updateEmailTemplateGroup(currentTemplate.id, context.organizationId, data)
    );

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-update',
      'CRM 邮件模板更新',
      context,
      templateGroup,
      fromStatus,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Archives one organization-level email template group instead of deleting it. */
  async archiveEmailTemplateGroup(id: string, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);
    const fromStatus = currentTemplate.status;
    const templateGroup = await this.store.updateEmailTemplateGroup(currentTemplate.id, context.organizationId, {
      status: 'archived',
      isDefault: false
    });

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-archive',
      'CRM 邮件模板归档',
      context,
      templateGroup,
      fromStatus,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Marks one active organization-level email template group as the default drafting template. */
  async setDefaultEmailTemplateGroup(id: string, context: CrmUserContext) {
    const currentTemplate = await this.requireScopedEmailTemplateGroup(id, context);

    if (currentTemplate.status !== 'active') {
      throw new BadRequestException('只能将启用模板设为默认');
    }

    const templateGroup = await this.store.setDefaultEmailTemplateGroup(currentTemplate.id, context.organizationId);

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    await this.recordEmailTemplateLog(
      'email-template-default',
      'CRM 默认邮件模板更新',
      context,
      templateGroup,
      currentTemplate.status,
      templateGroup.status
    );

    return { templateGroup: toEmailTemplateGroupView(templateGroup) };
  }

  /** Returns the read-only default template and persona rules used by first-draft generation. */
  async getTemplateDefaults(context: CrmUserContext) {
    const [defaultTemplateGroup, activePersonaProfiles] = await Promise.all([
      this.store.findDefaultEmailTemplateGroup(context.organizationId),
      this.store.listActivePersonaProfiles(context.organizationId)
    ]);
    const templatePersonas = activePersonaProfiles.length
      ? activePersonaProfiles.map(toTemplatePersonaProfile)
      : personaProfiles.map(profile => ({
          ...profile,
          aliases: [...profile.aliases]
        }));

    if (defaultTemplateGroup) {
      return {
        templateGroup: {
          ...toEmailTemplateGroupView(defaultTemplateGroup),
          scope: 'organization' as const,
          variables: defaultTemplateVariables.map(variable => ({
            ...variable
          }))
        },
        personas: templatePersonas.map(profile => ({
          ...profile,
          aliases: [...profile.aliases]
        }))
      };
    }

    const globalConfig = await this.store.getGlobalConfig();

    return {
      templateGroup: {
        id: 'global-first-touch',
        name: '默认开发信序列模板',
        scope: 'global' as const,
        language: 'en',
        variables: defaultTemplateVariables.map(variable => ({
          ...variable
        })),
        steps: defaultTemplateSteps.map(step => ({
          ...step,
          delayDays: getTemplateStepDelayDays(step.stepIndex, globalConfig.followUpDelayDays)
        }))
      },
      personas: templatePersonas.map(profile => ({
        ...profile,
        aliases: [...profile.aliases]
      }))
    };
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const status = query.status ? normalizeSequencePolicyStatus(query.status) : undefined;
    const result = await this.store.listSequencePolicies({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(status ? { status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(toSequencePolicyView)
    });
  }

  /** Creates one organization sequence policy. */
  async createSequencePolicy(input: SequencePolicyWriteInput, context: CrmUserContext) {
    const data = normalizeSequencePolicyCreateInput(input, context);
    const policy = await this.runSequencePolicyWrite(() => this.store.createSequencePolicy(data));

    await this.recordSequencePolicyLog(
      'sequence-policy-create',
      'CRM 序列策略新建',
      context,
      policy,
      null,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Updates one organization sequence policy. */
  async updateSequencePolicy(id: string, input: SequencePolicyWriteInput, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);
    const data = normalizeSequencePolicyUpdateInput(input);
    const nextStatus = data.status ?? currentPolicy.status;

    if (data.isDefault && nextStatus !== 'active') {
      throw new BadRequestException('只能将启用策略设为默认');
    }

    if (data.status === 'archived') {
      data.isDefault = false;
    }

    const policy = await this.runSequencePolicyWrite(() =>
      this.store.updateSequencePolicy(currentPolicy.id, context.organizationId, data)
    );

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-update',
      'CRM 序列策略更新',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Archives one sequence policy instead of deleting it. */
  async archiveSequencePolicy(id: string, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);
    const policy = await this.store.updateSequencePolicy(currentPolicy.id, context.organizationId, {
      status: 'archived',
      isDefault: false
    });

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-archive',
      'CRM 序列策略归档',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Marks one active organization sequence policy as default. */
  async setDefaultSequencePolicy(id: string, context: CrmUserContext) {
    const currentPolicy = await this.requireScopedSequencePolicy(id, context);

    if (currentPolicy.status !== 'active') {
      throw new BadRequestException('只能将启用策略设为默认');
    }

    const policy = await this.store.setDefaultSequencePolicy(currentPolicy.id, context.organizationId);

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    await this.recordSequencePolicyLog(
      'sequence-policy-default',
      'CRM 默认序列策略更新',
      context,
      policy,
      currentPolicy.status,
      policy.status
    );

    return { policy: toSequencePolicyView(policy) };
  }

  /** Creates one first-email review item and deterministic draft without queueing any send job. */
  async createSequenceReviewItem(input: SequenceReviewCreateInput, context: CrmUserContext) {
    if (this.sequenceService) {
      return this.sequenceService.createSequenceReviewItem(input, context);
    }

    const { account, contact } = await this.requireScopedAccountAndContact(input.accountId, input.contactId, context);
    await this.assertContactNotBlacklisted(contact, context);
    const existingEnrollment = await this.store.findActiveEnrollmentByContact({
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
      input.policyId ? Promise.resolve(null) : this.store.findDefaultSequencePolicy(context.organizationId)
    ]);
    const policy = selectedPolicy ?? defaultPolicy;
    await this.assertSameCompanySequencePolicy(account, contact, policy, context);
    const [defaultTemplateGroup, personaMatch] = await Promise.all([
      this.store.findDefaultEmailTemplateGroup(context.organizationId),
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
      this.store.createSequenceDraftBundle({
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

    await this.recordCrmLog('sequence-review-create', 'CRM 首封开发信草稿生成', context, {
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

  /** Previews a configured AI draft without creating messages or send jobs. */
  async previewAiDraft(input: CrmAiDraftPreviewInput, context: CrmUserContext) {
    const stepIndex = toAiWritingStepIndex(input.stepIndex);
    const { account, contact } = await this.requireScopedAccountAndContact(input.accountId, input.contactId, context);
    const productLine = this.requireAiWritingProductLine(
      await this.requireActiveProductLine(input.productLineId, context)
    );
    const sequenceItem = input.enrollmentId
      ? await this.requireOwnedSequenceReviewItem(input.enrollmentId, context)
      : null;

    if (sequenceItem) {
      this.assertPreviewMatchesSequence(input, sequenceItem, productLine.id);
    }

    const [defaultTemplateGroup, personaMatch] =
      stepIndex === initialDraftStepIndex
        ? await Promise.all([
            this.store.findDefaultEmailTemplateGroup(context.organizationId),
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
        .sort(
          (left, right) => left.stepIndex - right.stepIndex || left.createdAt.getTime() - right.createdAt.getTime()
        ) ??
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
    if (this.sequenceService) {
      return this.sequenceService.listSequenceReviewItems(context, query);
    }

    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listSequenceReviewItems({
      organizationId: context.organizationId,
      ...toOwnerScope(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.todoType ? { todoType: query.todoType } : {}),
      ...(query.messageStatus ? { messageStatus: query.messageStatus } : {}),
      ...(query.dateScope ? { dateScope: query.dateScope } : {}),
      skip: (current - 1) * size,
      take: size
    });

    const organizationProfiles = await this.store.listActivePersonaProfiles(context.organizationId);

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(record =>
        toSequenceReviewView(record, context, buildPersonaMatch(organizationProfiles, record.account, record.contact))
      )
    });
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
    if (this.sequenceService) {
      return this.sequenceService.getSequenceReviewItem(id, context);
    }

    const item = await this.requireScopedSequenceReviewItem(id, context);
    const personaMatch = await this.resolvePersonaProfileMatch(item.account, item.contact, context);

    return toSequenceReviewView(item, context, personaMatch);
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
    if (this.draftService) {
      return this.draftService.regenerateMessageAiDraft(id, context);
    }

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
      fallbackDraft: {
        subject: message.subject,
        bodyText: message.bodyText
      }
    });
    const updatedMessage = await this.store.updateMessage(
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

    await this.recordCrmLog('ai-draft-regenerate', 'CRM AI 开发信草稿重新生成', context, {
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
    const item = await this.requireOwnedSequenceReviewItem(id, context);

    if (item.enrollment.status !== 'ready_to_send') {
      throw new BadRequestException('当前序列尚未完成首封审核');
    }

    if (!item.firstMessage || item.firstMessage.status !== approvedDraftStatus) {
      throw new BadRequestException('首封开发信尚未确认');
    }

    if (!item.mailbox) {
      throw new BadRequestException('请先选择发送邮箱');
    }

    if (item.mailbox.status !== 'active') {
      throw new BadRequestException('发送邮箱未启用');
    }

    await this.assertContactNotBlacklisted(item.contact, context);

    const started = await this.store.startFirstMessageSend({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: approvedDraftStatus,
      toMessageStatus: approvedDraftStatus,
      accountStatus: 'sequence_running',
      scheduledAt: new Date()
    });

    if (!started) {
      throw new BadRequestException('当前序列状态已变化，请刷新后重试');
    }

    await this.recordCrmLog('sequence-send-started', 'CRM 首封开发信已等待发送调度', context, {
      organizationId: context.organizationId,
      accountId: started.account.id,
      contactId: started.contact.id,
      enrollmentId: started.enrollment.id,
      messageId: started.message.id,
      mailboxId: started.mailbox.id,
      runVersion: started.enrollment.runVersion
    });

    return {
      enrollment: toSequenceEnrollmentView(started.enrollment),
      message: toMessageView(started.message),
      account: toAccountView(started.account),
      event: toTimelineEventView(started.event)
    };
  }

  /** Stops a sequence and invalidates queued jobs by bumping runVersion. */
  async stopSequenceEnrollment(id: string, context: CrmUserContext) {
    const item = await this.requireScopedSequenceReviewItem(id, context);

    if (!stoppableSequenceStatuses.includes(item.enrollment.status)) {
      throw new BadRequestException('当前序列状态不能停止');
    }

    const stopped = await this.store.stopSequenceEnrollment({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      fromStatuses: stoppableSequenceStatuses,
      accountStatus: 'paused',
      actorUserId: context.userId
    });

    if (!stopped) {
      throw new BadRequestException('当前序列状态已变化，请刷新后重试');
    }

    await this.recordCrmLog('sequence-stopped', 'CRM 开发信序列已停止', context, {
      organizationId: context.organizationId,
      accountId: stopped.account.id,
      contactId: stopped.enrollment.contactId,
      enrollmentId: stopped.enrollment.id,
      messageId: stopped.message?.id ?? item.firstMessage?.id ?? null,
      fromStatus: item.enrollment.status,
      toStatus: stopped.enrollment.status,
      runVersion: stopped.enrollment.runVersion
    });

    return {
      enrollment: toSequenceEnrollmentView(stopped.enrollment),
      message: stopped.message ? toMessageView(stopped.message) : null,
      account: toAccountView(stopped.account),
      event: toTimelineEventView(stopped.event)
    };
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
    assertSuper(context, '无权维护 CRM 发送队列');

    if (!this.sendQueue) {
      throw new BadRequestException('CRM 邮件发送队列未启用');
    }

    const now = input.now ?? new Date();
    const staleMinutes = normalizePositiveInteger(input.staleMinutes, 10, 1, 1440);
    const take = normalizePositiveInteger(input.take, 100, 1, 500);
    const before = new Date(now.getTime() - staleMinutes * 60 * 1000);
    const candidates = await this.store.listStaleQueuedMessages({
      before,
      take
    });
    let repairedCount = 0;
    let skippedCount = 0;

    for (const message of candidates) {
      if (!message.bullJobId) {
        skippedCount += 1;
        continue;
      }

      if (await this.sendQueue.hasJob(message.bullJobId)) {
        skippedCount += 1;
        continue;
      }

      const repaired = await this.store.updateMessage(
        message.id,
        message.organizationId,
        { status: 'draft_ready', bullJobId: null },
        { status: 'queued' }
      );

      if (!repaired) {
        skippedCount += 1;
        continue;
      }

      repairedCount += 1;
      await this.store.createTimelineEvent({
        organizationId: repaired.organizationId,
        accountId: repaired.accountId,
        contactId: repaired.contactId,
        ownerUserId: repaired.ownerUserId,
        eventType: 'send_queue_reconciled',
        title: '发送队列对账修复',
        content: '数据库 queued 但 BullMQ job 不存在，已回退为待发送草稿',
        metadata: {
          messageId: repaired.id,
          previousBullJobId: message.bullJobId,
          repairedAt: now.toISOString()
        }
      });
    }

    const result = {
      scannedCount: candidates.length,
      repairedCount,
      skippedCount
    };

    await this.recordCrmLog('send-queue-reconcile', 'CRM 发送队列对账修复', context, {
      organizationId: context.organizationId,
      before: before.toISOString(),
      take,
      ...result
    });

    return result;
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

  private async importContactIfPresent(
    account: CrmAccountRecord,
    input: ImportCrmLeadInput,
    context: CrmUserContext
  ): Promise<CrmContactRecord | null> {
    const email = normalizeEmail(input.contact?.email);

    if (!email) {
      return null;
    }

    const emailHash = hashEmail(email);
    const existingContact = await this.store.findContactByEmailHash(context.organizationId, context.userId, emailHash);

    if (existingContact) {
      if (existingContact.accountId !== account.id) {
        const updatedContact = await this.store.updateContact(existingContact.id, { accountId: account.id });

        return updatedContact ?? existingContact;
      }
      return existingContact;
    }

    const contact = await this.store.createContact({
      organizationId: context.organizationId,
      accountId: account.id,
      ownerUserId: context.userId,
      fullName: normalizeNullableString(input.contact?.fullName),
      title: normalizeNullableString(input.contact?.title),
      email,
      emailHash,
      maskedEmail: maskEmail(email),
      isPublicEmail: isPublicEmail(email),
      emailStatus: 'unchecked',
      sourceTaskId: normalizeNullableString(input.sourceTaskId)
    });

    await this.store.createTimelineEvent({
      organizationId: context.organizationId,
      accountId: account.id,
      contactId: contact.id,
      ownerUserId: context.userId,
      eventType: 'contact_imported',
      title: '导入联系人邮箱',
      metadata: {
        sourceTaskId: input.sourceTaskId ?? null,
        maskedEmail: contact.maskedEmail,
        isPublicEmail: contact.isPublicEmail
      }
    });

    const verification = await this.verifyEmailWithCache(contact.email, context);
    const { contact: verifiedContact } = await this.applyContactEmailVerification(contact, verification, context);

    return verifiedContact;
  }

  private async applyContactEmailVerification(
    contact: CrmContactRecord,
    verification: EmailVerificationResult,
    context: CrmUserContext
  ) {
    const fromStatus = contact.emailStatus;
    const updatedContact = await this.store.updateContactEmailStatus(contact.id, verification.status);

    if (!updatedContact) {
      throw new NotFoundException('联系人不存在');
    }

    const event = await this.store.createTimelineEvent({
      organizationId: updatedContact.organizationId,
      accountId: updatedContact.accountId,
      contactId: updatedContact.id,
      ownerUserId: context.userId,
      eventType: 'email_verified',
      title: '邮箱验证',
      content: `邮箱 ${updatedContact.maskedEmail} 验证结果：${toEmailStatusText(verification.status)}`,
      metadata: {
        maskedEmail: updatedContact.maskedEmail,
        domain: verification.domain,
        fromStatus,
        toStatus: verification.status,
        reason: verification.reason,
        cacheHit: verification.cacheHit
      }
    });
    await this.recordCrmLog('contact-email-verify', 'CRM 联系人邮箱验证完成', context, {
      organizationId: updatedContact.organizationId,
      accountId: updatedContact.accountId,
      contactId: updatedContact.id,
      maskedEmail: updatedContact.maskedEmail,
      domain: verification.domain,
      fromStatus,
      toStatus: verification.status,
      reason: verification.reason,
      cacheHit: verification.cacheHit
    });

    return {
      contact: updatedContact,
      event
    };
  }

  private async applyImportedContactAccountStatus(account: CrmAccountRecord, contact: CrmContactRecord) {
    if (!canApplyEmailVerificationAccountStatus(account.status)) {
      return account;
    }

    const nextStatus = toAccountStatusAfterEmailVerification(contact.emailStatus);

    if (account.status === nextStatus) {
      return account;
    }

    return (await this.store.updateAccount(account.id, { status: nextStatus })) ?? account;
  }

  private async changeAccountStatus(
    id: string,
    status: CrmAccountStatus,
    eventType: string,
    title: string,
    content: string | null | undefined,
    context: CrmUserContext
  ) {
    const detail = await this.requireScopedAccountDetail(id, context);
    const fromStatus = detail.account.status;
    const account = await this.store.updateAccount(detail.account.id, {
      status
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.store.createTimelineEvent({
      organizationId: account.organizationId,
      accountId: account.id,
      ownerUserId: context.userId,
      eventType,
      title,
      content: normalizeNullableString(content),
      metadata: {
        fromStatus,
        toStatus: status
      }
    });

    return {
      account: toAccountView(account),
      event: toTimelineEventView(event)
    };
  }

  /** Reuses global email verification results within the cooldown window. */
  private async verifyEmailWithCache(email: string, context: CrmUserContext): Promise<EmailVerificationResult> {
    const emailHash = hashEmail(email);
    const now = new Date();
    const [cached, globalConfig] = await Promise.all([
      this.store.findEmailVerificationCache({ emailHash }),
      this.store.getGlobalConfig()
    ]);

    if (cached && isEmailVerificationCacheFresh(cached.verifiedAt, globalConfig.emailVerificationCooldownDays, now)) {
      return {
        status: cached.status as EmailVerificationResult['status'],
        domain: cached.domain,
        reason: cached.reason,
        cacheHit: true
      };
    }

    const verification = await this.verifyEmailAddress(email);

    await this.store.upsertEmailVerificationCache({
      emailHash,
      maskedEmail: maskEmail(email),
      domain: verification.domain,
      status: verification.status,
      reason: verification.reason,
      verifiedAt: now,
      expiresAt: addDays(now, globalConfig.emailVerificationCooldownDays),
      checkedById: context.userId,
      checkedByName: context.userName
    });

    return {
      ...verification,
      cacheHit: false
    };
  }

  private async findArchivedImportMatches(domain: string | null, input: ImportCrmLeadInput, context: CrmUserContext) {
    const fingerprints = buildLeadImportFingerprints(domain, input);

    if (fingerprints.length === 0) {
      return [];
    }

    return this.store.findArchivedFingerprints({
      organizationId: context.organizationId,
      fingerprints
    });
  }

  private async createArchivedMatchTimelineIfNeeded(
    account: CrmAccountRecord,
    matches: CrmArchivedFingerprintRecord[],
    context: CrmUserContext
  ) {
    if (matches.length === 0) {
      return;
    }

    await this.store.createTimelineEvent({
      organizationId: account.organizationId,
      accountId: account.id,
      ownerUserId: context.userId,
      eventType: 'archived_fingerprint_matched',
      title: '命中归档历史',
      content: '该线索命中过往归档记录，请确认是否需要重新开发。',
      metadata: {
        matchedFingerprints: matches.map(toArchivedFingerprintMatchMetadata)
      }
    });
  }

  private async upsertArchivedFingerprints(
    account: CrmAccountRecord,
    contacts: CrmContactRecord[],
    archiveReason: string | null,
    archivedAt: Date
  ) {
    const fingerprints = buildArchivedFingerprintInputs(account, contacts, archiveReason, archivedAt);

    await Promise.all(fingerprints.map(fingerprint => this.store.upsertArchivedFingerprint(fingerprint)));
  }

  private async verifyEmailAddress(email: string): Promise<EmailVerificationProbeResult> {
    const parsedEmail = parseEmailAddress(email);

    if (!parsedEmail) {
      return {
        status: 'invalid',
        domain: null,
        reason: 'invalid_format'
      };
    }

    if (isPublicEmail(email)) {
      return {
        status: 'risky',
        domain: parsedEmail.domain,
        reason: 'public_email'
      };
    }

    try {
      const mxRecords = await this.dnsResolver.resolveMx(parsedEmail.domain);

      if (mxRecords.length > 0) {
        return {
          status: 'valid',
          domain: parsedEmail.domain,
          reason: 'mx_found'
        };
      }

      return {
        status: 'invalid',
        domain: parsedEmail.domain,
        reason: 'no_mx'
      };
    } catch (error) {
      return {
        status: noMxErrorCodes.has(getErrorCode(error)) ? 'invalid' : 'unreachable',
        domain: parsedEmail.domain,
        reason: noMxErrorCodes.has(getErrorCode(error)) ? 'no_mx' : 'dns_temporary_failure'
      };
    }
  }

  private async requireScopedAccountDetail(id: string, context: CrmUserContext) {
    const detail = await this.store.getAccountDetail({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });

    if (!detail) {
      throw new NotFoundException('线索不存在');
    }

    return detail;
  }

  private async changeMailboxStatus(
    id: string,
    status: CrmMailboxStatus,
    pausedAt: Date | null,
    action: string,
    message: string,
    context: CrmUserContext
  ) {
    const currentMailbox = await this.requireScopedMailbox(id, context);
    const fromStatus = currentMailbox.status;
    const mailbox = await this.store.updateMailbox(currentMailbox.id, {
      status,
      pausedAt
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    await this.recordMailboxLog(action, message, context, mailbox, fromStatus, status);

    return { mailbox: toMailboxView(mailbox) };
  }

  private async requireScopedMailbox(id: string, context: CrmUserContext) {
    const mailbox = await this.store.findMailboxById({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });

    if (!mailbox) {
      throw new NotFoundException('邮箱不存在');
    }

    return mailbox;
  }

  private requireGmailOAuthFlow() {
    if (!this.gmailOAuthFlow) {
      throw new BadRequestException('Gmail OAuth 未配置');
    }

    return this.gmailOAuthFlow;
  }

  private async renewWatchAfterOAuthAuthorization(mailbox: CrmMailboxRecord, context: CrmUserContext) {
    if (!this.gmailWatchService) {
      return { mailbox: toMailboxView(mailbox) };
    }

    return this.gmailWatchService.renewMailboxWatch(mailbox.id, context);
  }

  private async requireScopedProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.store.findProductLineById({
      id,
      organizationId: context.organizationId
    });

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    return productLine;
  }

  private async requireActiveProductLine(id: string, context: CrmUserContext) {
    const productLine = await this.requireScopedProductLine(id, context);

    if (productLine.status !== 'active') {
      throw new BadRequestException('产品资料已归档');
    }

    return productLine;
  }

  private async requireScopedPersonaProfile(id: string, context: CrmUserContext) {
    const personaProfile = await this.store.findPersonaProfileById({
      id,
      organizationId: context.organizationId
    });

    if (!personaProfile) {
      throw new NotFoundException('画像不存在');
    }

    return personaProfile;
  }

  private async resolvePersonaProfileMatch(
    account: Pick<CrmAccountRecord, 'customerType'>,
    contact: Pick<CrmContactRecord, 'title'>,
    context: CrmUserContext
  ): Promise<ResolvedPersonaMatch> {
    const organizationProfiles = await this.store.listActivePersonaProfiles(context.organizationId);
    return buildPersonaMatch(organizationProfiles, account, contact);
  }

  private async requireScopedEmailTemplateGroup(id: string, context: CrmUserContext) {
    const templateGroup = await this.store.findEmailTemplateGroupById({
      id,
      organizationId: context.organizationId
    });

    if (!templateGroup) {
      throw new NotFoundException('邮件模板不存在');
    }

    return templateGroup;
  }

  private async requireScopedSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.store.findSequencePolicyById({
      id,
      organizationId: context.organizationId
    });

    if (!policy) {
      throw new NotFoundException('序列策略不存在');
    }

    return policy;
  }

  private async requireActiveSequencePolicy(id: string, context: CrmUserContext) {
    const policy = await this.requireScopedSequencePolicy(id, context);

    if (policy.status !== 'active') {
      throw new BadRequestException('序列策略已归档');
    }

    return policy;
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

    const existingEnrollment = await this.store.findActiveEnrollmentByAccount({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      accountId: account.id,
      statuses: activeSequenceStatuses
    });

    if (existingEnrollment && existingEnrollment.contactId !== contact.id) {
      throw new BadRequestException('同公司已有进行中的开发信序列，请使用允许多联系人策略后再创建');
    }
  }

  private async requireOwnedActiveMailbox(id: string, context: CrmUserContext) {
    const mailbox = await this.store.findMailboxById({
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
    const blacklistEntry = await this.store.findBlacklistEntry({
      organizationId: context.organizationId,
      emailHash: contact.emailHash
    });

    if (blacklistEntry) {
      throw new BadRequestException('该邮箱已在组织黑名单中，不能继续开发');
    }
  }

  private async requireScopedAccountAndContact(accountId: string, contactId: string, context: CrmUserContext) {
    const detail = await this.requireScopedAccountDetail(accountId, context);
    const contact = detail.contacts.find(item => item.id === contactId) ?? null;

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

  private async requireScopedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.store.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
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
    if (
      item.account.id !== input.accountId ||
      item.contact.id !== input.contactId ||
      item.productLine?.id !== productLineId
    ) {
      throw new BadRequestException('预览参数与邮件序列不匹配');
    }

    if (input.messageId && !item.messages.some(message => message.id === input.messageId)) {
      throw new BadRequestException('预览参考邮件不属于当前序列');
    }
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

  private async assertEmailTemplateNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingTemplate = await this.store.findEmailTemplateGroupByName(organizationId, name);

    if (existingTemplate && existingTemplate.id !== ignoredId) {
      throw new BadRequestException('邮件模板名称已存在');
    }
  }

  private async assertPersonaProfileNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingProfile = await this.store.findPersonaProfileByName(organizationId, name);

    if (existingProfile && existingProfile.id !== ignoredId) {
      throw new BadRequestException('画像名称已存在');
    }
  }

  private async runEmailTemplateWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('邮件模板名称已存在');
      }

      throw error;
    }
  }

  private async runPersonaProfileWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('画像名称已存在');
      }

      throw error;
    }
  }

  private async runSequencePolicyWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('序列策略名称已存在');
      }

      throw error;
    }
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

  private recordMailboxLog(
    action: string,
    message: string,
    context: CrmUserContext,
    mailbox: CrmMailboxRecord,
    fromStatus: CrmMailboxStatus | null,
    toStatus: CrmMailboxStatus
  ) {
    return this.recordCrmLog(action, message, context, {
      organizationId: mailbox.organizationId,
      mailboxId: mailbox.id,
      provider: mailbox.provider,
      maskedEmail: mailbox.maskedEmail,
      fromStatus,
      toStatus
    });
  }

  private recordEmailTemplateLog(
    action: string,
    message: string,
    context: CrmUserContext,
    templateGroup: CrmEmailTemplateGroupRecord,
    fromStatus: CrmEmailTemplateStatus | null,
    toStatus: CrmEmailTemplateStatus
  ) {
    return this.recordCrmLog(action, message, context, {
      organizationId: templateGroup.organizationId,
      templateGroupId: templateGroup.id,
      name: templateGroup.name,
      status: templateGroup.status,
      isDefault: templateGroup.isDefault,
      fromStatus,
      toStatus
    });
  }

  private recordPersonaProfileLog(
    action: string,
    message: string,
    context: CrmUserContext,
    personaProfile: CrmPersonaProfileRecord,
    fromStatus: CrmPersonaProfileStatus | null,
    toStatus: CrmPersonaProfileStatus
  ) {
    return this.recordCrmLog(action, message, context, {
      organizationId: personaProfile.organizationId,
      personaProfileId: personaProfile.id,
      name: personaProfile.name,
      status: personaProfile.status,
      isDefault: personaProfile.isDefault,
      fromStatus,
      toStatus
    });
  }

  private recordSequencePolicyLog(
    action: string,
    message: string,
    context: CrmUserContext,
    policy: CrmSequencePolicyRecord,
    fromStatus: CrmSequencePolicyRecord['status'] | null,
    toStatus: CrmSequencePolicyRecord['status']
  ) {
    return this.recordCrmLog(action, message, context, {
      organizationId: policy.organizationId,
      policyId: policy.id,
      name: policy.name,
      status: policy.status,
      isDefault: policy.isDefault,
      linkPolicy: policy.linkPolicy,
      allowLowRiskAutoSend: policy.allowLowRiskAutoSend,
      sameCompanyContactStrategy: policy.sameCompanyContactStrategy,
      fromStatus,
      toStatus
    });
  }
}

function toAccountView(record: CrmAccountRecord) {
  return {
    ...record,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    archiveSlimmedAt: record.archiveSlimmedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toContactView(record: CrmContactRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toBlacklistView(record: CrmBlacklistRecord) {
  const { emailHash: _emailHash, ...safeRecord } = record;

  return {
    ...safeRecord,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toTimelineEventView(record: CrmTimelineEventRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

function toMailboxView(record: CrmMailboxRecord) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerUserId: record.ownerUserId,
    ownerUserName: record.ownerUserName,
    provider: record.provider,
    emailAddress: record.emailAddress,
    maskedEmail: record.maskedEmail,
    status: record.status,
    dailyLimit: record.dailyLimit,
    hourlyLimit: record.hourlyLimit,
    warmupStage: record.warmupStage,
    lastHistoryId: record.lastHistoryId,
    authorizedAt: record.authorizedAt.toISOString(),
    watchExpiration: record.watchExpiration?.toISOString() ?? null,
    syncMode: resolveMailboxSyncMode(),
    lastSyncIssue: toMailboxSyncIssueView(record),
    pausedAt: record.pausedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function resolveMailboxSyncMode() {
  const scopes = parseConfiguredGmailScopes(process.env.CRM_GMAIL_OAUTH_SCOPES);
  const supportsHistorySync = scopes.length === 0 || scopes.some(scope => gmailHistorySyncScopes.has(scope));

  if (!supportsHistorySync) return 'send_only';
  if (!normalizeEnvString(process.env.CRM_GMAIL_PUBSUB_TOPIC_NAME)) return 'mock_watch';

  return 'full_sync';
}

function parseConfiguredGmailScopes(value?: string) {
  return (
    normalizeEnvString(value)
      ?.split(/[\s,]+/)
      .filter(Boolean) ?? []
  );
}

function normalizeEnvString(value?: string) {
  const normalized = value?.trim();

  return normalized || null;
}

function toMailboxSyncIssueView(record: CrmMailboxRecord) {
  if (!record.syncIssueType || !record.syncIssueAt) {
    return null;
  }

  return {
    type: record.syncIssueType,
    message: record.syncIssueMessage ?? 'Gmail 同步需要人工处理',
    happenedAt: record.syncIssueAt.toISOString()
  };
}

function toProductLineView(record: CrmProductLineRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toPersonaProfileView(record: CrmPersonaProfileRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toEmailTemplateGroupView(record: CrmEmailTemplateGroupRecord) {
  return {
    ...record,
    steps: record.steps.map(step => ({
      ...step,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString()
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toSequencePolicyView(record: CrmSequencePolicyRecord) {
  return {
    ...record,
    steps: record.steps.map(step => ({ ...step })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
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

function toAccountDetailView(detail: CrmAccountDetailRecord) {
  return {
    account: toAccountView(detail.account),
    contacts: detail.contacts.map(toContactView),
    timelineEvents: detail.timelineEvents.map(toTimelineEventView)
  };
}

function toSequenceReviewView(
  record: CrmSequenceReviewRecord,
  context: CrmUserContext,
  personaMatch = buildPersonaMatch([], record.account, record.contact)
) {
  return {
    enrollment: toSequenceEnrollmentView(record.enrollment),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    productLine: record.productLine ? toProductLineView(record.productLine) : null,
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    policy: record.policy ? toSequencePolicyView(record.policy) : null,
    firstMessage: record.firstMessage ? toMessageView(record.firstMessage) : null,
    messages: record.messages.map(toMessageView),
    canOperateDraft: record.enrollment.ownerUserId === context.userId,
    canControlSequence: record.enrollment.ownerUserId === context.userId || hasOrganizationAdminRole(context),
    personaMatch: toPersonaMatchView(personaMatch),
    checklist: buildReviewChecklist(record, personaMatch)
  };
}

function buildReviewChecklist(record: CrmSequenceReviewRecord, personaMatch: ResolvedPersonaMatch) {
  return [
    {
      key: 'mailbox_active',
      label: '发送邮箱',
      passed: record.mailbox?.status === 'active',
      message: record.mailbox?.status === 'active' ? `已选择 ${record.mailbox.maskedEmail}` : '未选择启用的发送邮箱'
    },
    {
      key: 'personal_email',
      label: '联系人邮箱',
      passed: !record.contact.isPublicEmail,
      message: record.contact.isPublicEmail ? '公共邮箱，建议人工确认' : `个人邮箱 ${record.contact.maskedEmail}`
    },
    {
      key: 'email_verified',
      label: '邮箱验证',
      passed: record.contact.emailStatus === 'valid',
      message: `当前状态：${toEmailStatusText(record.contact.emailStatus)}`
    },
    {
      key: 'product_line',
      label: '产品资料',
      passed: record.productLine?.status === 'active',
      message: record.productLine?.status === 'active' ? record.productLine.name : '未选择启用的产品资料'
    },
    {
      key: 'persona_focus',
      label: '职位画像',
      passed: Boolean(personaMatch.persona),
      message: buildPersonaMatchChecklistMessage(personaMatch, record.contact)
    },
    {
      key: 'draft_content',
      label: '首封草稿',
      passed: Boolean(record.firstMessage?.subject && record.firstMessage.bodyText),
      message: record.firstMessage ? '已生成首封纯文本草稿' : '尚未生成首封草稿'
    }
  ];
}

function toOwnerScope(context: CrmUserContext) {
  const scope = createCrmReadScope(context);
  return scope.ownerUserId ? { ownerUserId: scope.ownerUserId } : {};
}

function buildLeadImportFingerprints(domain: string | null, input: ImportCrmLeadInput) {
  const fingerprints: Array<{
    fingerprintType: CrmArchivedFingerprintType;
    fingerprintValue: string;
  }> = [];

  if (domain) {
    fingerprints.push({
      fingerprintType: 'domain',
      fingerprintValue: domain
    });
  }

  const email = normalizeEmail(input.contact?.email);

  if (email) {
    fingerprints.push({
      fingerprintType: 'email_hash',
      fingerprintValue: hashEmail(email)
    });
  }

  return fingerprints;
}

function buildArchivedFingerprintInputs(
  account: CrmAccountRecord,
  contacts: CrmContactRecord[],
  archiveReason: string | null,
  archivedAt: Date
) {
  const commonInput = {
    organizationId: account.organizationId,
    accountName: account.name,
    normalizedName: account.normalizedName,
    country: account.country,
    sourceAccountId: account.id,
    sourceTaskId: account.sourceTaskId,
    archiveReason,
    archivedAt
  };
  const fingerprints: CrmArchivedFingerprintUpsertInput[] = account.domain
    ? [
        {
          ...commonInput,
          fingerprintType: 'domain',
          fingerprintValue: account.domain,
          maskedValue: account.domain,
          sourceContactId: null
        }
      ]
    : [];

  for (const contact of contacts) {
    fingerprints.push({
      ...commonInput,
      fingerprintType: 'email_hash',
      fingerprintValue: contact.emailHash,
      maskedValue: contact.maskedEmail,
      sourceContactId: contact.id
    });
  }

  return fingerprints;
}

function toArchivedFingerprintMatchMetadata(record: CrmArchivedFingerprintRecord) {
  return {
    fingerprintType: record.fingerprintType,
    maskedValue: record.maskedValue,
    archivedAt: record.archivedAt.toISOString(),
    accountName: record.accountName
  };
}

function isOwnedMailbox(mailbox: Pick<CrmMailboxRecord, 'organizationId' | 'ownerUserId'>, context: CrmUserContext) {
  return mailbox.organizationId === context.organizationId && mailbox.ownerUserId === context.userId;
}

function normalizeDomain(value?: string | null) {
  const rawValue = value?.trim();

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeNullableString(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeLeadSourceSnapshot(value: ImportCrmLeadInput['sourceSnapshot']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const snapshot: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key) continue;
    if (typeof item === 'string') {
      const normalized = item.trim();
      if (normalized) snapshot[key] = normalized;
      continue;
    }

    if (typeof item === 'number' && Number.isFinite(item)) {
      snapshot[key] = item;
      continue;
    }

    if (typeof item === 'boolean' || item === null) {
      snapshot[key] = item;
    }
  }

  return Object.keys(snapshot).length ? snapshot : null;
}

function normalizeLimitedContent(value: string, emptyMessage: string, maxLength = maxNoteLength) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  if (normalized.length > maxLength) {
    throw new BadRequestException(`内容不能超过 ${maxLength} 个字符`);
  }

  return normalized;
}

function normalizeSelectedEnrollmentIds(value: string[], maxSize: number) {
  if (!Array.isArray(value)) {
    throw new BadRequestException('请选择邮件序列');
  }

  const ids = [...new Set(value.map(item => item.trim()).filter(Boolean))];

  if (ids.length === 0) {
    throw new BadRequestException('请选择邮件序列');
  }

  if (ids.length > maxSize) {
    throw new BadRequestException(`一次最多选择 ${maxSize} 条邮件序列`);
  }

  return ids;
}

function parseOptionalDate(value?: string | null) {
  const normalized = normalizeNullableString(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('时间格式不正确');
  }

  return date;
}

function normalizePersonaProfileCreateInput(input: PersonaProfileCreateInput) {
  const name = normalizeRequiredString(input.name, '画像名称不能为空');

  return {
    name,
    description: normalizeNullableString(input.description),
    titleKeywordsText: normalizeNullableString(input.titleKeywordsText),
    customerTypeKeywordsText: normalizeNullableString(input.customerTypeKeywordsText),
    painPoints: normalizeNullableString(input.painPoints),
    focusText: normalizeNullableString(input.focusText),
    avoidText: normalizeNullableString(input.avoidText)
  };
}

function normalizePersonaProfileUpdateInput(input: PersonaProfileUpdateInput): CrmPersonaProfileUpdateInput {
  const data: CrmPersonaProfileUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '画像名称不能为空');
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'titleKeywordsText')) data.titleKeywordsText = normalizeNullableString(input.titleKeywordsText);
  if (hasOwn(input, 'customerTypeKeywordsText')) {
    data.customerTypeKeywordsText = normalizeNullableString(input.customerTypeKeywordsText);
  }
  if (hasOwn(input, 'painPoints')) data.painPoints = normalizeNullableString(input.painPoints);
  if (hasOwn(input, 'focusText')) data.focusText = normalizeNullableString(input.focusText);
  if (hasOwn(input, 'avoidText')) data.avoidText = normalizeNullableString(input.avoidText);
  if (hasOwn(input, 'isDefault')) data.isDefault = Boolean(input.isDefault);
  if (hasOwn(input, 'status')) data.status = input.status;

  return data;
}

function normalizeEmailTemplateCreateInput(input: EmailTemplateCreateInput) {
  return {
    name: normalizeRequiredString(input.name, '邮件模板名称不能为空'),
    language: normalizeNullableString(input.language) || 'en',
    description: normalizeNullableString(input.description),
    steps: normalizeEmailTemplateSteps(input.steps)
  };
}

function normalizeEmailTemplateUpdateInput(input: EmailTemplateUpdateInput): CrmEmailTemplateGroupUpdateInput {
  const data: CrmEmailTemplateGroupUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '邮件模板名称不能为空');
  if (hasOwn(input, 'language')) data.language = normalizeNullableString(input.language) || 'en';
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'status')) data.status = input.status;
  if (hasOwn(input, 'isDefault')) data.isDefault = input.isDefault;
  if (hasOwn(input, 'steps')) data.steps = normalizeEmailTemplateSteps(input.steps ?? []);

  return data;
}

function normalizeEmailTemplateSteps(steps: EmailTemplateStepInput[]): CrmEmailTemplateStepInput[] {
  if (steps.length !== defaultSequenceStepCount) {
    throw new BadRequestException('邮件模板必须包含 5 个步骤');
  }

  const normalizedSteps = steps
    .map(step => ({
      stepIndex: step.stepIndex,
      name: normalizeRequiredString(step.name, '步骤名称不能为空'),
      threadMode: step.threadMode,
      delayDays: normalizeEmailTemplateDelayDays(step.stepIndex, step.delayDays),
      subjectTemplate: normalizeEmailTemplateSubject(step.stepIndex, step.subjectTemplate),
      bodyTemplate: normalizeLimitedContent(step.bodyTemplate, '邮件正文不能为空', 4000)
    }))
    .toSorted((left, right) => left.stepIndex - right.stepIndex);

  if (normalizedSteps.some((step, index) => step.stepIndex !== index + 1)) {
    throw new BadRequestException('邮件模板步骤必须为 1-5');
  }

  return normalizedSteps;
}

function normalizeEmailTemplateDelayDays(stepIndex: number, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 90) {
    throw new BadRequestException('发送间隔必须在 0-90 天之间');
  }

  return stepIndex === initialDraftStepIndex ? 0 : value;
}

function normalizeEmailTemplateSubject(stepIndex: number, value: string) {
  const normalized = value.trim();

  if (normalized.length > 300) {
    throw new BadRequestException('邮件主题不能超过 300 个字符');
  }

  if (stepIndex !== 2 && !normalized) {
    throw new BadRequestException('新主题邮件必须填写主题');
  }

  return normalized;
}

function normalizeSequencePolicyCreateInput(input: SequencePolicyWriteInput, context: CrmUserContext) {
  const status = normalizeSequencePolicyStatus(input.status);
  const isDefault = Boolean(input.isDefault);

  if (isDefault && status !== 'active') {
    throw new BadRequestException('只能将启用策略设为默认');
  }

  return {
    organizationId: context.organizationId,
    name: normalizeRequiredString(input.name ?? '', '序列策略名称不能为空'),
    description: normalizeNullableString(input.description),
    status,
    isDefault,
    steps: normalizeSequencePolicyWriteSteps(input.steps),
    linkPolicy: normalizeSequencePolicyLinkPolicy(input.linkPolicy),
    allowLowRiskAutoSend: Boolean(input.allowLowRiskAutoSend),
    sameCompanyContactStrategy: normalizeSequencePolicySameCompanyStrategy(input.sameCompanyContactStrategy),
    createdById: context.userId,
    createdByName: context.userName
  };
}

function normalizeSequencePolicyUpdateInput(input: SequencePolicyWriteInput) {
  const data: {
    name?: string;
    description?: string | null;
    status?: ReturnType<typeof normalizeSequencePolicyStatus>;
    isDefault?: boolean;
    steps?: ReturnType<typeof normalizeSequencePolicyWriteSteps>;
    linkPolicy?: ReturnType<typeof normalizeSequencePolicyLinkPolicy>;
    allowLowRiskAutoSend?: boolean;
    sameCompanyContactStrategy?: ReturnType<typeof normalizeSequencePolicySameCompanyStrategy>;
  } = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '序列策略名称不能为空');
  if (hasOwn(input, 'description')) data.description = normalizeNullableString(input.description);
  if (hasOwn(input, 'status')) data.status = normalizeSequencePolicyStatus(input.status);
  if (hasOwn(input, 'isDefault')) data.isDefault = Boolean(input.isDefault);
  if (hasOwn(input, 'steps')) data.steps = normalizeSequencePolicyWriteSteps(input.steps);
  if (hasOwn(input, 'linkPolicy')) data.linkPolicy = normalizeSequencePolicyLinkPolicy(input.linkPolicy);
  if (hasOwn(input, 'allowLowRiskAutoSend')) data.allowLowRiskAutoSend = Boolean(input.allowLowRiskAutoSend);
  if (hasOwn(input, 'sameCompanyContactStrategy')) {
    data.sameCompanyContactStrategy = normalizeSequencePolicySameCompanyStrategy(input.sameCompanyContactStrategy);
  }

  return data;
}

function normalizeSequencePolicyWriteSteps(value: unknown) {
  if (!Array.isArray(value)) {
    return defaultSequencePolicySteps.map(step => ({ ...step }));
  }

  if (value.length !== defaultSequenceStepCount) {
    throw new BadRequestException('序列策略必须包含 5 个步骤');
  }

  const steps = normalizeSequencePolicySteps(value);
  if (steps.some((step, index) => step.stepIndex !== index + 1)) {
    throw new BadRequestException('序列策略步骤必须为 1-5');
  }

  return steps;
}

function normalizeRequiredString(value: string, emptyMessage: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException(emptyMessage);
  }

  return normalized;
}

function isPastArchiveRecoveryWindow(archivedAt: Date, now = new Date()) {
  return now.getTime() - archivedAt.getTime() > accountArchiveRecoveryDays * 24 * 60 * 60 * 1000;
}

function getTemplateStepDelayDays(stepIndex: number, followUpDelayDays: CrmGlobalConfigRecord['followUpDelayDays']) {
  if (stepIndex === initialDraftStepIndex) {
    return 0;
  }

  const delayDaysByStep = new Map([
    [2, followUpDelayDays.step2Days],
    [3, followUpDelayDays.step3Days],
    [4, followUpDelayDays.step4Days],
    [5, followUpDelayDays.step5Days]
  ]);

  return delayDaysByStep.get(stepIndex) ?? 0;
}

function getSequencePolicyStep(policy: CrmSequencePolicyRecord | null, stepIndex: number) {
  return policy?.steps.find(step => step.stepIndex === stepIndex) ?? null;
}

function toPersonaMatchView(match: ResolvedPersonaMatch): CrmPersonaMatchInfo {
  return {
    persona: match.persona,
    matchMethod: match.matchMethod,
    matchedKeywords: match.matchedKeywords,
    fallbackReason: match.fallbackReason
  };
}

function buildPersonaMatchChecklistMessage(match: ResolvedPersonaMatch, contact: Pick<CrmContactRecord, 'title'>) {
  if (match.persona) {
    const reason =
      match.matchMethod === 'title'
        ? `因职位关键词 ${match.matchedKeywords.join('、')} 命中`
        : match.matchMethod === 'customer_type'
          ? `因客户类型关键词 ${match.matchedKeywords.join('、')} 命中`
          : match.matchMethod === 'default'
            ? match.fallbackReason
            : match.fallbackReason;

    return reason ? `已匹配 ${match.persona.name}：${reason}` : `已匹配 ${match.persona.name}`;
  }

  return contact.title ? match.fallbackReason : '缺少联系人职位，按通用开发信生成';
}

function createAiDraftMessageMetadata(aiDraft?: CrmAiDraftMetadata | null) {
  return aiDraft ? { aiDraft } : null;
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

function buildSequenceName(account: CrmAccountRecord, contact: CrmContactRecord) {
  const contactLabel = contact.fullName || contact.title || contact.maskedEmail;

  return `${account.name} - ${contactLabel}`;
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.includes('@') ? normalized : null;
}

function normalizeMailboxEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = /^([^+@\s]+)@gmail\.com$/.exec(normalized);

  if (!match) {
    throw new BadRequestException('第一版仅支持 Gmail 地址，且不支持 alias');
  }

  return normalized;
}

function parseEmailAddress(email: string) {
  const normalized = email.trim().toLowerCase();
  const match = /^([^@\s]+)@([^@\s]+)$/.exec(normalized);

  if (!match || !isDnsDomain(match[2])) {
    return null;
  }

  return {
    domain: match[2]
  };
}

function isDnsDomain(domain: string) {
  if (domain.length > 253 || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }

  const labels = domain.split('.');

  return labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

function hashEmail(email: string) {
  return createHash('sha256').update(email).digest('hex');
}

function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  const prefix = local[0] || '*';
  return `${prefix}***@${domain}`;
}

function isPublicEmail(email: string) {
  const [local = ''] = email.split('@');
  return publicEmailPrefixes.has(local.toLowerCase());
}

function canApplyEmailVerificationAccountStatus(status: CrmAccountStatus) {
  return ['candidate', 'missing_contact', 'email_verification_pending', 'manual_review_pending', 'invalid'].includes(
    status
  );
}

function toAccountStatusAfterEmailVerification(status: CrmEmailStatus): CrmAccountStatus {
  if (status === 'valid') {
    return 'ready';
  }

  if (status === 'invalid') {
    return 'invalid';
  }

  return 'manual_review_pending';
}

function isEmailVerificationCacheFresh(verifiedAt: Date, cooldownDays: number, now: Date) {
  const normalizedDays = normalizeEmailVerificationCooldownDays(cooldownDays);

  return addDays(verifiedAt, normalizedDays).getTime() > now.getTime();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toEmailStatusText(status: CrmEmailStatus) {
  const textMap: Record<CrmEmailStatus, string> = {
    unchecked: '未验证',
    valid: '有效',
    invalid: '无效',
    risky: '风险',
    unreachable: '暂不可达',
    unsubscribed: '已退订'
  };

  return textMap[status];
}

function normalizePositiveInteger(
  value: number | string | undefined,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min) return fallback;

  return Math.min(numberValue, max);
}

function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
