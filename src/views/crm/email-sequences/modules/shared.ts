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

export const sequenceTodoTypeOptions = [
  { label: '草稿待审', value: 'draft_review_pending' },
  { label: '后续待审', value: 'follow_up_draft_review' },
  { label: '待启动首封', value: 'ready_to_start' },
  { label: '可生成下一封', value: 'can_generate_next' },
  { label: '发送失败', value: 'send_failed' },
  { label: '已到最后一封', value: 'max_steps_reached' }
] satisfies Array<{ label: string; value: Api.Crm.SequenceReviewTodoType }>;

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

export interface SequenceSendAuditSummary {
  label: string;
  description: string;
  failedCheckCount: number;
  failedMessageCount: number;
  passedCheckCount: number;
  tagType: NaiveUI.ThemeColor;
  totalCheckCount: number;
}

export interface SequencePolicyReviewHint {
  key: 'link_policy' | 'auto_send';
  label: string;
  description: string;
  status: string;
  tagType: NaiveUI.ThemeColor;
}

/** Create the default sequence review filter object for initial load and reset. */
export function createDefaultSequenceFilterModel(): Api.Crm.SequenceReviewFilterModel {
  return {
    keyword: '',
    status: null,
    todoType: null
  };
}

/** Create an empty sequence review creation form. The first message is generated immediately; follow-ups are created later. */
export function createDefaultSequenceCreateForm(): Api.Crm.SequenceReviewCreateFormModel {
  return {
    accountId: null,
    contactId: null,
    productLineId: null,
    mailboxId: null,
    policyId: null
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

  if (filterModel.todoType) {
    params.todoType = filterModel.todoType;
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

  if (formModel.policyId) {
    payload.policyId = formModel.policyId;
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

/** Return failed sequence messages ordered by step for audit and retry UX. */
export function getFailedSequenceMessages(messages: Api.Crm.MessageRecord[]) {
  return messages
    .filter(message => message.status === 'failed')
    .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt));
}

/** Return the largest generated message step in one enrollment. */
export function getMaxSequenceMessageStep(messages: Api.Crm.MessageRecord[]) {
  return messages.reduce((maxStep, message) => Math.max(maxStep, message.stepIndex), 0);
}

/** Check whether the current enrollment can create one local follow-up draft. */
export function canGenerateNextSequenceDraft(item: Api.Crm.SequenceReviewItem) {
  const canAppendDraftByStatus = ['ready_to_send', 'sequence_running'].includes(item.enrollment.status);
  const hasPendingReviewDraft = item.messages.some(message => message.status === 'draft_pending_review');

  return (
    item.canOperateDraft &&
    canAppendDraftByStatus &&
    !hasPendingReviewDraft &&
    getMaxSequenceMessageStep(item.messages) < item.enrollment.totalSteps
  );
}

/** Build strategy hints for the draft review drawer. */
export function buildSequencePolicyReviewHints(
  item: Api.Crm.SequenceReviewItem,
  message: Api.Crm.MessageRecord | null
): SequencePolicyReviewHint[] {
  if (!item.policy) return [];

  const hasLink = Boolean(message && containsLink(`${message.subject}\n${message.bodyText}`));
  const linkHint: SequencePolicyReviewHint =
    item.policy.linkPolicy === 'block_new_links'
      ? {
          key: 'link_policy',
          label: '链接策略',
          description: hasLink
            ? '策略要求阻止新增链接，当前草稿仍包含链接，请删掉后再确认'
            : '策略要求阻止新增链接，当前草稿未检测到链接',
          status: hasLink ? '需复核' : '已符合',
          tagType: hasLink ? 'warning' : 'success'
        }
      : {
          key: 'link_policy',
          label: '链接策略',
          description: '允许保留模板中已有链接，审核时确认链接仍有效',
          status: '允许',
          tagType: 'info'
        };
  const autoSendHint: SequencePolicyReviewHint = item.policy.allowLowRiskAutoSend
    ? {
        key: 'auto_send',
        label: '自动发送',
        description: '策略允许低风险自动发送；当前本地链路仍先进入人工审核',
        status: '允许',
        tagType: 'info'
      }
    : {
        key: 'auto_send',
        label: '自动发送',
        description: '策略未开启低风险自动发送，草稿只能人工确认',
        status: '人工',
        tagType: 'default'
      };

  return [linkHint, autoSendHint];
}

/** Pick the message that best represents the row's current operational state. */
export function getCurrentSequenceMessage(item: Api.Crm.SequenceReviewItem) {
  return (
    getPendingReviewMessage(item.messages) ??
    getFailedSequenceMessages(item.messages)[0] ??
    getNextScheduledReviewMessage(item.messages) ??
    item.messages.find(message => message.stepIndex === item.enrollment.currentStep) ??
    item.firstMessage
  );
}

function containsLink(text: string) {
  return /\b(?:https?:\/\/|www\.)\S+/i.test(text);
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

/** Build a compact send-audit summary for table rows and drawer panels. */
export function getSequenceSendAuditSummary(item: Api.Crm.SequenceReviewItem): SequenceSendAuditSummary {
  const checklist = getSequenceChecklistSummary(item);
  const failedMessages = getFailedSequenceMessages(item.messages);

  if (failedMessages.length > 0) {
    return {
      label: '发送失败',
      description: `第 ${failedMessages.map(message => message.stepIndex).join('、')} 封发送失败，当前仅支持查看状态`,
      failedCheckCount: checklist.failedCount,
      failedMessageCount: failedMessages.length,
      passedCheckCount: checklist.passedCount,
      tagType: 'error',
      totalCheckCount: checklist.total
    };
  }

  if (checklist.failedCount > 0) {
    return {
      label: `${checklist.failedCount} 项待确认`,
      description: '发送前审核未全部通过，请先确认预警项',
      failedCheckCount: checklist.failedCount,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'warning',
      totalCheckCount: checklist.total
    };
  }

  if (checklist.total > 0) {
    return {
      label: `${checklist.total} 项通过`,
      description: '发送前审核已通过，可继续处理当前邮件',
      failedCheckCount: 0,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'success',
      totalCheckCount: checklist.total
    };
  }

  return {
    label: '待补充检查',
    description: '暂无发送前审核项',
    failedCheckCount: 0,
    failedMessageCount: 0,
    passedCheckCount: 0,
    tagType: 'default',
    totalCheckCount: 0
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

  if (canGenerateNextSequenceDraft(item)) {
    return {
      label: '生成下一封',
      description: `已生成到第 ${getMaxSequenceMessageStep(item.messages)} 封，可继续生成后续草稿`,
      buttonLabel: '生成',
      tagType: 'success'
    };
  }

  if (getMaxSequenceMessageStep(item.messages) >= item.enrollment.totalSteps) {
    return {
      label: '已到最后一封',
      description: '全部步骤已生成，等待发送或回复结果',
      buttonLabel: '查看',
      tagType: 'default'
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
export function getSequenceProgressText(
  progress: Pick<Api.Crm.SequenceEnrollmentRecord, 'currentStep' | 'totalSteps'>
) {
  return `第 ${progress.currentStep} / ${progress.totalSteps} 封`;
}
