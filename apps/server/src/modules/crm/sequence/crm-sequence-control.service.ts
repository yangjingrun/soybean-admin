import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CRM_SEQUENCE_CONTROL_REPOSITORY, CRM_SETTINGS_REPOSITORY } from '../crm.tokens';
import { CrmSendAvailabilityService } from '../crm-send-availability.service';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmMessageRecord,
  CrmMessageStatus,
  CrmUserContext
} from '../crm.types';
import { createCrmOwnerFilter } from '../shared/crm-scope';
import { CrmLoggerService } from '../shared/crm-logger.service';
import {
  toAccountView,
  toMessageView,
  toSequenceEnrollmentView,
  toTimelineEventView
} from '../shared/crm-view-mappers';
import type { CrmSettingsRepository } from '../settings/crm-settings.repository';
import { stoppableSequenceStatuses } from './crm-sequence-control-rules';
import type { CrmSequenceControlRepository } from './crm-sequence-control.repository';
import { resolveCrmSequenceScheduledAt } from './crm-sequence-send-schedule-time';

const approvedDraftStatus: CrmMessageStatus = 'draft_ready';
const recoverableFirstMessageStatuses: CrmMessageStatus[] = ['draft_ready', 'queued', 'failed', 'skipped'];

@Injectable()
export class CrmSequenceControlService {
  constructor(
    @Inject(CRM_SEQUENCE_CONTROL_REPOSITORY)
    private readonly sequenceRepository: CrmSequenceControlRepository,
    @Inject(CRM_SETTINGS_REPOSITORY)
    private readonly settingsRepository: CrmSettingsRepository,
    @Inject(CrmSendAvailabilityService)
    private readonly availabilityService: CrmSendAvailabilityService,
    @Optional()
    @Inject(CrmLoggerService)
    private readonly crmLogger?: CrmLoggerService
  ) {}

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
    const scheduledAt = await this.resolveScheduledAt(item.account, item.mailbox.id);

    const started = await this.sequenceRepository.startFirstMessageSend({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromEnrollmentStatus: 'ready_to_send',
      toEnrollmentStatus: 'sequence_running',
      fromMessageStatus: approvedDraftStatus,
      toMessageStatus: approvedDraftStatus,
      accountStatus: 'sequence_running',
      scheduledAt
    });

    if (!started) {
      throw new BadRequestException('当前序列状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('sequence-send-started', 'CRM 首封开发信已等待发送调度', context, {
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

    const stopped = await this.sequenceRepository.stopSequenceEnrollment({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      fromStatuses: stoppableSequenceStatuses,
      accountStatus: 'paused',
      actorUserId: context.userId
    });

    if (!stopped) {
      throw new BadRequestException('当前序列状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('sequence-stopped', 'CRM 开发信序列已停止', context, {
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

  /** Returns an unsent first message to the editable review state. */
  async returnFirstMessageToEdit(id: string, context: CrmUserContext) {
    const item = await this.requireOwnedSequenceReviewItem(id, context);
    const firstMessage = this.requireFirstMessage(item.firstMessage);

    this.assertFirstMessageUnsent(firstMessage);

    if (!['ready_to_send', 'sequence_running', 'stopped', 'paused'].includes(item.enrollment.status)) {
      throw new BadRequestException('当前开发信状态不能修改');
    }

    const returned = await this.sequenceRepository.returnFirstMessageToEdit({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromEnrollmentStatuses: ['ready_to_send', 'sequence_running', 'stopped', 'paused'],
      fromMessageStatuses: recoverableFirstMessageStatuses,
      accountStatus: 'ready'
    });

    if (!returned) {
      throw new BadRequestException('当前开发信状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('sequence-return-to-edit', 'CRM 首封开发信已退回修改', context, {
      organizationId: context.organizationId,
      accountId: returned.account.id,
      contactId: returned.enrollment.contactId,
      enrollmentId: returned.enrollment.id,
      messageId: returned.message.id,
      fromStatus: item.enrollment.status,
      runVersion: returned.enrollment.runVersion
    });

    return {
      enrollment: toSequenceEnrollmentView(returned.enrollment),
      message: toMessageView(returned.message),
      account: toAccountView(returned.account),
      event: toTimelineEventView(returned.event)
    };
  }

  /** Restores a stopped sequence without resending messages that already went out. */
  async resumeSequenceEnrollment(id: string, context: CrmUserContext) {
    const item = await this.requireOwnedSequenceReviewItem(id, context);

    if (item.enrollment.status !== 'stopped') {
      throw new BadRequestException('只有已停止的开发信任务可以恢复');
    }

    await this.assertContactNotBlacklisted(item.contact, context);

    const firstMessageSent = Boolean(item.firstMessage && isSentMessage(item.firstMessage));
    const resumed = await this.sequenceRepository.resumeSequenceEnrollment({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromEnrollmentStatus: 'stopped',
      toEnrollmentStatus: firstMessageSent ? 'sequence_running' : 'ready_to_send',
      fromMessageStatuses: recoverableFirstMessageStatuses,
      toMessageStatus: approvedDraftStatus,
      accountStatus: firstMessageSent ? 'sequence_running' : 'ready'
    });

    if (!resumed) {
      throw new BadRequestException('当前开发信状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('sequence-resumed', 'CRM 开发信任务已恢复', context, {
      organizationId: context.organizationId,
      accountId: resumed.account.id,
      contactId: resumed.enrollment.contactId,
      enrollmentId: resumed.enrollment.id,
      messageId: resumed.message?.id ?? item.firstMessage?.id ?? null,
      firstMessageSent,
      runVersion: resumed.enrollment.runVersion
    });

    return {
      enrollment: toSequenceEnrollmentView(resumed.enrollment),
      message: resumed.message ? toMessageView(resumed.message) : null,
      account: toAccountView(resumed.account),
      event: toTimelineEventView(resumed.event)
    };
  }

  /** Retries an unsent first message by sending it back to the local scheduling pool. */
  async retryFirstMessageSend(id: string, context: CrmUserContext) {
    const item = await this.requireOwnedSequenceReviewItem(id, context);
    const firstMessage = this.requireFirstMessage(item.firstMessage);

    this.assertFirstMessageUnsent(firstMessage);

    if (!['ready_to_send', 'stopped', 'paused'].includes(item.enrollment.status)) {
      throw new BadRequestException('当前开发信状态不能直接重试');
    }

    if (!item.mailbox) {
      throw new BadRequestException('请先选择发送邮箱');
    }

    if (item.mailbox.status !== 'active') {
      throw new BadRequestException('发送邮箱未启用');
    }

    await this.assertContactNotBlacklisted(item.contact, context);
    const scheduledAt = await this.resolveScheduledAt(item.account, item.mailbox.id);

    const retried = await this.sequenceRepository.retryFirstMessageSend({
      enrollmentId: item.enrollment.id,
      organizationId: context.organizationId,
      ownerUserId: context.userId,
      fromEnrollmentStatuses: ['ready_to_send', 'stopped', 'paused'],
      fromMessageStatuses: recoverableFirstMessageStatuses,
      accountStatus: 'sequence_running',
      scheduledAt
    });

    if (!retried) {
      throw new BadRequestException('当前开发信状态已变化，请刷新后重试');
    }

    await this.crmLogger?.record('sequence-send-retry', 'CRM 首封开发信已重新等待发送调度', context, {
      organizationId: context.organizationId,
      accountId: retried.account.id,
      contactId: retried.contact.id,
      enrollmentId: retried.enrollment.id,
      messageId: retried.message.id,
      mailboxId: retried.mailbox.id,
      fromStatus: item.enrollment.status,
      runVersion: retried.enrollment.runVersion
    });

    return {
      enrollment: toSequenceEnrollmentView(retried.enrollment),
      message: toMessageView(retried.message),
      account: toAccountView(retried.account),
      event: toTimelineEventView(retried.event)
    };
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

  private async requireScopedSequenceReviewItem(id: string, context: CrmUserContext) {
    const item = await this.sequenceRepository.getSequenceReviewItem({
      id,
      organizationId: context.organizationId,
      ...createCrmOwnerFilter(context)
    });

    if (!item) {
      throw new NotFoundException('邮件序列不存在');
    }

    return item;
  }

  private async assertContactNotBlacklisted(contact: CrmContactRecord, context: CrmUserContext) {
    const blacklistEntry = await this.sequenceRepository.findBlacklistEntry({
      organizationId: context.organizationId,
      emailHash: contact.emailHash
    });

    if (blacklistEntry) {
      throw new BadRequestException('该邮箱已在组织黑名单中，不能继续开发');
    }
  }

  private requireFirstMessage(message: CrmMessageRecord | null) {
    if (!message || message.stepIndex !== 1) {
      throw new BadRequestException('首封开发信不存在');
    }

    return message;
  }

  private async resolveScheduledAt(
    itemAccount: Pick<CrmAccountRecord, 'organizationId' | 'country' | 'city' | 'timeZone'>,
    mailboxId: string
  ) {
    const [globalConfig, mailboxScheduleTimes] = await Promise.all([
      this.settingsRepository.getGlobalConfig(),
      this.sequenceRepository.listMailboxSendScheduleTimes({
        organizationId: itemAccount.organizationId,
        mailboxId
      })
    ]);

    return resolveCrmSequenceScheduledAt({
      availabilityService: this.availabilityService,
      account: itemAccount,
      globalConfig,
      mailboxScheduleTimes
    });
  }

  private assertFirstMessageUnsent(message: CrmMessageRecord) {
    if (isSentMessage(message)) {
      throw new BadRequestException('这封开发信已经发出，不能再修改或重复发送');
    }
  }
}

function isSentMessage(message: { status: CrmMessageStatus; sentAt: Date | null; providerMessageId: string | null }) {
  return message.status === 'sent' || Boolean(message.sentAt || message.providerMessageId);
}
