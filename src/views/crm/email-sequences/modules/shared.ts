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

export interface DraftReviewSavePayload {
  messageId: string;
  draft: Api.Crm.MessageDraftPayload;
}

export interface DraftReviewApprovePayload {
  messageId: string;
}

export interface SequenceNextActionView {
  label: string;
  description: string;
  buttonLabel: string;
  tagType: NaiveUI.ThemeColor;
}

/** Create the default sequence review filter object for initial load and reset. */
export function createDefaultSequenceFilterModel(): Api.Crm.SequenceReviewFilterModel {
  return {
    keyword: '',
    status: null
  };
}

/** Create an empty sequence review creation form. The first message is generated immediately; follow-ups are created later. */
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

/** Build the save event payload from the currently selected draft. */
export function buildDraftReviewOperationPayload(
  messageId: string,
  draft: Api.Crm.MessageDraftPayload
): DraftReviewSavePayload {
  return {
    messageId,
    draft: {
      subject: draft.subject.trim(),
      bodyText: draft.bodyText.trim()
    }
  };
}

/** Return the current pending review message ordered by sequence step. */
export function getPendingReviewMessage(messages: Api.Crm.MessageRecord[]) {
  return [...messages]
    .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt))
    .find(message => message.status === 'draft_pending_review');
}

/** Return the nearest scheduled message that still needs review or sending. */
export function getNextScheduledReviewMessage(messages: Api.Crm.MessageRecord[]) {
  return messages
    .filter(message => ['draft_pending_review', 'queued'].includes(message.status) && message.scheduledAt)
    .sort((left, right) => left.scheduledAt!.localeCompare(right.scheduledAt!))[0];
}

/** Pick the message that best represents the row's current operational state. */
export function getCurrentSequenceMessage(item: Api.Crm.SequenceReviewItem) {
  return (
    getPendingReviewMessage(item.messages) ??
    item.messages.find(message => message.status === 'failed') ??
    getNextScheduledReviewMessage(item.messages) ??
    item.messages.find(message => message.stepIndex === item.enrollment.currentStep) ??
    item.firstMessage
  );
}

/** Summarize the row checklist for dense table scanning. */
export function getSequenceChecklistSummary(item: Api.Crm.SequenceReviewItem) {
  const failedCount = item.checklist.filter(check => !check.passed).length;

  return {
    failedCount,
    passedCount: item.checklist.length - failedCount,
    total: item.checklist.length
  };
}

/** Describe the next expected user or system action for one sequence row. */
export function getSequenceNextAction(item: Api.Crm.SequenceReviewItem): SequenceNextActionView {
  const currentMessage = getCurrentSequenceMessage(item);

  if (currentMessage?.status === 'draft_pending_review') {
    return {
      label: '审核草稿',
      description: `第 ${currentMessage.stepIndex} 封待人工确认`,
      buttonLabel: '审核',
      tagType: 'warning'
    };
  }

  if (item.enrollment.status === 'ready_to_send' && item.firstMessage?.status === 'draft_ready') {
    return {
      label: '启动首封',
      description: '首封已确认，等待进入发送队列',
      buttonLabel: '启动',
      tagType: 'success'
    };
  }

  if (currentMessage?.status === 'failed') {
    return {
      label: '处理失败',
      description: `第 ${currentMessage.stepIndex} 封发送失败`,
      buttonLabel: '查看',
      tagType: 'error'
    };
  }

  if (currentMessage?.status === 'queued') {
    return {
      label: '等待发送',
      description: currentMessage.scheduledAt ? formatSequenceDate(currentMessage.scheduledAt) : '已进入发送队列',
      buttonLabel: '查看',
      tagType: 'info'
    };
  }

  if (item.enrollment.status === 'sequence_running') {
    return {
      label: '运行中',
      description: '等待下一步跟进或客户回复',
      buttonLabel: '查看',
      tagType: 'info'
    };
  }

  if (item.enrollment.status === 'replied') {
    return {
      label: '已回信',
      description: '同公司当前序列已停发',
      buttonLabel: '查看',
      tagType: 'success'
    };
  }

  if (item.enrollment.status === 'stopped') {
    return {
      label: '已停止',
      description: '旧发送任务会自动跳过',
      buttonLabel: '查看',
      tagType: 'default'
    };
  }

  if (item.enrollment.status === 'paused') {
    return {
      label: '已暂停',
      description: '恢复后会创建新的运行版本',
      buttonLabel: '查看',
      tagType: 'warning'
    };
  }

  return {
    label: '查看详情',
    description: sequenceStatusLabelMap[item.enrollment.status],
    buttonLabel: '查看',
    tagType: 'default'
  };
}

/** Format backend sequence progress as a compact table label. */
export function getSequenceProgressText(progress: Pick<Api.Crm.SequenceEnrollmentRecord, 'currentStep' | 'totalSteps'>) {
  return `第 ${progress.currentStep} / ${progress.totalSteps} 封`;
}
