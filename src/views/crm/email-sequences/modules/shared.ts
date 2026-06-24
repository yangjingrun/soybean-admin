import dayjs from 'dayjs';
import type { InjectionKey, Ref } from 'vue';

export const sequenceStatusOptions = [
  { label: '待确认开发信', value: 'draft_review_pending' },
  { label: '待启动发送', value: 'ready_to_send' },
  { label: '跟进中', value: 'sequence_running' },
  { label: '已暂停跟进', value: 'paused' },
  { label: '已停止跟进', value: 'stopped' },
  { label: '客户已回复', value: 'replied' },
  { label: '已结束记录', value: 'archived' }
] satisfies Array<{ label: string; value: Api.Crm.SequenceEnrollmentStatus }>;

export const sequencePageGuide = {
  title: '开发信跟进承接可开发客户',
  description: '从客户管理创建后，先确认 AI 草稿，再启动首封发送；客户回信后会自动转到客户回信页处理。'
};

export const sequenceTodoTypeOptions = [
  { label: '待确认开发信', value: 'draft_review_pending' },
  { label: '后续信待确认', value: 'follow_up_draft_review' },
  { label: '待启动首封', value: 'ready_to_start' },
  { label: '可生成下一封', value: 'can_generate_next' },
  { label: '发送失败', value: 'send_failed' },
  { label: '已完成全部步骤', value: 'max_steps_reached' }
] satisfies Array<{ label: string; value: Api.Crm.SequenceReviewTodoType }>;

export const sequenceStatusLabelMap: Record<Api.Crm.SequenceEnrollmentStatus, string> = {
  draft_review_pending: '待确认开发信',
  ready_to_send: '待启动发送',
  sequence_running: '跟进中',
  paused: '已暂停跟进',
  stopped: '已停止跟进',
  replied: '客户已回复',
  archived: '已结束记录'
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
  draft_pending_review: '待确认',
  draft_ready: '已确认',
  queued: '等待发送',
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

export interface MessageStatusView {
  label: string;
  tagType: NaiveUI.ThemeColor;
}

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

export interface SequenceReviewFilterTag {
  key: keyof Api.Crm.SequenceReviewFilterModel;
  label: string;
}

export interface SequenceMessageTimelineItem {
  id: string;
  metaText: string;
  selected: boolean;
  statusLabel: string;
  statusTagType: NaiveUI.ThemeColor;
  stepIndex: number;
  subject: string;
  title: string;
}

export interface DraftVersionListItem {
  createdAtText: string;
  editorName: string;
  id: string;
  subjectSummary: string;
  versionLabel: string;
  versionNo: number;
}

export type DraftDiffFieldKey = 'subject' | 'bodyText';

export type DraftDiffChangeType = 'added' | 'removed' | 'modified';

export interface DraftDiffFieldSummary {
  addedLineCount: number;
  changeType: DraftDiffChangeType;
  changedLineCount: number;
  currentText: string;
  key: DraftDiffFieldKey;
  label: string;
  removedLineCount: number;
  summary: string;
  versionText: string;
}

export interface DraftVersionDiffSummary {
  addedLineCount: number;
  changedFieldCount: number;
  changedLineCount: number;
  fields: DraftDiffFieldSummary[];
  hasChanges: boolean;
  previewLines: string[];
  removedLineCount: number;
  summaryText: string;
}

export interface SequenceBatchSelectionSummary {
  aiDraftTaskCount: number;
  approveDraftCount: number;
  generateNextDraftCount: number;
  selectedCount: number;
  skippedCount: number;
  stopCount: number;
}

export interface SequenceBatchResultDisplayItem {
  enrollmentId: string;
  message: string;
  resultId: string;
  status: Api.Crm.SequenceBatchItemStatus;
  statusLabel: string;
  stepText: string | null;
  tagType: NaiveUI.ThemeColor;
}

export const sequenceBatchResultDisplayKey = Symbol('sequence-batch-result-display') as InjectionKey<
  Readonly<Ref<SequenceBatchResultDisplayItem[]>>
>;

export const sequenceBatchResultStatusLabelMap: Record<Api.Crm.SequenceBatchItemStatus, string> = {
  success: '成功',
  skipped: '跳过',
  failed: '失败'
};

export const sequenceBatchResultTagTypeMap: Record<Api.Crm.SequenceBatchItemStatus, NaiveUI.ThemeColor> = {
  success: 'success',
  skipped: 'warning',
  failed: 'error'
};

/** Create the default sequence review filter object for initial load and reset. */
export function createDefaultSequenceFilterModel(): Api.Crm.SequenceReviewFilterModel {
  return {
    keyword: '',
    status: null,
    todoType: null,
    messageStatus: null,
    dateScope: null
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

  if (filterModel.messageStatus) {
    params.messageStatus = filterModel.messageStatus;
  }

  if (filterModel.dateScope) {
    params.dateScope = filterModel.dateScope;
  }

  return params;
}

/** Build compact active-filter tags so workbench jumps explain why this queue is shown. */
export function buildSequenceReviewFilterTags(
  filterModel: Api.Crm.SequenceReviewFilterModel
): SequenceReviewFilterTag[] {
  const tags: SequenceReviewFilterTag[] = [];
  const keyword = filterModel.keyword.trim();

  if (keyword) {
    tags.push({ key: 'keyword', label: `关键词：${keyword}` });
  }

  if (filterModel.status) {
    tags.push({ key: 'status', label: `状态：${sequenceStatusLabelMap[filterModel.status]}` });
  }

  if (filterModel.todoType) {
    const option = sequenceTodoTypeOptions.find(item => item.value === filterModel.todoType);
    tags.push({ key: 'todoType', label: `待办：${option?.label ?? filterModel.todoType}` });
  }

  if (filterModel.messageStatus) {
    tags.push({ key: 'messageStatus', label: `邮件：${messageStatusLabelMap[filterModel.messageStatus]}` });
  }

  if (filterModel.dateScope === 'today') {
    tags.push({ key: 'dateScope', label: '时间：今天' });
  }

  return tags;
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

/** Display scheduled ready follow-ups as waiting for scheduler without changing backend status. */
export function getMessageStatusView(
  message: Api.Crm.MessageRecord,
  enrollmentStatus?: Api.Crm.SequenceEnrollmentStatus
): MessageStatusView {
  if (message.status === 'draft_ready' && message.scheduledAt && enrollmentStatus === 'sequence_running') {
    return {
      label: '待调度',
      tagType: 'warning'
    };
  }

  return {
    label: messageStatusLabelMap[message.status],
    tagType: messageStatusTagTypeMap[message.status]
  };
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

/** Build compact draft version rows for the review drawer. */
export function buildDraftVersionListItems(versions: Api.Crm.MessageDraftVersionRecord[]): DraftVersionListItem[] {
  return [...versions]
    .sort((left, right) => right.versionNo - left.versionNo || right.createdAt.localeCompare(left.createdAt))
    .map(version => ({
      createdAtText: formatSequenceDate(version.createdAt),
      editorName: formatNullableText(version.editorName),
      id: version.id,
      subjectSummary: truncateText(version.subject.trim() || '-', 61),
      versionLabel: `版本 ${version.versionNo}`,
      versionNo: version.versionNo
    }));
}

/** Build a compact field and line diff from the current draft to one saved version. */
export function buildDraftVersionDiffSummary(
  currentDraft: Pick<Api.Crm.MessageDraftPayload, 'subject' | 'bodyText'>,
  versionDraft: Pick<Api.Crm.MessageDraftPayload, 'subject' | 'bodyText'>
): DraftVersionDiffSummary {
  const fields = [
    buildDraftDiffFieldSummary('subject', '主题', currentDraft.subject, versionDraft.subject),
    buildDraftDiffFieldSummary('bodyText', '正文', currentDraft.bodyText, versionDraft.bodyText)
  ].filter((field): field is DraftDiffFieldSummary => Boolean(field));
  const addedLineCount = fields.reduce((total, field) => total + field.addedLineCount, 0);
  const removedLineCount = fields.reduce((total, field) => total + field.removedLineCount, 0);
  const changedLineCount = fields.reduce((total, field) => total + field.changedLineCount, 0);
  const previewLines = fields.map(field => `${field.label}：${formatDraftDiffLineStats(field)}`);

  return {
    addedLineCount,
    changedFieldCount: fields.length,
    changedLineCount,
    fields,
    hasChanges: fields.length > 0,
    previewLines,
    removedLineCount,
    summaryText: fields.length
      ? `将恢复 ${fields.length} 项：${formatDraftDiffLineStats({ addedLineCount, removedLineCount, changedLineCount })}`
      : '与当前草稿一致'
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
    .filter(
      message => ['draft_pending_review', 'draft_ready', 'queued'].includes(message.status) && message.scheduledAt
    )
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

/** Build drawer navigation items for generated sequence messages. */
export function buildSequenceMessageTimelineItems(
  messages: Api.Crm.MessageRecord[],
  selectedMessageId: string | null,
  enrollmentStatus?: Api.Crm.SequenceEnrollmentStatus
): SequenceMessageTimelineItem[] {
  return [...messages]
    .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt))
    .map(message => {
      const statusView = getMessageStatusView(message, enrollmentStatus);

      return {
        id: message.id,
        metaText: formatSequenceMessageTimelineMeta(message),
        selected: message.id === selectedMessageId,
        statusLabel: statusView.label,
        statusTagType: statusView.tagType,
        stepIndex: message.stepIndex,
        subject: message.subject || '-',
        title: `第 ${message.stepIndex} 封`
      };
    });
}

/** Check whether the current enrollment can create one local follow-up draft. */
export function canGenerateNextSequenceDraft(item: Api.Crm.SequenceReviewItem) {
  const canAppendDraftByStatus = ['ready_to_send', 'sequence_running'].includes(item.enrollment.status);
  const hasBlockingMessage = item.messages.some(message =>
    ['draft_pending_review', 'queued', 'failed'].includes(message.status)
  );

  return (
    item.canOperateDraft &&
    canAppendDraftByStatus &&
    !hasBlockingMessage &&
    getMaxSequenceMessageStep(item.messages) < item.enrollment.totalSteps
  );
}

/** Check whether the selected pending draft can be edited or confirmed in the detail modal. */
export function canOperateSelectedSequenceDraft(
  item: Api.Crm.SequenceReviewItem,
  message: Api.Crm.MessageRecord | null
) {
  if (!item.canOperateDraft || !message || message.status !== 'draft_pending_review') {
    return false;
  }

  if (message.stepIndex === 1) {
    return item.enrollment.status === 'draft_review_pending';
  }

  return ['ready_to_send', 'sequence_running'].includes(item.enrollment.status);
}

/** Check whether one selected row can be approved by an owner-only batch action. */
export function canApproveSequenceDraftInBatch(item: Api.Crm.SequenceReviewItem) {
  if (!item.canOperateDraft) return false;

  const pendingMessage = getPendingReviewMessage(item.messages);
  if (!pendingMessage) return false;
  if (isDraftBlockedBySequencePolicy(item, pendingMessage)) return false;

  if (pendingMessage.stepIndex === 1) {
    return item.enrollment.status === 'draft_review_pending';
  }

  // Running sequences require queue scheduling on approval, so batch approval intentionally skips them.
  return item.enrollment.status === 'ready_to_send';
}

/** Check whether one draft violates the sequence policy before approval. */
export function isDraftBlockedBySequencePolicy(
  item: Api.Crm.SequenceReviewItem,
  message: Api.Crm.MessageRecord | null
) {
  return Boolean(
    item.policy?.linkPolicy === 'block_new_links' && message && containsLink(`${message.subject}\n${message.bodyText}`)
  );
}

/** Check whether a selected row should be sent to the AI draft task backend. */
export function canCreateAiDraftTaskForSequence(item: Api.Crm.SequenceReviewItem) {
  return canGenerateNextSequenceDraft(item) && Boolean(item.productLine?.aiWritingConfig?.enabled);
}

/** Check whether the selected pending-review draft can be regenerated from the AI prompt. */
export function canRegenerateAiDraft(item: Api.Crm.SequenceReviewItem, message: Api.Crm.MessageRecord | null) {
  if (!item.productLine?.aiWritingConfig?.enabled || !canOperateSelectedSequenceDraft(item, message)) {
    return false;
  }
  return true;
}

/** Check whether one selected row can be stopped by an owner-only batch action. */
export function canStopSequenceInBatch(item: Api.Crm.SequenceReviewItem) {
  return (
    item.canOperateDraft &&
    ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(item.enrollment.status)
  );
}

/** Collect only owner-operable enrollment ids for batch stop requests. */
export function getStoppableSequenceIds(items: Api.Crm.SequenceReviewItem[]) {
  return items.filter(canStopSequenceInBatch).map(item => item.enrollment.id);
}

/** Summarize currently selected sequence rows for the batch toolbar. */
export function summarizeSequenceBatchSelection(items: Api.Crm.SequenceReviewItem[]): SequenceBatchSelectionSummary {
  const approveDraftCount = items.filter(canApproveSequenceDraftInBatch).length;
  const generateNextDraftCount = items.filter(canGenerateNextSequenceDraft).length;
  const aiDraftTaskCount = items.filter(canCreateAiDraftTaskForSequence).length;
  const stopCount = items.filter(canStopSequenceInBatch).length;

  return {
    aiDraftTaskCount,
    approveDraftCount,
    generateNextDraftCount,
    selectedCount: items.length,
    skippedCount: items.length - Math.max(approveDraftCount, generateNextDraftCount, aiDraftTaskCount, stopCount),
    stopCount
  };
}

/** Format a compact batch result summary for user messages and recent-result panels. */
export function formatSequenceBatchResultText(action: string, result: Api.Crm.SequenceBatchOperateResult) {
  return `${action}完成：成功 ${result.successCount} 条，跳过 ${result.skippedCount} 条，失败 ${result.failedCount} 条`;
}

/** Convert backend per-item results into row display view models keyed by enrollment. */
export function buildSequenceBatchResultDisplayItems(
  result: Api.Crm.SequenceBatchOperateResult
): SequenceBatchResultDisplayItem[] {
  return result.results.map(item => ({
    enrollmentId: item.enrollmentId ?? item.id,
    message: item.message,
    resultId: item.id,
    status: item.status,
    statusLabel: sequenceBatchResultStatusLabelMap[item.status],
    stepText: item.stepIndex ? `第 ${item.stepIndex} 封` : null,
    tagType: sequenceBatchResultTagTypeMap[item.status]
  }));
}

/** Build a row lookup map for recent batch result rendering. */
export function buildSequenceBatchResultDisplayMap(items: SequenceBatchResultDisplayItem[]) {
  return new Map(items.map(item => [item.enrollmentId, item]));
}

/** Build strategy hints for the draft review drawer. */
export function buildSequencePolicyReviewHints(
  item: Api.Crm.SequenceReviewItem,
  message: Api.Crm.MessageRecord | null
): SequencePolicyReviewHint[] {
  if (!item.policy) return [];

  const hasLink = isDraftBlockedBySequencePolicy(item, message);
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

function formatSequenceMessageTimelineMeta(message: Api.Crm.MessageRecord) {
  if (message.sentAt) return `已发送 ${formatSequenceDate(message.sentAt)}`;
  if (message.scheduledAt) return `计划发送 ${formatSequenceDate(message.scheduledAt)}`;
  return `更新于 ${formatSequenceDate(message.updatedAt)}`;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function buildDraftDiffFieldSummary(
  key: DraftDiffFieldKey,
  label: string,
  currentText: string,
  versionText: string
): DraftDiffFieldSummary | null {
  const normalizedCurrent = normalizeDraftDiffText(currentText);
  const normalizedVersion = normalizeDraftDiffText(versionText);

  if (normalizedCurrent === normalizedVersion) return null;

  const currentLines = splitDraftDiffLines(normalizedCurrent);
  const versionLines = splitDraftDiffLines(normalizedVersion);
  const addedLineCount = Math.max(versionLines.length - currentLines.length, 0);
  const removedLineCount = Math.max(currentLines.length - versionLines.length, 0);
  const commonLineCount = Math.min(currentLines.length, versionLines.length);
  let changedLineCount = 0;

  // 只做同位置轻量比较，避免引入复杂 diff 算法。
  for (let index = 0; index < commonLineCount; index += 1) {
    if (currentLines[index] !== versionLines[index]) {
      changedLineCount += 1;
    }
  }

  const changeType = getDraftDiffChangeType(currentLines.length, versionLines.length, changedLineCount);

  return {
    addedLineCount,
    changeType,
    changedLineCount,
    currentText: normalizedCurrent,
    key,
    label,
    removedLineCount,
    summary: buildDraftDiffFieldText(label, normalizedCurrent, normalizedVersion, {
      addedLineCount,
      removedLineCount,
      changedLineCount
    }),
    versionText: normalizedVersion
  };
}

function buildDraftDiffFieldText(
  label: string,
  currentText: string,
  versionText: string,
  stats: Pick<DraftDiffFieldSummary, 'addedLineCount' | 'removedLineCount' | 'changedLineCount'>
) {
  if (label === '主题') {
    if (!currentText) return `主题将恢复为「${versionText || '-'}」`;
    if (!versionText) return `主题将被清空`;
    return `主题将从「${truncateText(currentText, 32)}」恢复为「${truncateText(versionText, 32)}」`;
  }

  return `${label}：${formatDraftDiffLineStats(stats)}`;
}

function formatDraftDiffLineStats(
  stats: Pick<DraftDiffFieldSummary, 'addedLineCount' | 'removedLineCount' | 'changedLineCount'>
) {
  const parts: string[] = [];

  if (stats.addedLineCount > 0) parts.push(`新增 ${stats.addedLineCount} 行`);
  if (stats.removedLineCount > 0) parts.push(`删除 ${stats.removedLineCount} 行`);
  if (stats.changedLineCount > 0) parts.push(`改 ${stats.changedLineCount} 行`);

  return parts.length ? parts.join('，') : '内容已调整';
}

function getDraftDiffChangeType(
  currentLineCount: number,
  versionLineCount: number,
  changedLineCount: number
): DraftDiffChangeType {
  if (currentLineCount === 0 && versionLineCount > 0) return 'added';
  if (currentLineCount > 0 && versionLineCount === 0) return 'removed';
  if (changedLineCount > 0) return 'modified';
  return versionLineCount > currentLineCount ? 'added' : 'removed';
}

function normalizeDraftDiffText(value: string) {
  return value.replace(/\r\n?/g, '\n').trim();
}

function splitDraftDiffLines(value: string) {
  if (!value) return [];
  return value.split('\n');
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
      label: '确认开发信',
      description: `第 ${currentMessage.stepIndex} 封待人工确认`,
      buttonLabel: '确认',
      tagType: 'warning'
    };
  }

  if (item.enrollment.status === 'ready_to_send' && item.firstMessage?.status === 'draft_ready') {
    return {
      label: '启动首封',
      description: '首封已确认，等待启动发送',
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

  if (
    currentMessage?.status === 'draft_ready' &&
    currentMessage.scheduledAt &&
    item.enrollment.status === 'sequence_running'
  ) {
    return {
      label: '待调度',
      description: formatSequenceDate(currentMessage.scheduledAt),
      buttonLabel: '查看',
      tagType: 'warning'
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
      label: '跟进中',
      description: '等待下一步跟进或客户回复',
      buttonLabel: '查看',
      tagType: 'info'
    };
  }

  if (item.enrollment.status === 'replied') {
    return {
      label: '客户已回复',
      description: '同公司开发信已停止',
      buttonLabel: '查看',
      tagType: 'success'
    };
  }

  if (item.enrollment.status === 'stopped') {
    return {
      label: '已停止跟进',
      description: '旧发送任务会自动跳过',
      buttonLabel: '查看',
      tagType: 'default'
    };
  }

  if (item.enrollment.status === 'paused') {
    return {
      label: '已暂停跟进',
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
