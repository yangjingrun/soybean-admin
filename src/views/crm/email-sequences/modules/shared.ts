import dayjs from 'dayjs';

export const sequenceStatusOptions = [
  { label: '草稿待审', value: 'draft_review_pending' },
  { label: '待发送', value: 'ready_to_send' },
  { label: '运行中', value: 'sequence_running' },
  { label: '已暂停', value: 'paused' },
  { label: '已停止', value: 'stopped' },
  { label: '已回复', value: 'replied' },
  { label: '已归档', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.SequenceEnrollmentStatus }>;

export const sequenceStatusLabelMap: Record<Api.Crm.SequenceEnrollmentStatus, string> = {
  draft_review_pending: '草稿待审',
  ready_to_send: '待发送',
  sequence_running: '运行中',
  paused: '已暂停',
  stopped: '已停止',
  replied: '已回复',
  archived: '已归档'
};

export const sequenceStatusTagTypeMap: Record<Api.Crm.SequenceEnrollmentStatus, NaiveUI.ThemeColor> = {
  draft_review_pending: 'warning',
  ready_to_send: 'success',
  sequence_running: 'info',
  paused: 'warning',
  stopped: 'default',
  replied: 'success',
  archived: 'default'
};

export const messageStatusLabelMap: Record<Api.Crm.MessageStatus, string> = {
  draft_pending_review: '草稿待审',
  draft_ready: '已确认',
  queued: '队列中',
  sent: '已发送',
  failed: '发送失败',
  skipped: '已跳过'
};

export const messageStatusTagTypeMap: Record<Api.Crm.MessageStatus, NaiveUI.ThemeColor> = {
  draft_pending_review: 'warning',
  draft_ready: 'success',
  queued: 'info',
  sent: 'success',
  failed: 'error',
  skipped: 'default'
};

/** Create the default sequence review filter object for initial load and reset. */
export function createDefaultSequenceFilterModel(): Api.Crm.SequenceReviewFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create an empty first-email review creation form. */
export function createDefaultSequenceCreateForm(): Api.Crm.SequenceReviewCreateFormModel {
  return {
    accountId: null,
    contactId: null,
    productLineId: null,
    mailboxId: null
  };
}

/** Build sequence review list query params from pagination and filters. */
export function buildSequenceReviewSearchParams(options: {
  current: number;
  size: number;
  filterModel: Api.Crm.SequenceReviewFilterModel;
}): Api.Crm.SequenceReviewSearchParams {
  const { current, filterModel, size } = options;
  const params: Api.Crm.SequenceReviewSearchParams = {
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

  return params;
}

/** Convert nullable create form values into backend payload after local validation. */
export function normalizeSequenceCreatePayload(
  formModel: Api.Crm.SequenceReviewCreateFormModel
): Api.Crm.SequenceReviewCreatePayload {
  const payload: Api.Crm.SequenceReviewCreatePayload = {
    accountId: formModel.accountId || '',
    contactId: formModel.contactId || ''
  };

  if (formModel.productLineId) {
    payload.productLineId = formModel.productLineId;
  }

  if (formModel.mailboxId) {
    payload.mailboxId = formModel.mailboxId;
  }

  return payload;
}

export function formatSequenceDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export function formatNullableText(value: string | null | undefined) {
  return value || '-';
}
