import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { resolveMx } from 'node:dns/promises';
import { createPageResult } from '../../../shared/pagination';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { HunterClient } from '../../ai-gateway/hunter-client.service';
import { normalizeEmailVerificationCooldownDays } from '../crm-global-config';
import { CRM_ACCOUNT_REPOSITORY, CRM_EMAIL_DNS_RESOLVER, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmAccountStatus,
  CrmArchivedFingerprintRecord,
  CrmArchivedFingerprintType,
  CrmArchivedFingerprintUpsertInput,
  CrmContactRecord,
  CrmEmailStatus,
  CrmEmailVerificationReason,
  CrmLeadEnrichmentProvider,
  CrmUserContext,
  ImportCrmLeadInput
} from '../crm.types';
import {
  hashEmail,
  isNoMxDnsError,
  isPublicEmail,
  maskEmail,
  normalizeEmail,
  parseEmailAddress,
  type CrmEmailDnsResolver
} from '../shared/crm-email-utils';
import { selectBestHunterContact } from '../shared/crm-hunter-contact-picker';
import { CrmLoggerService } from '../shared/crm-logger.service';
import {
  normalizeCrmDomain,
  normalizeCrmName,
  normalizeLimitedContent,
  normalizeNullableString,
  normalizePositiveInteger
} from '../shared/crm-normalizers';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import {
  toAccountDetailView,
  toAccountView,
  toContactView,
  toLeadEnrichmentHistoryView,
  toTimelineEventView
} from '../shared/crm-view-mappers';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import type { CrmAccountRepository } from './crm-account.repository';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const accountArchiveRecoveryDays = 30;

interface EmailVerificationProbeResult {
  status: Extract<CrmEmailStatus, 'valid' | 'invalid' | 'risky' | 'unreachable'>;
  domain: string | null;
  reason: CrmEmailVerificationReason;
}

interface EmailVerificationResult extends EmailVerificationProbeResult {
  cacheHit: boolean;
}

@Injectable()
export class CrmAccountService {
  private readonly dnsResolver: CrmEmailDnsResolver;

  constructor(
    @Inject(CRM_ACCOUNT_REPOSITORY) private readonly accountRepository: CrmAccountRepository,
    @Inject(CRM_SETTINGS_REPOSITORY) private readonly settingsRepository: CrmSettingsRepository,
    @Optional()
    @Inject(CRM_EMAIL_DNS_RESOLVER)
    dnsResolver?: CrmEmailDnsResolver,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService,
    @Optional()
    @Inject(AiGatewayService)
    private readonly aiGatewayService?: Pick<AiGatewayService, 'getRequiredUserHunterConfig'>,
    @Optional()
    @Inject(HunterClient)
    private readonly hunterClient?: Pick<HunterClient, 'domainSearch'>
  ) {
    this.dnsResolver = dnsResolver ?? { resolveMx };
  }

  /** Import one lead candidate into the organization CRM with domain and email dedupe. */
  async importAccountFromLead(input: ImportCrmLeadInput, context: CrmUserContext) {
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException('客户名称不能为空');
    }

    const domain = normalizeCrmDomain(input.websiteUrl);
    const archivedMatches = await this.findArchivedImportMatches(domain, input, context);
    const existingAccount = domain
      ? await this.accountRepository.findAccountByDomain(context.organizationId, context.userId, domain)
      : null;
    const account =
      existingAccount ??
      (await this.accountRepository.createAccount({
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        name,
        normalizedName: normalizeCrmName(name),
        websiteUrl: normalizeNullableString(input.websiteUrl),
        domain,
        country: normalizeNullableString(input.country),
        customerType: normalizeNullableString(input.customerType),
        status: input.contact?.email ? 'email_verification_pending' : 'missing_contact',
        sourceTaskId: normalizeNullableString(input.sourceTaskId)
      }));

    if (!existingAccount) {
      await this.accountRepository.createTimelineEvent({
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

  /** Batch match one Serper page against owner-scoped CRM identities before provider enrichment. */
  findLeadImportPrecheckMatches(
    input: {
      domains: string[];
      normalizedNames: string[];
    },
    context: CrmUserContext
  ) {
    return this.accountRepository.findAccountsForLeadImportPrecheck({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      domains: normalizeUniqueDomains(input.domains),
      normalizedNames: normalizeUniqueNames(input.normalizedNames)
    });
  }

  /** Keep only inputs whose provider/domain history has not been queried automatically before. */
  async filterLeadInputsForAutoEnrichment(
    inputs: ImportCrmLeadInput[],
    context: CrmUserContext,
    provider: CrmLeadEnrichmentProvider
  ) {
    const domainInputs = inputs.flatMap(input => {
      const domain = normalizeCrmDomain(input.websiteUrl);

      return domain ? [{ input, domain }] : [];
    });
    const uniqueDomains = normalizeUniqueDomains(domainInputs.map(item => item.domain));
    const histories = await this.accountRepository.findLeadEnrichmentHistories({
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      provider,
      identityType: 'domain',
      identityValues: uniqueDomains
    });
    const queriedDomains = new Set(histories.map(history => history.identityValue));

    return {
      inputsToEnrich: domainInputs.filter(item => !queriedDomains.has(item.domain)).map(item => item.input),
      skippedNoDomainCount: inputs.length - domainInputs.length,
      skippedExistingHistoryCount: domainInputs.filter(item => queriedDomains.has(item.domain)).length
    };
  }

  /** Record minimal provider enrichment history by domain, without storing external raw responses. */
  async recordLeadEnrichmentHistories(
    inputs: ImportCrmLeadInput[],
    context: CrmUserContext,
    options: {
      provider: CrmLeadEnrichmentProvider;
      status: 'success' | 'failed';
      attemptedAt?: Date;
      errorMessage?: string | null;
    }
  ) {
    const attemptedAt = options.attemptedAt ?? new Date();
    const domains = new Set<string>();
    const records = [];

    for (const input of inputs) {
      const domain = normalizeCrmDomain(input.websiteUrl);

      if (!domain || domains.has(domain)) {
        continue;
      }

      domains.add(domain);
      const email = normalizeEmail(input.contact?.email);

      records.push(
        await this.accountRepository.upsertLeadEnrichmentHistory({
          organizationId: context.organizationId,
          ownerUserId: context.userId,
          provider: options.provider,
          identityType: 'domain',
          identityValue: domain,
          status: options.status,
          lastAttemptedAt: attemptedAt,
          lastSucceededAt: options.status === 'success' ? attemptedAt : null,
          maskedEmail: email ? maskEmail(email) : null,
          errorMessage: normalizeNullableString(options.errorMessage)
        })
      );
    }

    return records;
  }

  /** List accounts within the current organization and apply member ownership isolation. */
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
    const result = await this.accountRepository.listAccounts({
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context),
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

  /** Return one account detail within the current user's organization scope. */
  async getAccountDetail(id: string, context: CrmUserContext) {
    const detail = await this.requireScopedAccountDetail(id, context);

    return toAccountDetailView(detail);
  }

  /** Manually refresh contacts for one scoped CRM account through a provider. */
  async refreshAccountEnrichment(
    id: string,
    input: { provider: CrmLeadEnrichmentProvider },
    context: CrmUserContext
  ) {
    if (input.provider !== 'hunter') {
      throw new BadRequestException('暂不支持该联系人获取渠道');
    }

    if (!this.aiGatewayService || !this.hunterClient) {
      throw new BadGatewayException('Hunter 联系人获取服务不可用');
    }

    const detail = await this.requireScopedAccountDetail(id, context);
    const domain = detail.account.domain ?? normalizeCrmDomain(detail.account.websiteUrl);

    if (!domain) {
      throw new BadRequestException('当前线索没有可用于 Hunter 查询的官网域名');
    }

    const attemptedAt = new Date();

    try {
      const config = await this.aiGatewayService.getRequiredUserHunterConfig(context);
      const hunterResult = await this.hunterClient.domainSearch(config, { domain, limit: 10, offset: 0 });
      const contact = selectBestHunterContact(hunterResult);
      const importResult = contact
        ? await this.importAccountFromLead(
            {
              name: detail.account.name,
              websiteUrl: detail.account.websiteUrl ?? domain,
              country: detail.account.country,
              customerType: detail.account.customerType,
              sourceTaskId: detail.account.sourceTaskId,
              contact
            },
            context
          )
        : { account: detail.account, contact: null };
      const history = await this.accountRepository.upsertLeadEnrichmentHistory({
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        accountId: importResult.account.id,
        contactId: importResult.contact?.id ?? null,
        provider: 'hunter',
        identityType: 'domain',
        identityValue: domain,
        status: 'success',
        lastAttemptedAt: attemptedAt,
        lastSucceededAt: attemptedAt,
        maskedEmail: importResult.contact?.maskedEmail ?? null,
        errorMessage: null
      });

      await this.accountRepository.createTimelineEvent({
        organizationId: importResult.account.organizationId,
        accountId: importResult.account.id,
        contactId: importResult.contact?.id ?? null,
        ownerUserId: context.userId,
        eventType: 'lead_enrichment_refreshed',
        title: '重新获取联系人',
        content: contact ? 'Hunter 联系人获取已完成。' : 'Hunter 未找到符合自动导入规则的联系人。',
        metadata: {
          provider: 'hunter',
          domain,
          status: 'success',
          maskedEmail: importResult.contact?.maskedEmail ?? null
        }
      });

      return {
        contact: importResult.contact ? toContactView(importResult.contact) : null,
        enrichmentHistory: toLeadEnrichmentHistoryView(history)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const history = await this.accountRepository.upsertLeadEnrichmentHistory({
        organizationId: context.organizationId,
        ownerUserId: context.userId,
        accountId: detail.account.id,
        provider: 'hunter',
        identityType: 'domain',
        identityValue: domain,
        status: 'failed',
        lastAttemptedAt: attemptedAt,
        lastSucceededAt: null,
        maskedEmail: null,
        errorMessage
      });

      await this.accountRepository.createTimelineEvent({
        organizationId: detail.account.organizationId,
        accountId: detail.account.id,
        ownerUserId: context.userId,
        eventType: 'lead_enrichment_refresh_failed',
        title: '重新获取联系人失败',
        content: errorMessage,
        metadata: {
          provider: 'hunter',
          domain,
          historyId: history.id
        }
      });

      throw error;
    }
  }

  /** Change the scoped account status and record a timeline event. */
  updateAccountStatus(
    id: string,
    input: {
      status: CrmAccountStatus;
      remark?: string | null;
    },
    context: CrmUserContext
  ) {
    return this.changeAccountStatus(id, input.status, 'status_changed', '线索状态变更', input.remark, context);
  }

  /** Add a user note to the scoped account timeline. */
  async addAccountNote(id: string, input: { content: string }, context: CrmUserContext) {
    const detail = await this.requireScopedAccountDetail(id, context);
    const content = normalizeLimitedContent(input.content, '备注内容不能为空');
    const event = await this.accountRepository.createTimelineEvent({
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

  /** Archive the scoped account and record the archive reason in timeline. */
  async archiveAccount(id: string, input: { reason?: string | null }, context: CrmUserContext) {
    const detail = await this.requireScopedAccountDetail(id, context);
    const fromStatus = detail.account.status;
    const archiveReason = normalizeNullableString(input.reason);
    const archivedAt = new Date();
    const account = await this.accountRepository.updateAccount(detail.account.id, {
      status: 'archived',
      archivedAt,
      archiveReason,
      archiveSlimmedAt: null
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.accountRepository.createTimelineEvent({
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

  /** Restore an archived account while the full recovery window is still open. */
  async restoreAccount(id: string, context: CrmUserContext) {
    const detail = await this.requireScopedAccountDetail(id, context);

    if (detail.account.status !== 'archived') {
      throw new BadRequestException('只有已归档线索可以恢复');
    }

    if (!detail.account.archivedAt || isPastArchiveRecoveryWindow(detail.account.archivedAt)) {
      throw new BadRequestException('归档已超过 30 天，不能直接恢复');
    }

    const account = await this.accountRepository.updateAccount(detail.account.id, {
      status: 'candidate',
      archivedAt: null,
      archiveReason: null,
      archiveSlimmedAt: null
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.accountRepository.createTimelineEvent({
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

  /** Verify one scoped contact email with basic syntax and MX lookup. */
  async verifyContactEmail(id: string, context: CrmUserContext) {
    const contact = await this.accountRepository.findContactById({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
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
    const existingContact = await this.accountRepository.findContactByEmailHash(
      context.organizationId,
      context.userId,
      emailHash
    );

    if (existingContact) {
      if (existingContact.accountId !== account.id) {
        const updatedContact = await this.accountRepository.updateContact(existingContact.id, { accountId: account.id });

        return updatedContact ?? existingContact;
      }
      return existingContact;
    }

    const contact = await this.accountRepository.createContact({
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

    await this.accountRepository.createTimelineEvent({
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
    const updatedContact = await this.accountRepository.updateContactEmailStatus(contact.id, verification.status);

    if (!updatedContact) {
      throw new NotFoundException('联系人不存在');
    }

    const event = await this.accountRepository.createTimelineEvent({
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
    await this.crmLogger?.record('contact-email-verify', 'CRM 联系人邮箱验证完成', context, {
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

    return (await this.accountRepository.updateAccount(account.id, { status: nextStatus })) ?? account;
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
    const account = await this.accountRepository.updateAccount(detail.account.id, {
      status
    });

    if (!account) {
      throw new NotFoundException('线索不存在');
    }

    const event = await this.accountRepository.createTimelineEvent({
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

  /** Reuse global email verification results within the cooldown window. */
  private async verifyEmailWithCache(email: string, context: CrmUserContext): Promise<EmailVerificationResult> {
    const emailHash = hashEmail(email);
    const now = new Date();
    const [cached, globalConfig] = await Promise.all([
      this.accountRepository.findEmailVerificationCache({ emailHash }),
      this.settingsRepository.getGlobalConfig()
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

    await this.accountRepository.upsertEmailVerificationCache({
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

    return this.accountRepository.findArchivedFingerprints({
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

    await this.accountRepository.createTimelineEvent({
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

    await Promise.all(fingerprints.map(fingerprint => this.accountRepository.upsertArchivedFingerprint(fingerprint)));
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
        status: isNoMxDnsError(error) ? 'invalid' : 'unreachable',
        domain: parsedEmail.domain,
        reason: isNoMxDnsError(error) ? 'no_mx' : 'dns_temporary_failure'
      };
    }
  }

  private async requireScopedAccountDetail(id: string, context: CrmUserContext) {
    const detail = await this.accountRepository.getAccountDetail({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!detail) {
      throw new NotFoundException('线索不存在');
    }

    return detail;
  }
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

function isPastArchiveRecoveryWindow(archivedAt: Date, now = new Date()) {
  return now.getTime() - archivedAt.getTime() > accountArchiveRecoveryDays * 24 * 60 * 60 * 1000;
}

function normalizeUniqueDomains(values: string[]) {
  return Array.from(new Set(values.flatMap(value => {
    const domain = normalizeCrmDomain(value);

    return domain ? [domain] : [];
  })));
}

function normalizeUniqueNames(values: string[]) {
  return Array.from(new Set(values.map(value => normalizeCrmName(value)).filter(Boolean)));
}
