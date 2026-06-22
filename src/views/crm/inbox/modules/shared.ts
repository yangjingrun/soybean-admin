import dayjs from 'dayjs';

type InboxMessageType = Api.Crm.InboxMessageRecord['messageType'];

export interface InboxReplyDraftMetadataItem {
  key: string;
  label: string;
  value: string;
}

export interface InboxReplyPolishSnapshot {
  bodyText: string;
  threadId: string;
  topic: string;
}

export type InboxReplySubmitPayloadResult =
  | {
      ok: true;
      payload: Api.Crm.InboxReplyPayload;
    }
  | {
      ok: false;
      message: string;
    };

export const inboxThreadStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已处理', value: 'handled' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.InboxThreadStatus }>;

export const inboxThreadStatusLabelMap: Record<Api.Crm.InboxThreadStatus, string> = {
  pending: '待处理',
  handled: '已处理',
  archived: '已归档'
};

export const inboxThreadStatusTagTypeMap: Record<Api.Crm.InboxThreadStatus, NaiveUI.ThemeColor> = {
  pending: 'warning',
  handled: 'success',
  archived: 'default'
};

export const inboxMessageDirectionLabelMap: Record<Api.Crm.InboxMessageDirection, string> = {
  inbound: '客户回复',
  outbound: '已发送'
};

export const inboxMessageDirectionTagTypeMap: Record<Api.Crm.InboxMessageDirection, NaiveUI.ThemeColor> = {
  inbound: 'info',
  outbound: 'default'
};

export const inboxMessageTypeLabelMap: Record<InboxMessageType, string> = {
  customer_reply: '客户回复',
  bounce: '退信',
  unsubscribe_hint: '退订/拒绝',
  unsubscribe_review_pending: '疑似退订'
};

export const inboxMessageTypeTagTypeMap: Record<InboxMessageType, NaiveUI.ThemeColor> = {
  customer_reply: 'info',
  bounce: 'error',
  unsubscribe_hint: 'warning',
  unsubscribe_review_pending: 'warning'
};

/** Create the default inbox filter object for initial load and reset. */
export function createDefaultInboxFilterModel(): Api.Crm.InboxThreadFilterModel {
  return {
    keyword: '',
    status: null,
    mailboxId: null
  };
}

/** Build inbox thread list query params from pagination and current filters. */
export function buildInboxThreadSearchParams(options: {
  current: number;
  filterModel: Api.Crm.InboxThreadFilterModel;
  size: number;
}): Api.Crm.InboxThreadSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.InboxThreadSearchParams = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();

  if (keyword) {
    params.keyword = keyword;
  }

  if (filterModel.status) {
    params.status = filterModel.status;
  }

  if (filterModel.mailboxId) {
    params.mailboxId = filterModel.mailboxId;
  }

  return params;
}

/** Build a lightweight pending-count query tied to the current mailbox filter. */
export function buildInboxPendingCountParams(
  filterModel: Api.Crm.InboxThreadFilterModel
): Api.Crm.InboxThreadSearchParams {
  const params: Api.Crm.InboxThreadSearchParams = {
    current: 1,
    size: 1,
    status: 'pending'
  };

  if (filterModel.mailboxId) {
    params.mailboxId = filterModel.mailboxId;
  }

  return params;
}

/** Validate a real inbox reply send request and build the backend payload. */
export function buildInboxReplySubmitPayload(options: {
  bodyText: string;
  canOperate: boolean;
  topic: string;
}): InboxReplySubmitPayloadResult {
  const topic = options.topic.trim();
  const bodyText = options.bodyText.trim();

  if (!options.canOperate) {
    return { ok: false, message: '当前账号不可发送该回复' };
  }

  if (!topic) {
    return { ok: false, message: '请先填写回复主题或要点' };
  }

  if (!bodyText) {
    return { ok: false, message: '回复正文不能为空' };
  }

  return {
    ok: true,
    payload: { bodyText }
  };
}

/** Create a local undo point before AI polish overwrites the editable draft fields. */
export function createInboxReplyPolishSnapshot(options: InboxReplyPolishSnapshot): InboxReplyPolishSnapshot {
  return {
    threadId: options.threadId,
    topic: options.topic,
    bodyText: options.bodyText
  };
}

/** Keep AI polish undo scoped to the thread that created the snapshot. */
export function canRestoreInboxReplyPolishSnapshot(snapshot: InboxReplyPolishSnapshot | null, threadId: string | null) {
  return Boolean(snapshot && threadId && snapshot.threadId === threadId);
}

/** Format backend ISO datetime for inbox surfaces. */
export function formatInboxDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

/** Format optional backend text for compact descriptions. */
export function formatInboxText(value: string | null | undefined) {
  return value || '-';
}

/** Use received time for inbound messages and sent time for outbound messages. */
export function formatInboxMessageTime(message: Api.Crm.InboxMessageRecord) {
  return formatInboxDate(message.receivedAt || message.sentAt || message.createdAt);
}

/** Find the latest inbound message that still needs unsubscribe confirmation. */
export function findPendingUnsubscribeReviewMessage(messages: Api.Crm.InboxMessageRecord[]) {
  return (
    messages
      .toReversed()
      .find(message => message.direction === 'inbound' && message.messageType === 'unsubscribe_review_pending') ?? null
  );
}

/** Build compact AI reply draft metadata rows for the drawer. */
export function buildInboxReplyDraftMetadataItems(
  metadata: Api.Crm.InboxReplyDraftMetadata | null | undefined
): InboxReplyDraftMetadataItem[] {
  if (!metadata) {
    return [];
  }

  const items: InboxReplyDraftMetadataItem[] = [];
  const reason = metadata.reason.trim();

  if (reason) {
    items.push({
      key: 'reason',
      label: '润色说明',
      value: reason
    });
  }

  metadata.riskNotes
    .map(note => note.trim())
    .filter(Boolean)
    .forEach((note, index) => {
      items.push({
        key: `risk-${index}`,
        label: `风险提示 ${index + 1}`,
        value: note
      });
    });

  if (metadata.productLineName?.trim()) {
    items.push({
      key: 'product-line',
      label: '产品资料',
      value: metadata.productLineName.trim()
    });
  }

  return items;
}
