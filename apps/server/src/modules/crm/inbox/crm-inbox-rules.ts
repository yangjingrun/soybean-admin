import { BadRequestException } from '@nestjs/common';
import type {
  CrmAccountRecord,
  CrmContactRecord,
  CrmInboxMessageRecord,
  CrmInboxMessageType,
  CrmInboxThreadDetailRecord,
  CrmInboxThreadStatus
} from '../crm.types';
import { normalizeNullableString } from '../shared/crm-normalizers';

export const inboxNotificationTargetType = 'crmInboxThread';

/** Parse an optional inbox timestamp and keep invalid user input visible. */
export function parseOptionalInboxDate(value?: string | null) {
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

/** Resolve the CRM account status implied by a manual inbox status change. */
export function resolveInboxAccountStatus(status: CrmInboxThreadStatus) {
  if (status === 'handled') return 'followed_up';
  if (status === 'pending') return 'replied_pending';

  return undefined;
}

/** Find the newest inbound message by comparing sender hash against the bound mailbox. */
export function getLatestInboundInboxMessage(detail: CrmInboxThreadDetailRecord): CrmInboxMessageRecord | null {
  const messages = detail.mailbox
    ? detail.messages.filter(message => message.fromEmailHash !== detail.mailbox?.emailHash)
    : detail.messages;

  return messages.at(-1) ?? null;
}

/** Build the station notification copy for a newly ingested inbox message. */
export function toInboxNotificationCopy(
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
