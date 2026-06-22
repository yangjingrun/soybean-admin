import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import type { CrmGmailOAuthFlowPort } from '../crm-gmail-oauth-flow';
import { CrmGmailWatchService } from '../crm-gmail-watch.service';
import { CRM_GMAIL_OAUTH_FLOW, CRM_MAILBOX_REPOSITORY } from '../crm.tokens';
import type { CrmMailboxProvider, CrmMailboxRecord, CrmMailboxStatus, CrmUserContext } from '../crm.types';
import { hashEmail, maskEmail } from '../shared/crm-email-utils';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import { toMailboxView } from '../shared/crm-view-mappers';
import type { CrmMailboxRepository } from './crm-mailbox.repository';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const gmailProvider: CrmMailboxProvider = 'gmail';
const defaultMailboxDailyLimit = 50;
const defaultMailboxHourlyLimit = 10;

interface GmailOAuthCompleteInput {
  code: string;
  state: string;
}

@Injectable()
export class CrmMailboxService {
  constructor(
    @Inject(CRM_MAILBOX_REPOSITORY) private readonly mailboxRepository: CrmMailboxRepository,
    @Optional()
    @Inject(CRM_GMAIL_OAUTH_FLOW)
    private readonly gmailOAuthFlow?: CrmGmailOAuthFlowPort | null,
    @Optional()
    @Inject(CrmGmailWatchService)
    private readonly gmailWatchService?: Pick<CrmGmailWatchService, 'renewMailboxWatch'> | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Create a Gmail mock authorization record without storing any OAuth token. */
  async mockAuthorizeMailbox(input: { emailAddress: string }, context: CrmUserContext) {
    const emailAddress = normalizeMailboxEmail(input.emailAddress);
    const emailHash = hashEmail(emailAddress);
    const existingMailbox = await this.mailboxRepository.findMailboxByProviderAndEmailHash(gmailProvider, emailHash);

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

    const mailbox = await this.mailboxRepository.createMailbox({
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

  /** Create a Google consent URL for the current user mailbox authorization flow. */
  createGmailOAuthAuthorizationUrl(context: CrmUserContext) {
    return this.requireGmailOAuthFlow().createAuthorizationUrl({
      organizationId: context.organizationId,
      userId: context.userId
    });
  }

  /** Complete Gmail OAuth authorization and store the encrypted refresh token for the mailbox owner. */
  async completeGmailOAuthAuthorization(input: GmailOAuthCompleteInput, context: CrmUserContext) {
    const flow = this.requireGmailOAuthFlow();
    flow.verifyState(input.state, {
      organizationId: context.organizationId,
      userId: context.userId
    });

    const gmailMailbox = await flow.exchangeCodeForMailbox(input.code);
    const emailAddress = normalizeMailboxEmail(gmailMailbox.emailAddress);
    const emailHash = hashEmail(emailAddress);
    const existingMailbox = await this.mailboxRepository.findMailboxByProviderAndEmailHash(gmailProvider, emailHash);

    if (existingMailbox) {
      if (!isOwnedMailbox(existingMailbox, context)) {
        throw new BadRequestException('该 Gmail 地址已绑定');
      }

      const updatedMailbox = await this.mailboxRepository.updateMailbox(existingMailbox.id, {
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

    const mailbox = await this.mailboxRepository.createMailbox({
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

  /** List mailboxes within the current organization and apply member ownership isolation. */
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
    const result = await this.mailboxRepository.listMailboxes({
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
      records: result.records.map(toMailboxView)
    });
  }

  /** Pause a scoped mailbox after verifying the current user can read it. */
  async pauseMailbox(id: string, context: CrmUserContext) {
    return this.changeMailboxStatus(id, 'paused', new Date(), 'mailbox-pause', 'CRM 邮箱暂停', context);
  }

  /** Resume a scoped mailbox after verifying the current user can read it. */
  async resumeMailbox(id: string, context: CrmUserContext) {
    return this.changeMailboxStatus(id, 'active', null, 'mailbox-resume', 'CRM 邮箱恢复', context);
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
    const mailbox = await this.mailboxRepository.updateMailbox(currentMailbox.id, {
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
    const mailbox = await this.mailboxRepository.findMailboxById({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
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

  private recordMailboxLog(
    action: string,
    message: string,
    context: CrmUserContext,
    mailbox: CrmMailboxRecord,
    fromStatus: CrmMailboxStatus | null,
    toStatus: CrmMailboxStatus
  ) {
    return this.crmLogger?.record(action, message, context, {
      organizationId: mailbox.organizationId,
      mailboxId: mailbox.id,
      provider: mailbox.provider,
      maskedEmail: mailbox.maskedEmail,
      fromStatus,
      toStatus
    });
  }
}

function normalizeMailboxEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = /^([^+@\s]+)@gmail\.com$/.exec(normalized);

  if (!match) {
    throw new BadRequestException('第一版仅支持 Gmail 地址，且不支持 alias');
  }

  return normalized;
}

function isOwnedMailbox(mailbox: Pick<CrmMailboxRecord, 'organizationId' | 'ownerUserId'>, context: CrmUserContext) {
  return mailbox.organizationId === context.organizationId && mailbox.ownerUserId === context.userId;
}
