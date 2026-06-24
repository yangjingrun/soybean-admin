import dayjs from 'dayjs';
export const inboxThreadStatusOptions = [
  { label: '待处理回信', value: 'pending' },
  { label: '已处理', value: 'handled' },
  { label: '已忽略', value: 'archived' }
];
export const inboxPageGuide = {
  title: '客户回信承接开发信结果',
  description: '优先处理待处理回信；确认拒绝或退订会加入不再联系名单，暂不处理的回信可标记为已忽略。'
};
export const inboxThreadStatusLabelMap = {
  pending: '待处理回信',
  handled: '已处理',
  archived: '已忽略'
};
export const inboxThreadStatusTagTypeMap = {
  pending: 'warning',
  handled: 'success',
  archived: 'default'
};
export const inboxMessageDirectionLabelMap = {
  inbound: '客户回复',
  outbound: '已发送'
};
export const inboxMessageDirectionTagTypeMap = {
  inbound: 'info',
  outbound: 'default'
};
export const inboxMessageTypeLabelMap = {
  customer_reply: '客户回复',
  bounce: '退信',
  unsubscribe_hint: '客户拒绝/退订',
  unsubscribe_review_pending: '疑似拒绝/退订'
};
export const inboxMessageTypeTagTypeMap = {
  customer_reply: 'info',
  bounce: 'error',
  unsubscribe_hint: 'warning',
  unsubscribe_review_pending: 'warning'
};
const inboxHtmlEntityMap = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#47;': '/'
};
/** Create the default inbox filter object for initial load and reset. */
export function createDefaultInboxFilterModel() {
  return {
    keyword: '',
    status: null,
    mailboxId: null
  };
}
/** Build inbox thread list query params from pagination and current filters. */
export function buildInboxThreadSearchParams(options) {
  const { current, filterModel, size } = options;
  const params = {
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
export function buildInboxPendingCountParams(filterModel) {
  const params = {
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
export function buildInboxReplySubmitPayload(options) {
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
export function createInboxReplyPolishSnapshot(options) {
  return {
    threadId: options.threadId,
    topic: options.topic,
    bodyText: options.bodyText
  };
}
/** Keep AI polish undo scoped to the thread that created the snapshot. */
export function canRestoreInboxReplyPolishSnapshot(snapshot, threadId) {
  return Boolean(snapshot && threadId && snapshot.threadId === threadId);
}
/** Format backend ISO datetime for inbox surfaces. */
export function formatInboxDate(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}
/** Format optional backend text for compact descriptions. */
export function formatInboxText(value) {
  return value || '-';
}
/** Decode common HTML entities from stored email text before showing it in the drawer. */
function decodeInboxHtmlEntities(value) {
  let decoded = value;
  // Some quoted raw emails arrive double-escaped, so decode a small fixed number of passes.
  for (let index = 0; index < 2; index += 1) {
    const nextValue = decoded
      .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&#x2F;|&#47;/g, token => inboxHtmlEntityMap[token] ?? token)
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
    if (nextValue === decoded) {
      return nextValue;
    }
    decoded = nextValue;
  }
  return decoded;
}
/** Normalize email body spacing so quoted content stays readable in the timeline card. */
export function formatInboxMessageBody(value) {
  return decodeInboxHtmlEntities(value)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
/** Use received time for inbound messages and sent time for outbound messages. */
export function formatInboxMessageTime(message) {
  return formatInboxDate(message.receivedAt || message.sentAt || message.createdAt);
}
/** Only special inbound types need an extra type tag; normal customer replies already have the direction tag. */
export function shouldShowInboxMessageTypeTag(message) {
  return message.direction === 'inbound' && message.messageType !== 'customer_reply';
}
/** Find the latest inbound message that still needs unsubscribe confirmation. */
export function findPendingUnsubscribeReviewMessage(messages) {
  return (
    messages
      .toReversed()
      .find(message => message.direction === 'inbound' && message.messageType === 'unsubscribe_review_pending') ?? null
  );
}
/** Build compact AI reply draft metadata rows for the drawer. */
export function buildInboxReplyDraftMetadataItems(metadata) {
  if (!metadata) {
    return [];
  }
  const items = [];
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
