import dayjs from 'dayjs';

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
export function buildInboxPendingCountParams(filterModel: Api.Crm.InboxThreadFilterModel): Api.Crm.InboxThreadSearchParams {
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
