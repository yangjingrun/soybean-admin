import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createPageResult } from '../../../shared/pagination';
import { isSuper } from '../../../shared/permission-policy';
import { SystemLogService } from '../../system-log/system-log.service';
import type { SystemLogRecorder } from '../../system-log/system-log.types';
import { SystemNotificationService } from '../../system-notification/system-notification.service';
import { CrmAiReplyDraftService } from '../crm-ai-reply-draft.service';
import type { CrmAiReplyDraftPromptInput } from '../crm-ai-reply-draft.types';
import { classifyCustomerReplyMessage } from '../crm-inbox-message-classifier';
import {
  CRM_EMAIL_SEND_GATEWAY,
  CRM_INBOX_REPOSITORY,
  CRM_SEQUENCE_DRAFT_REPOSITORY,
  CRM_SETTINGS_REPOSITORY
} from '../crm.tokens';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmEmailSendGateway,
  CrmInboxMessageRecord,
  CrmInboxReplyDraftMetadata,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadRecord,
  CrmInboxThreadStatus,
  CrmProductLineRecord,
  CrmUserContext
} from '../crm.types';
import type { CrmProductLineRepository } from '../product-lines/crm-product-line.repository';
import { CRM_PRODUCT_LINE_REPOSITORY } from '../product-lines/crm-product-line.repository';
import type { CrmDraftRepository } from '../sequence/crm-draft.repository';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import { resolveCrmSenderName } from '../shared/crm-context';
import { CrmLoggerService } from '../shared/crm-logger.service';
import { normalizeLimitedContent, normalizeNullableString, normalizePositiveInteger } from '../shared/crm-normalizers';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import { toAccountView, toTimelineEventView } from '../shared/crm-view-mappers';
import type { CrmInboxRepository } from './crm-inbox.repository';
import {
  getLatestInboundInboxMessage,
  inboxNotificationTargetType,
  parseOptionalInboxDate,
  resolveInboxAccountStatus,
  toInboxNotificationCopy
} from './crm-inbox-rules';
import {
  toInboxReplyIngestView,
  toInboxThreadDetailView,
  toInboxThreadListView,
  toInboxThreadReplyView,
  toInboxThreadView,
  toInboxUnsubscribeConfirmView
} from './crm-inbox-view-mappers';

const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

/** Minimal settings reads needed to render inbox views. */
type CrmInboxSettingsReader = Pick<CrmSettingsRepository, 'getOrganizationConfig'>;

/** Minimal product-line lookup needed for inbox reply drafting. */
type CrmInboxProductLineReader = Pick<CrmProductLineRepository, 'findProductLineById'>;

/** Minimal message lookup needed for reply ingest simulation. */
type CrmInboxMessageReader = Pick<CrmDraftRepository, 'findMessageById'>;

@Injectable()
export class CrmInboxService {
  constructor(
    @Inject(CRM_INBOX_REPOSITORY)
    private readonly inboxRepository: CrmInboxRepository,
    @Inject(CRM_SETTINGS_REPOSITORY)
    private readonly settingsRepository: CrmInboxSettingsReader,
    @Inject(CRM_PRODUCT_LINE_REPOSITORY)
    private readonly productLineRepository: CrmInboxProductLineReader,
    @Inject(CRM_SEQUENCE_DRAFT_REPOSITORY)
    private readonly sequenceRepository: CrmInboxMessageReader,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogRecorder,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService,
    @Optional()
    @Inject(CRM_EMAIL_SEND_GATEWAY)
    private readonly sendGateway?: CrmEmailSendGateway,
    @Optional()
    @Inject(CrmAiReplyDraftService)
    private readonly aiReplyDraftService?: Pick<CrmAiReplyDraftService, 'polishReplyDraft'> | null,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

  /** Lists customer reply inbox threads in the current organization scope. */
  async listInboxThreads(
    context: CrmUserContext,
    query: {
      current?: number | string;
      size?: number | string;
      keyword?: string;
      status?: CrmInboxThreadStatus;
      mailboxId?: string;
      accountId?: string;
      contactId?: string;
    } = {}
  ) {
    const current = normalizePositiveInteger(query.current, defaultPage);
    const size = Math.min(normalizePositiveInteger(query.size, defaultPageSize), maxPageSize);
    const keyword = normalizeNullableString(query.keyword);
    const mailboxId = normalizeNullableString(query.mailboxId);
    const accountId = normalizeNullableString(query.accountId);
    const contactId = normalizeNullableString(query.contactId);
    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);
    const result = await this.inboxRepository.listInboxThreads({
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context),
      ...(keyword ? { keyword } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(mailboxId ? { mailboxId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(contactId ? { contactId } : {}),
      skip: (current - 1) * size,
      take: size
    });

    return createPageResult({
      current,
      size,
      total: result.total,
      records: result.records.map(record => toInboxThreadListView(record, context, organizationConfig))
    });
  }

  /** Returns one customer reply inbox thread with messages and timeline. */
  async getInboxThread(id: string, context: CrmUserContext) {
    const thread = await this.inboxRepository.getInboxThread({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!thread) {
      throw new NotFoundException('收件箱会话不存在');
    }

    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);
    const detail = toInboxThreadDetailView(thread, context, organizationConfig);
    await this.recordSuperAdminInboxBodyAudit(thread, detail.messages.length, context);

    return detail;
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
    const topic = normalizeLimitedContent(input.topic, '回复主题或要点不能为空', 2000);
    const detail = await this.requireOwnedInboxThreadDetail(id, context);

    if (!this.aiReplyDraftService) {
      throw new BadRequestException('AI 回复润色服务未配置');
    }

    const productLine = await this.resolveInboxReplyDraftProductLine(detail, input.productLineId, context);
    const draft = await this.aiReplyDraftService.polishReplyDraft(
      this.buildInboxReplyDraftPromptInput(detail, topic, productLine, context),
      context
    );
    const saved = await this.saveOwnedInboxReplyDraft(detail.thread.id, topic, draft.bodyText, draft.metadata, context);

    await this.recordCrmLog('inbox-reply-draft-ai-polished', 'CRM 收件箱回复草稿已由 AI 润色', context, {
      organizationId: context.organizationId,
      accountId: saved.thread.accountId,
      contactId: saved.thread.contactId,
      threadId: saved.thread.id,
      productLineId: productLine?.id ?? null,
      riskNoteCount: draft.riskNotes.length
    });

    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);

    return toInboxThreadDetailView(saved, context, organizationConfig);
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
    const topic = normalizeLimitedContent(input.topic, '回复主题或要点不能为空', 2000);
    const bodyText = normalizeLimitedContent(input.bodyText, '回复正文不能为空', 10000);
    const detail = await this.requireOwnedInboxThreadDetail(id, context);
    const saved = await this.saveOwnedInboxReplyDraft(detail.thread.id, topic, bodyText, null, context);

    await this.recordCrmLog('inbox-reply-draft-saved', 'CRM 收件箱回复草稿已保存', context, {
      organizationId: context.organizationId,
      accountId: saved.thread.accountId,
      contactId: saved.thread.contactId,
      threadId: saved.thread.id
    });

    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);

    return toInboxThreadDetailView(saved, context, organizationConfig);
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
    const updated = await this.inboxRepository.updateInboxThreadStatus({
      id: currentThread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromStatus: currentThread.status,
      toStatus: input.status,
      accountStatus: resolveInboxAccountStatus(input.status)
    });

    if (!updated) {
      throw new BadRequestException('当前收件箱状态已变化，请刷新后重试');
    }

    if (input.status === 'handled') {
      await this.systemNotificationService?.markTargetReadForUser(
        inboxNotificationTargetType,
        updated.thread.id,
        context.userId
      );
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
    const detail = await this.inboxRepository.getInboxThread({
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
    const replied = await this.inboxRepository.replyInboxThread({
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

    const nextDetail = await this.inboxRepository.getInboxThread({
      id: replied.thread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);

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
    const outboundMessage = await this.sequenceRepository.findMessageById({
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

    const receivedAt = parseOptionalInboxDate(input.receivedAt) ?? new Date();
    const subject = normalizeNullableString(input.subject) ?? `Re: ${outboundMessage.subject}`;
    const bodyText = normalizeLimitedContent(input.bodyText, '回复正文不能为空', 10000);
    const messageType = classifyCustomerReplyMessage(subject, bodyText);
    const ingested = await this.inboxRepository.ingestCustomerReply({
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

    const detail = await this.inboxRepository.getInboxThread({
      id: ingested.thread.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });
    const organizationConfig = await this.settingsRepository.getOrganizationConfig(context.organizationId);

    return detail
      ? toInboxThreadDetailView(detail, context, organizationConfig)
      : toInboxReplyIngestView(ingested, context);
  }

  /** Confirms a weak unsubscribe signal and applies the blacklist transaction for the owner. */
  async confirmInboxMessageUnsubscribe(id: string, context: CrmUserContext) {
    const confirmed = await this.inboxRepository.confirmInboxMessageUnsubscribe({
      messageId: id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      confirmedAt: new Date(),
      confirmedById: context.userId,
      confirmedByName: context.userName
    });

    if (!confirmed) {
      throw new NotFoundException('收件箱消息不存在或不可确认退订');
    }

    await this.systemNotificationService?.markTargetReadForUser(
      inboxNotificationTargetType,
      confirmed.thread.id,
      context.userId
    );
    await this.recordCrmLog('inbox-unsubscribe-confirm', 'CRM 收件箱退订已人工确认', context, {
      organizationId: context.organizationId,
      accountId: confirmed.account.id,
      contactId: confirmed.contact.id,
      threadId: confirmed.thread.id,
      inboxMessageId: confirmed.message.id,
      messageType: confirmed.message.messageType
    });

    return toInboxUnsubscribeConfirmView(confirmed, context);
  }

  private async requireOwnedInboxThread(id: string, context: CrmUserContext) {
    const thread = await this.inboxRepository.getInboxThread({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!thread) {
      throw new NotFoundException('收件箱会话不存在');
    }

    return thread.thread;
  }

  private async requireOwnedInboxThreadDetail(id: string, context: CrmUserContext) {
    const thread = await this.inboxRepository.getInboxThread({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId
    });

    if (!thread) {
      throw new NotFoundException('收件箱会话不存在');
    }

    return thread;
  }

  private async saveOwnedInboxReplyDraft(
    id: string,
    topic: string,
    bodyText: string,
    metadata: CrmInboxReplyDraftMetadata | null,
    context: CrmUserContext
  ) {
    const saved = await this.inboxRepository.saveInboxThreadReplyDraft({
      id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      topic,
      bodyText,
      metadata,
      updatedAt: new Date(),
      updatedById: context.userId,
      updatedByName: context.userName
    });

    if (!saved) {
      throw new NotFoundException('收件箱会话不存在');
    }

    return saved;
  }

  private async resolveInboxReplyDraftProductLine(
    detail: CrmInboxThreadDetailRecord,
    productLineId: string | null | undefined,
    context: CrmUserContext
  ) {
    const normalizedProductLineId = normalizeNullableString(productLineId) ?? detail.enrollment?.productLineId ?? null;

    if (!normalizedProductLineId) {
      return null;
    }

    const productLine = await this.productLineRepository.findProductLineById({
      id: normalizedProductLineId,
      organizationId: context.organizationId
    });

    if (!productLine) {
      throw new BadRequestException('产品线不存在');
    }

    return productLine;
  }

  private buildInboxReplyDraftPromptInput(
    detail: CrmInboxThreadDetailRecord,
    topic: string,
    productLine: CrmProductLineRecord | null,
    context: CrmUserContext
  ): CrmAiReplyDraftPromptInput {
    const latestInboundMessage = getLatestInboundInboxMessage(detail);

    if (!latestInboundMessage) {
      throw new BadRequestException('客户回信不存在');
    }

    const history = detail.messages.slice(-6).map(message => ({
      subject: message.subject,
      bodyText: message.bodyText,
      receivedAt: message.receivedAt.toISOString()
    }));
    return {
      account: {
        name: detail.account.name,
        country: detail.account.country,
        domain: detail.account.domain,
        customerType: detail.account.customerType
      },
      contact: {
        fullName: detail.contact.fullName,
        title: detail.contact.title,
        maskedEmail: detail.contact.maskedEmail
      },
      thread: {
        subject: detail.thread.subject,
        status: detail.thread.status
      },
      latestInboundMessage: {
        subject: latestInboundMessage.subject,
        bodyText: latestInboundMessage.bodyText,
        receivedAt: latestInboundMessage.receivedAt.toISOString()
      },
      history,
      productLine: productLine
        ? {
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
          }
        : null,
      userTopicOrOutline: topic,
      senderName: resolveCrmSenderName(context)
    };
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

  private recordSuperAdminInboxBodyAudit(
    record: CrmInboxThreadDetailRecord,
    visibleMessageCount: number,
    context: CrmUserContext
  ) {
    if (!isSuper(context) || record.thread.ownerUserId === context.userId || visibleMessageCount <= 0) {
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
}
