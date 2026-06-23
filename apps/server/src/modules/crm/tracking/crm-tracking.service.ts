import { Inject, Injectable, Optional } from '@nestjs/common';
import { SystemNotificationService } from '../../system-notification/system-notification.service';
import { CRM_TRACKING_REPOSITORY } from '../crm.tokens';
import type { CrmEmailOpenRecordResult, CrmTrackingRepository } from './crm-tracking.types';

export interface CrmEmailOpenInput {
  messageId: string;
  openedAt?: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class CrmTrackingService {
  constructor(
    @Inject(CRM_TRACKING_REPOSITORY) private readonly repository: CrmTrackingRepository,
    @Optional()
    @Inject(SystemNotificationService)
    private readonly systemNotificationService?: SystemNotificationService
  ) {}

  /** Records one tracked email open and notifies the owner on the first open only. */
  async recordEmailOpen(input: CrmEmailOpenInput): Promise<CrmEmailOpenRecordResult | null> {
    const target = await this.repository.findEmailOpenTargetByMessageId(input.messageId);

    if (!target || target.message.status !== 'sent') {
      return null;
    }

    const result = await this.repository.recordEmailOpen({
      target,
      openedAt: input.openedAt ?? new Date(),
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null
    });

    if (!result.isFirstOpen) {
      return result;
    }

    await this.repository.createTimelineEvent({
      organizationId: target.message.organizationId,
      ownerUserId: target.message.ownerUserId,
      accountId: target.message.accountId,
      contactId: target.message.contactId,
      eventType: 'email_opened',
      title: '客户可能打开了开发信',
      content: `${target.account.name} 的联系人 ${formatContactName(target.contact)} 可能打开了开发信。`,
      metadata: {
        eventId: result.event.id,
        messageId: target.message.id,
        enrollmentId: target.message.enrollmentId,
        openedAt: result.event.firstOpenedAt.toISOString(),
        signal: 'email_open'
      }
    });

    await this.systemNotificationService?.create({
      userId: target.message.ownerUserId,
      userName: target.mailbox?.ownerUserName ?? target.enrollment.createdByName,
      module: 'crm',
      type: 'crm_email_opened',
      title: '客户可能打开了开发信',
      content: `${target.account.name} 的联系人 ${formatContactName(target.contact)} 可能打开了开发信。`,
      targetType: 'crmMessage',
      targetId: target.message.id,
      routePath: buildEmailOpenRoutePath(target.message.enrollmentId, target.message.id, result.event.id),
      metadata: {
        organizationId: target.message.organizationId,
        accountId: target.message.accountId,
        contactId: target.message.contactId,
        enrollmentId: target.message.enrollmentId,
        messageId: target.message.id,
        trackingEventId: result.event.id,
        openedAt: result.event.firstOpenedAt.toISOString()
      }
    });

    return result;
  }
}

function buildEmailOpenRoutePath(enrollmentId: string, messageId: string, eventId: string) {
  const params = new URLSearchParams({
    focus: 'tracking-open',
    enrollmentId,
    messageId,
    eventId
  });

  return `/crm/email-sequences?${params.toString()}`;
}

function formatContactName(contact: { fullName: string | null; maskedEmail: string }) {
  return contact.fullName || contact.maskedEmail;
}
