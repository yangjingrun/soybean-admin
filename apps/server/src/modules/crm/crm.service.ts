import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolveMx } from 'node:dns/promises';
import { Prisma } from '../../generated/prisma/client';
import { SystemLogService } from '../system-log/system-log.service';
import type { SystemLogRecorder } from '../system-log/system-log.types';
import { SystemNotificationService } from '../system-notification/system-notification.service';
import type { CrmGmailOAuthFlowPort } from './crm-gmail-oauth-flow';
import { normalizeEmailVerificationCooldownDays } from './crm-global-config';
import { CrmGmailWatchService } from './crm-gmail-watch.service';
import { classifyCustomerReplyMessage } from './crm-inbox-message-classifier';
import {
  defaultTemplateSteps,
  defaultTemplateVariables,
  findPersonaProfile,
  personaProfiles,
  renderEmailTemplateText
} from './crm-email-template-renderer';
import {
  CRM_EMAIL_DNS_RESOLVER,
  CRM_EMAIL_SEND_GATEWAY,
  CRM_GMAIL_OAUTH_FLOW,
  CRM_SEND_QUEUE,
  CRM_STORE
} from './crm.tokens';
import type {
  CrmAccountDetailRecord,
  CrmAccountRecord,
  CrmAccountStatus,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintType,
  CrmArchivedFingerprintUpsertInput,
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
  CrmCustomerReplyIngestRecord,
  CrmInboxMessageType,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadListRecord,
  CrmInboxMessageRecord,
  CrmInboxThreadReplyRecord,
  CrmInboxThreadRecord,
  CrmInboxThreadStatus,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmMessageThreadMode,
  CrmOrganizationConfigRecord,
  CrmProductLineRecord,
  CrmProductLineStatus,
  CrmProductLineUpdateInput,
  CrmSequenceEnrollmentRecord,
  CrmSequenceEnrollmentStatus,
  CrmSequenceReviewRecord,
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
const defaultMailboxDailyLimit = 50;
const defaultMailboxHourlyLimit = 10;
const defaultProductLineStatus: CrmProductLineStatus = 'active';
const defaultEmailTemplateStatus: CrmEmailTemplateStatus = 'active';
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
const queuedMessageStatus: CrmMessageStatus = 'queued';
const stoppableSequenceStatuses: CrmSequenceEnrollmentStatus[] = [...activeSequenceStatuses];
const inboxNotificationTargetType = 'crmInboxThread';
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

export interface CrmEmailDnsResolver {
  resolveMx(domain: string): Promise<unknown[]>;
}

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
}

interface ProductLineUpdateInput extends Partial<ProductLineCreateInput> {
  status?: CrmProductLineStatus;
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
    private readonly gmailWatchService?: Pick<CrmGmailWatchService, 'renewMailboxWatch'> | null
  ) {
    this.dnsResolver = dnsResolver ?? { resolveMx };
  }

  /** Imports one lead candidate into the organization CRM with domain and email dedupe. */
  async importAccountFromLead(input: ImportCrmLeadInput, context: CrmUserContext) {
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
          domain
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

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(toAccountView)
    };
  }

  /** Returns one account detail within the current user's organization scope. */
  async getAccountDetail(id: string, context: CrmUserContext) {
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
    const record = await this.store.getGlobalConfig();

    return toGlobalConfigView(record);
  }

  /** Saves platform-wide CRM settings maintained by super administrators. */
  async saveGlobalConfig(
    input: {
      emailVerificationCooldownDays: number;
      followUpDelayDays?: CrmGlobalConfigRecord['followUpDelayDays'];
    },
    context: CrmUserContext
  ) {
    const record = await this.store.saveGlobalConfig({
      emailVerificationCooldownDays: input.emailVerificationCooldownDays,
      followUpDelayDays: input.followUpDelayDays,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.recordCrmLog('save-global-config', 'CRM 全局配置已保存', context, {
      emailVerificationCooldownDays: record.emailVerificationCooldownDays,
      followUpDelayDays: record.followUpDelayDays
    });

    return toGlobalConfigView(record);
  }

  /** Reads organization-level CRM permission settings. */
  async getOrganizationConfig(context: CrmUserContext) {
    const record = await this.store.getOrganizationConfig(context.organizationId);

    return toOrganizationConfigView(record, context.organizationId);
  }

  /** Saves organization-level CRM permission settings for organization administrators. */
  async saveOrganizationConfig(
    input: {
      allowAdminViewMemberEmailBody: boolean;
    },
    context: CrmUserContext
  ) {
    this.requireOrganizationConfigManager(context);

    const record = await this.store.saveOrganizationConfig({
      organizationId: context.organizationId,
      allowAdminViewMemberEmailBody: input.allowAdminViewMemberEmailBody,
      updatedById: context.userId,
      updatedByName: context.userName
    });

    await this.recordCrmLog('save-organization-config', 'CRM 组织权限配置已保存', context, {
      organizationId: context.organizationId,
      allowAdminViewMemberEmailBody: record.allowAdminViewMemberEmailBody
    });

    return toOrganizationConfigView(record, context.organizationId);
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listBlacklistEntries({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(toBlacklistView)
    };
  }

  /** Removes one organization blacklist entry after recording an audit reason. */
  async removeBlacklistEntry(id: string, input: { reason?: string | null }, context: CrmUserContext) {
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

    await this.recordMailboxLog('mailbox-mock-authorize', 'CRM 邮箱 mock 授权完成', context, mailbox, null, mailbox.status);

    return { mailbox: toMailboxView(mailbox) };
  }

  /** Creates a Google consent URL for the current user mailbox authorization flow. */
  createGmailOAuthAuthorizationUrl(context: CrmUserContext) {
    return this.requireGmailOAuthFlow().createAuthorizationUrl({
      organizationId: context.organizationId,
      userId: context.userId
    });
  }

  /** Completes Gmail OAuth authorization and stores the encrypted refresh token for the mailbox owner. */
  async completeGmailOAuthAuthorization(input: GmailOAuthCompleteInput, context: CrmUserContext) {
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

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(toMailboxView)
    };
  }

  /** Pauses a scoped mailbox after verifying the current user can read it. */
  async pauseMailbox(id: string, context: CrmUserContext) {
    return this.changeMailboxStatus(id, 'paused', new Date(), 'mailbox-pause', 'CRM 邮箱暂停', context);
  }

  /** Resumes a scoped mailbox after verifying the current user can read it. */
  async resumeMailbox(id: string, context: CrmUserContext) {
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listProductLines({
      organizationId: context.organizationId,
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(toProductLineView)
    };
  }

  /** Creates an organization-level product line after checking name uniqueness. */
  async createProductLine(input: ProductLineCreateInput, context: CrmUserContext) {
    const data = normalizeProductLineCreateInput(input);
    await this.assertProductLineNameAvailable(context.organizationId, data.name);
    const productLine = await this.runProductLineWrite(() =>
      this.store.createProductLine({
        organizationId: context.organizationId,
        ...data,
        status: defaultProductLineStatus,
        createdById: context.userId,
        createdByName: context.userName
      })
    );

    await this.recordProductLineLog('product-line-create', 'CRM 产品资料新建', context, productLine, null, productLine.status);

    return { productLine: toProductLineView(productLine) };
  }

  /** Updates an organization-level product line through organization scoped reads and writes. */
  async updateProductLine(id: string, input: ProductLineUpdateInput, context: CrmUserContext) {
    const currentProductLine = await this.requireScopedProductLine(id, context);
    const fromStatus = currentProductLine.status;
    const data = normalizeProductLineUpdateInput(input);

    if (data.name && data.name !== currentProductLine.name) {
      await this.assertProductLineNameAvailable(context.organizationId, data.name, currentProductLine.id);
    }

    const productLine = await this.runProductLineWrite(() =>
      this.store.updateProductLine(currentProductLine.id, context.organizationId, data)
    );

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    await this.recordProductLineLog(
      'product-line-update',
      'CRM 产品资料更新',
      context,
      productLine,
      fromStatus,
      productLine.status
    );

    return { productLine: toProductLineView(productLine) };
  }

  /** Archives an organization-level product line through organization scoped reads and writes. */
  async archiveProductLine(id: string, context: CrmUserContext) {
    const currentProductLine = await this.requireScopedProductLine(id, context);
    const fromStatus = currentProductLine.status;
    const productLine = await this.store.updateProductLine(currentProductLine.id, context.organizationId, {
      status: 'archived'
    });

    if (!productLine) {
      throw new NotFoundException('产品资料不存在');
    }

    await this.recordProductLineLog(
      'product-line-archive',
      'CRM 产品资料归档',
      context,
      productLine,
      fromStatus,
      productLine.status
    );

    return { productLine: toProductLineView(productLine) };
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

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(toEmailTemplateGroupView)
    };
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

    await this.recordEmailTemplateLog('email-template-create', 'CRM 邮件模板新建', context, templateGroup, null, templateGroup.status);

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
    const defaultTemplateGroup = await this.store.findDefaultEmailTemplateGroup(context.organizationId);
    if (defaultTemplateGroup) {
      return {
        templateGroup: {
          ...toEmailTemplateGroupView(defaultTemplateGroup),
          scope: 'organization' as const,
          variables: defaultTemplateVariables.map(variable => ({ ...variable }))
        },
        personas: personaProfiles.map(profile => ({ ...profile, aliases: [...profile.aliases] }))
      };
    }

    const globalConfig = await this.store.getGlobalConfig();

    return {
      templateGroup: {
        id: 'global-first-touch',
        name: '默认开发信序列模板',
        scope: 'global' as const,
        language: 'en',
        variables: defaultTemplateVariables.map(variable => ({ ...variable })),
        steps: defaultTemplateSteps.map(step => ({
          ...step,
          delayDays: getTemplateStepDelayDays(step.stepIndex, globalConfig.followUpDelayDays)
        }))
      },
      personas: personaProfiles.map(profile => ({ ...profile, aliases: [...profile.aliases] }))
    };
  }

  /** Creates one first-email review item and deterministic draft without queueing any send job. */
  async createSequenceReviewItem(input: SequenceReviewCreateInput, context: CrmUserContext) {
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

    const [productLine, mailbox] = await Promise.all([
      input.productLineId ? this.requireActiveProductLine(input.productLineId, context) : Promise.resolve(null),
      input.mailboxId ? this.requireOwnedActiveMailbox(input.mailboxId, context) : Promise.resolve(null)
    ]);
    const defaultTemplateGroup = await this.store.findDefaultEmailTemplateGroup(context.organizationId);
    const draft = generateFirstDraft({ account, contact, productLine, context, templateGroup: defaultTemplateGroup });
    const bundle = await this.runSequenceWrite(() =>
      this.store.createSequenceDraftBundle({
        enrollment: {
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          accountId: account.id,
          contactId: contact.id,
          productLineId: productLine?.id ?? null,
          mailboxId: mailbox?.id ?? null,
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
          threadMode: 'new_subject',
          subject: draft.subject,
          bodyText: draft.bodyText,
          status: 'draft_pending_review'
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
            mailboxId: mailbox?.id ?? null
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
      mailboxId: mailbox?.id ?? null
    });

    return {
      item: toSequenceReviewView(
        {
          enrollment: bundle.enrollment,
          account: bundle.account,
          contact,
          productLine,
          mailbox,
          firstMessage: bundle.message,
          messages: [bundle.message]
        },
        context
      )
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
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const result = await this.store.listSequenceReviewItems({
      organizationId: context.organizationId,
      ...toOwnerScope(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(record => toSequenceReviewView(record, context))
    };
  }

  /** Returns one review item detail with the first draft message. */
  async getSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.requireScopedSequenceReviewItem(id, context);

    return toSequenceReviewView(item, context);
  }

  /** Saves human edits to one draft and keeps it in pending review. */
  async updateMessageDraft(id: string, input: MessageDraftUpdateInput, context: CrmUserContext) {
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

  /** Marks one reviewed draft as ready for the future send queue without sending it. */
  async approveMessageDraft(id: string, context: CrmUserContext) {
    const message = await this.requireOwnedEditableMessage(id, context);
    const reviewItem = await this.requireOwnedSequenceReviewItem(message.enrollmentId, context);

    if (message.stepIndex > initialDraftStepIndex) {
      return this.approveFollowUpMessageDraft(message, reviewItem, context);
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

  /** Confirms a follow-up draft and schedules its guarded send job. */
  private async approveFollowUpMessageDraft(
    message: CrmMessageRecord,
    reviewItem: CrmSequenceReviewRecord,
    context: CrmUserContext
  ) {
    if (reviewItem.enrollment.status !== 'sequence_running') {
      throw new BadRequestException('当前序列状态不能确认后续草稿');
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
      toMessageStatus: queuedMessageStatus,
      accountStatus: 'sequence_running'
    });

    if (!approval) {
      throw new BadRequestException('当前草稿状态已变化，请刷新后重试');
    }

    try {
      const delayMs = Math.max(0, message.scheduledAt.getTime() - Date.now());
      const { jobId } = await this.enqueueFirstMessage(approval.enrollment, approval.message, delayMs);
      const queuedMessage = await this.store.updateMessage(
        approval.message.id,
        approval.message.organizationId,
        { bullJobId: jobId },
        { status: queuedMessageStatus }
      );

      if (queuedMessage) {
        approval.message = queuedMessage;
      }
    } catch (error) {
      await this.store.updateMessage(
        approval.message.id,
        approval.message.organizationId,
        { status: 'draft_pending_review', bullJobId: null },
        { status: queuedMessageStatus }
      );
      throw error;
    }

    await this.recordCrmLog('follow-up-draft-approve', 'CRM 后续开发信人工确认并进入发送队列', context, {
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

  /** Starts the approved first message by queueing a guarded background send job. */
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
      toMessageStatus: queuedMessageStatus,
      accountStatus: 'sequence_running',
      scheduledAt: new Date()
    });

    if (!started) {
      throw new BadRequestException('当前序列状态已变化，请刷新后重试');
    }

    try {
      const { jobId } = await this.enqueueFirstMessage(started.enrollment, started.message);
      const queuedMessage = await this.store.updateMessage(
        started.message.id,
        started.message.organizationId,
        { bullJobId: jobId },
        { status: queuedMessageStatus }
      );

      if (queuedMessage) {
        started.message = queuedMessage;
      }
    } catch (error) {
      await this.store.failFirstMessageSend({
        enrollmentId: started.enrollment.id,
        messageId: started.message.id,
        organizationId: started.enrollment.organizationId,
        ownerUserId: started.enrollment.ownerUserId,
        runVersion: started.enrollment.runVersion,
        reason: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    await this.recordCrmLog('sequence-send-started', 'CRM 首封开发信已进入发送队列', context, {
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
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const mailboxId = normalizeNullableString(query.mailboxId);
    const organizationConfig = await this.store.getOrganizationConfig(context.organizationId);
    const result = await this.store.listInboxThreads({
      organizationId: context.organizationId,
      ...toOwnerScope(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(mailboxId ? { mailboxId } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return {
      current,
      size,
      total: result.total,
      records: result.records.map(record => toInboxThreadListView(record, context, organizationConfig))
    };
  }

  /** Returns one customer reply inbox thread with messages and timeline. */
  async getInboxThread(id: string, context: CrmUserContext) {
    const thread = await this.store.getInboxThread({
      id,
      organizationId: context.organizationId,
      ...toOwnerScope(context)
    });

    if (!thread) {
      throw new NotFoundException('收件箱会话不存在');
    }

    const organizationConfig = await this.store.getOrganizationConfig(context.organizationId);
    const detail = toInboxThreadDetailView(thread, context, organizationConfig);
    await this.recordSuperAdminInboxBodyAudit(thread, detail.messages.length, context);

    return detail;
  }

  /** Updates one owner-scoped inbox thread processing status. */
  async updateInboxThreadStatus(
    id: string,
    input: {
      status: CrmInboxThreadStatus;
    },
    context: CrmUserContext
  ) {
    const currentThread = await this.requireOwnedInboxThread(id, context);
    const updated = await this.store.updateInboxThreadStatus({
      id: currentThread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromStatus: currentThread.status,
      toStatus: input.status,
      accountStatus: input.status === 'handled' ? 'followed_up' : input.status === 'pending' ? 'replied_pending' : undefined
    });

    if (!updated) {
      throw new BadRequestException('当前收件箱状态已变化，请刷新后重试');
    }

    if (input.status === 'handled') {
      await this.systemNotificationService?.markTargetReadForUser(inboxNotificationTargetType, updated.thread.id, context.userId);
    }

    await this.recordCrmLog('inbox-thread-status-update', 'CRM 收件箱处理状态更新', context, {
      organizationId: context.organizationId,
      accountId: updated.thread.accountId,
      contactId: updated.thread.contactId,
      threadId: updated.thread.id,
      fromStatus: currentThread.status,
      toStatus: updated.thread.status
    });

    return {
      thread: toInboxThreadView(updated.thread),
      account: toAccountView(updated.account),
      event: toTimelineEventView(updated.event)
    };
  }

  /** Sends a plain-text reply from the owner mailbox and marks the inbox thread handled. */
  async replyInboxThread(
    id: string,
    input: {
      bodyText: string;
    },
    context: CrmUserContext
  ) {
    const bodyText = normalizeLimitedContent(input.bodyText, '回复正文不能为空', 10000);
    const detail = await this.store.getInboxThread({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!detail) {
      throw new NotFoundException('收件箱会话不存在');
    }

    if (!detail.mailbox || detail.mailbox.status !== 'active') {
      throw new BadRequestException('发送邮箱不可用，请重新授权或更换邮箱');
    }

    if (!this.sendGateway) {
      throw new BadRequestException('邮件发送网关未配置');
    }

    const sentAt = new Date();
    const sent = await this.sendGateway.replyPlainText({
      thread: detail.thread,
      account: detail.account,
      contact: detail.contact,
      mailbox: detail.mailbox,
      subject: detail.thread.subject,
      bodyText
    });
    const replied = await this.store.replyInboxThread({
      id: detail.thread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      subject: detail.thread.subject,
      bodyText,
      sentAt,
      providerMessageId: sent.providerMessageId ?? null
    });

    if (!replied) {
      throw new BadRequestException('回复保存失败，请刷新后重试');
    }

    await this.recordCrmLog('inbox-thread-reply', 'CRM 收件箱系统内回复', context, {
      organizationId: context.organizationId,
      accountId: replied.account.id,
      contactId: replied.contact.id,
      threadId: replied.thread.id,
      inboxMessageId: replied.message.id,
      providerMessageId: sent.providerMessageId ?? null
    });

    const nextDetail = await this.store.getInboxThread({
      id: replied.thread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const organizationConfig = await this.store.getOrganizationConfig(context.organizationId);

    return nextDetail
      ? toInboxThreadDetailView(nextDetail, context, organizationConfig)
      : toInboxThreadReplyView(replied, context);
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
    const outboundMessage = await this.store.findMessageById({
      id: outboundMessageId,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!outboundMessage) {
      throw new NotFoundException('邮件不存在');
    }

    if (outboundMessage.status !== 'sent') {
      throw new BadRequestException('只能为已发送邮件模拟客户回信');
    }

    const receivedAt = parseOptionalDate(input.receivedAt) ?? new Date();
    const subject = normalizeNullableString(input.subject) ?? `Re: ${outboundMessage.subject}`;
    const bodyText = normalizeLimitedContent(input.bodyText, '回复正文不能为空', 10000);
    const messageType = classifyCustomerReplyMessage(subject, bodyText);
    const ingested = await this.store.ingestCustomerReply({
      outboundMessageId: outboundMessage.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      subject,
      bodyText,
      receivedAt,
      messageType
    });

    if (!ingested) {
      throw new BadRequestException('客户回信入库失败，请刷新后重试');
    }

    if (!ingested.isDuplicate) {
      await this.notifyCustomerReply(ingested.thread, ingested.message, ingested.account, ingested.contact, context);
      await this.recordCrmLog('inbox-reply-ingest', 'CRM 客户回信已入库', context, {
        organizationId: context.organizationId,
        accountId: ingested.account.id,
        contactId: ingested.contact.id,
        enrollmentId: ingested.enrollment?.id ?? null,
        threadId: ingested.thread.id,
        inboxMessageId: ingested.message.id
      });
    }

    const detail = await this.store.getInboxThread({
      id: ingested.thread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const organizationConfig = await this.store.getOrganizationConfig(context.organizationId);

    return detail ? toInboxThreadDetailView(detail, context, organizationConfig) : toInboxReplyIngestView(ingested, context);
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
    const account = await this.store.updateAccount(detail.account.id, { status });

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

  private async findArchivedImportMatches(
    domain: string | null,
    input: ImportCrmLeadInput,
    context: CrmUserContext
  ) {
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
    const mailbox = await this.store.updateMailbox(currentMailbox.id, { status, pausedAt });

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

  private async requireOwnedInboxThread(id: string, context: CrmUserContext) {
    const thread = await this.store.getInboxThread({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!thread) {
      throw new NotFoundException('收件箱会话不存在');
    }

    return thread.thread;
  }

  private async notifyCustomerReply(
    thread: CrmInboxThreadRecord,
    message: CrmInboxMessageRecord,
    account: CrmAccountRecord,
    contact: CrmContactRecord,
    context: CrmUserContext
  ) {
    const notificationCopy = toInboxNotificationCopy(message.messageType, account, contact);
    try {
      await this.systemNotificationService?.create({
        userId: thread.ownerUserId,
        userName: context.userName,
        module: 'crm',
        type: 'crm_customer_reply',
        title: notificationCopy.title,
        content: notificationCopy.content,
        targetType: inboxNotificationTargetType,
        targetId: thread.id,
        routePath: '/crm/inbox',
        metadata: {
          organizationId: thread.organizationId,
          accountId: thread.accountId,
          contactId: thread.contactId,
          threadId: thread.id,
          messageType: message.messageType
        }
      });
    } catch (error) {
      await this.recordCrmLog('inbox-reply-notification-failed', 'CRM 客户回信通知创建失败', context, {
        organizationId: thread.organizationId,
        accountId: thread.accountId,
        contactId: thread.contactId,
        threadId: thread.id,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async enqueueFirstMessage(enrollment: CrmSequenceEnrollmentRecord, message: CrmMessageRecord, delayMs?: number) {
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

  private async assertProductLineNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingProductLine = await this.store.findProductLineByName(organizationId, name);

    if (existingProductLine && existingProductLine.id !== ignoredId) {
      throw new BadRequestException('产品资料名称已存在');
    }
  }

  private async assertEmailTemplateNameAvailable(organizationId: string, name: string, ignoredId?: string) {
    const existingTemplate = await this.store.findEmailTemplateGroupByName(organizationId, name);

    if (existingTemplate && existingTemplate.id !== ignoredId) {
      throw new BadRequestException('邮件模板名称已存在');
    }
  }

  private async runProductLineWrite<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException('产品资料名称已存在');
      }

      throw error;
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

  private recordCrmLog(
    action: string,
    message: string,
    context: CrmUserContext,
    metadata: Record<string, unknown>
  ) {
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
    if (context.organizationRole === 'admin' || context.roles.includes('R_SUPER')) {
      return;
    }

    throw new ForbiddenException('仅组织管理员可修改 CRM 权限配置');
  }

  private recordSuperAdminInboxBodyAudit(
    record: CrmInboxThreadDetailRecord,
    visibleMessageCount: number,
    context: CrmUserContext
  ) {
    if (!context.roles.includes('R_SUPER') || record.thread.ownerUserId === context.userId || visibleMessageCount <= 0) {
      return undefined;
    }

    return this.recordCrmLog('inbox-body-viewed-by-super-admin', '平台超管查看 CRM 邮件正文', context, {
      organizationId: record.thread.organizationId,
      threadId: record.thread.id,
      accountId: record.thread.accountId,
      contactId: record.thread.contactId,
      mailboxId: record.thread.mailboxId,
      ownerUserId: record.thread.ownerUserId,
      provider: record.thread.provider,
      providerThreadId: record.thread.providerThreadId,
      visibleMessageCount
    });
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

  private recordProductLineLog(
    action: string,
    message: string,
    context: CrmUserContext,
    productLine: CrmProductLineRecord,
    fromStatus: CrmProductLineStatus | null,
    toStatus: CrmProductLineStatus
  ) {
    return this.recordCrmLog(action, message, context, {
      organizationId: productLine.organizationId,
      productLineId: productLine.id,
      name: productLine.name,
      status: productLine.status,
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

function toGlobalConfigView(record: CrmGlobalConfigRecord) {
  return {
    ...record,
    updatedAt: record.updatedAt.toISOString()
  };
}

function toOrganizationConfigView(record: CrmOrganizationConfigRecord | null, organizationId: string) {
  return {
    id: record?.id ?? null,
    organizationId,
    allowAdminViewMemberEmailBody: record?.allowAdminViewMemberEmailBody ?? false,
    updatedAt: record?.updatedAt.toISOString() ?? null
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
  const {
    encryptedRefreshToken: _encryptedRefreshToken,
    syncIssueType: _syncIssueType,
    syncIssueAt: _syncIssueAt,
    syncIssueMessage: _syncIssueMessage,
    ...safeRecord
  } = record;

  return {
    ...safeRecord,
    authorizedAt: record.authorizedAt.toISOString(),
    watchExpiration: record.watchExpiration?.toISOString() ?? null,
    lastSyncIssue: toMailboxSyncIssueView(record),
    pausedAt: record.pausedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
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
    scheduledAt: record.scheduledAt?.toISOString() ?? null,
    sentAt: record.sentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toInboxThreadView(record: CrmInboxThreadRecord) {
  return {
    ...record,
    lastInboundAt: record.lastInboundAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toInboxMessageView(record: CrmInboxMessageRecord, mailbox?: CrmMailboxRecord | null) {
  const isOutbound = Boolean(mailbox && record.fromEmailHash === mailbox.emailHash);
  const timestamp = record.receivedAt.toISOString();

  return {
    ...record,
    direction: isOutbound ? 'outbound' : 'inbound',
    sentAt: isOutbound ? timestamp : null,
    receivedAt: isOutbound ? null : timestamp,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.createdAt.toISOString()
  };
}

function toInboxThreadListView(
  record: CrmInboxThreadListRecord,
  context: CrmUserContext,
  organizationConfig: CrmOrganizationConfigRecord | null
) {
  const canReadBody = canReadInboxBody(record.thread, context, organizationConfig);

  return {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: canReadBody ? record.lastMessage?.snippet ?? '' : '',
    canReadBody,
    canOperate: record.thread.ownerUserId === context.userId
  };
}

function toInboxThreadDetailView(
  record: CrmInboxThreadDetailRecord,
  context: CrmUserContext,
  organizationConfig: CrmOrganizationConfigRecord | null
) {
  const thread = toInboxThreadListView(record, context, organizationConfig);
  const canReadBody = canReadInboxBody(record.thread, context, organizationConfig);

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: canReadBody ? record.messages.map(message => toInboxMessageView(message, record.mailbox)) : [],
    timelineEvents: record.timelineEvents.map(toTimelineEventView),
    canOperate: thread.canOperate
  };
}

function toInboxReplyIngestView(record: CrmCustomerReplyIngestRecord, context: CrmUserContext) {
  const thread = {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: record.message.snippet ?? '',
    canOperate: record.thread.ownerUserId === context.userId
  };

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: [toInboxMessageView(record.message, record.mailbox)],
    timelineEvents: record.event ? [toTimelineEventView(record.event)] : [],
    canOperate: thread.canOperate
  };
}

function toInboxThreadReplyView(record: CrmInboxThreadReplyRecord, context: CrmUserContext) {
  const thread = {
    ...toInboxThreadView(record.thread),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    mailbox: toMailboxView(record.mailbox),
    enrollment: record.enrollment ? toSequenceEnrollmentView(record.enrollment) : null,
    lastMessageSnippet: record.message.snippet ?? '',
    canOperate: record.thread.ownerUserId === context.userId
  };

  return {
    thread,
    account: thread.account,
    contact: thread.contact,
    mailbox: thread.mailbox,
    enrollment: thread.enrollment,
    messages: [toInboxMessageView(record.message, record.mailbox)],
    timelineEvents: [toTimelineEventView(record.event)],
    canOperate: thread.canOperate
  };
}

function toAccountDetailView(detail: CrmAccountDetailRecord) {
  return {
    account: toAccountView(detail.account),
    contacts: detail.contacts.map(toContactView),
    timelineEvents: detail.timelineEvents.map(toTimelineEventView)
  };
}

function toSequenceReviewView(record: CrmSequenceReviewRecord, context: CrmUserContext) {
  return {
    enrollment: toSequenceEnrollmentView(record.enrollment),
    account: toAccountView(record.account),
    contact: toContactView(record.contact),
    productLine: record.productLine ? toProductLineView(record.productLine) : null,
    mailbox: record.mailbox ? toMailboxView(record.mailbox) : null,
    firstMessage: record.firstMessage ? toMessageView(record.firstMessage) : null,
    messages: record.messages.map(toMessageView),
    canOperateDraft: record.enrollment.ownerUserId === context.userId,
    canControlSequence: record.enrollment.ownerUserId === context.userId || isOrganizationAdmin(context),
    checklist: buildReviewChecklist(record)
  };
}

function buildReviewChecklist(record: CrmSequenceReviewRecord) {
  const persona = findPersonaProfile(record.contact.title);

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
      passed: Boolean(persona),
      message: persona
        ? `已匹配 ${persona.label}：${persona.focusText}`
        : record.contact.title
          ? `未匹配职位画像：${record.contact.title}`
          : '缺少联系人职位，按通用开发信生成'
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
  return isOrganizationAdmin(context) ? {} : { ownerUserId: context.userId };
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

function isOrganizationAdmin(context: CrmUserContext) {
  return context.organizationRole === 'admin' || context.roles.includes('R_SUPER');
}

function isOwnedMailbox(mailbox: Pick<CrmMailboxRecord, 'organizationId' | 'ownerUserId'>, context: CrmUserContext) {
  return mailbox.organizationId === context.organizationId && mailbox.ownerUserId === context.userId;
}

function canReadInboxBody(
  thread: Pick<CrmInboxThreadRecord, 'ownerUserId'>,
  context: CrmUserContext,
  organizationConfig: Pick<CrmOrganizationConfigRecord, 'allowAdminViewMemberEmailBody'> | null
) {
  if (thread.ownerUserId === context.userId || context.roles.includes('R_SUPER')) {
    return true;
  }

  return context.organizationRole === 'admin' && Boolean(organizationConfig?.allowAdminViewMemberEmailBody);
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

function normalizeProductLineCreateInput(input: ProductLineCreateInput) {
  const name = normalizeRequiredString(input.name, '产品资料名称不能为空');

  return {
    name,
    targetCustomerType: normalizeNullableString(input.targetCustomerType),
    coreSellingPoints: normalizeNullableString(input.coreSellingPoints),
    moq: normalizeNullableString(input.moq),
    leadTime: normalizeNullableString(input.leadTime),
    paymentTerms: normalizeNullableString(input.paymentTerms),
    certifications: normalizeNullableString(input.certifications),
    catalogUrl: normalizeNullableString(input.catalogUrl),
    websiteUrl: normalizeNullableString(input.websiteUrl),
    commonModelsText: normalizeNullableString(input.commonModelsText)
  };
}

function normalizeProductLineUpdateInput(input: ProductLineUpdateInput): CrmProductLineUpdateInput {
  const data: CrmProductLineUpdateInput = {};

  if (hasOwn(input, 'name')) data.name = normalizeRequiredString(input.name ?? '', '产品资料名称不能为空');
  if (hasOwn(input, 'targetCustomerType')) data.targetCustomerType = normalizeNullableString(input.targetCustomerType);
  if (hasOwn(input, 'coreSellingPoints')) data.coreSellingPoints = normalizeNullableString(input.coreSellingPoints);
  if (hasOwn(input, 'moq')) data.moq = normalizeNullableString(input.moq);
  if (hasOwn(input, 'leadTime')) data.leadTime = normalizeNullableString(input.leadTime);
  if (hasOwn(input, 'paymentTerms')) data.paymentTerms = normalizeNullableString(input.paymentTerms);
  if (hasOwn(input, 'certifications')) data.certifications = normalizeNullableString(input.certifications);
  if (hasOwn(input, 'catalogUrl')) data.catalogUrl = normalizeNullableString(input.catalogUrl);
  if (hasOwn(input, 'websiteUrl')) data.websiteUrl = normalizeNullableString(input.websiteUrl);
  if (hasOwn(input, 'commonModelsText')) data.commonModelsText = normalizeNullableString(input.commonModelsText);
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

/** Builds a conservative first-touch draft from verified CRM fields only. */
function generateFirstDraft(options: {
  account: CrmAccountRecord;
  contact: CrmContactRecord;
  productLine: CrmProductLineRecord | null;
  context: CrmUserContext;
  templateGroup?: CrmEmailTemplateGroupRecord | null;
}): GeneratedDraft {
  const { account, contact, context, productLine, templateGroup } = options;
  const templateStep = templateGroup?.steps.find(step => step.stepIndex === initialDraftStepIndex);
  const greetingName = contact.fullName || contact.title || 'there';
  const productName = productLine?.name || 'our product line';
  const sellingPoint = productLine?.coreSellingPoints || `supporting ${account.customerType || 'B2B'} customers`;
  const persona = findPersonaProfile(contact.title);

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

function toInboxNotificationCopy(
  messageType: CrmInboxMessageType,
  account: CrmAccountRecord,
  contact: CrmContactRecord
) {
  if (messageType === 'bounce') {
    return {
      title: '邮件退信',
      content: `${account.name} / ${contact.maskedEmail} 邮件退信，请检查邮箱可达性`
    };
  }

  if (messageType === 'unsubscribe_hint') {
    return {
      title: '客户要求停止联系',
      content: `${account.name} / ${contact.maskedEmail} 可能要求退订或停止联系`
    };
  }

  return {
    title: '收到客户回信',
    content: `${account.name} / ${contact.maskedEmail} 回复了开发信`
  };
}

function normalizePositiveInteger(value: number | string | undefined, fallback: number) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function hasOwn<T extends object>(object: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPrismaUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
