import dayjs from 'dayjs';
export const sequenceStatusOptions = [
  { label: '待确认发送', value: 'draft_review_pending' },
  { label: '等待发送', value: 'ready_to_send' },
  { label: '跟进中', value: 'sequence_running' },
  { label: '已暂停跟进', value: 'paused' },
  { label: '已停止跟进', value: 'stopped' },
  { label: '客户已回复', value: 'replied' },
  { label: '已结束记录', value: 'archived' }
];
export const sequencePageGuide = {
  title: '开发信任务承接可开发客户',
  description: '从客户管理创建后，确认邮件内容并按发送规则安排发送；客户回信后会自动转到客户回信页处理。'
};
export const sequenceTodoTypeOptions = [
  { label: '待确认发送', value: 'draft_review_pending' },
  { label: '后续邮件待确认', value: 'follow_up_draft_review' },
  { label: '等待发送', value: 'ready_to_start' },
  { label: '可生成下一封', value: 'can_generate_next' },
  { label: '发送失败', value: 'send_failed' },
  { label: '已完成全部步骤', value: 'max_steps_reached' }
];
export const sequenceStatusLabelMap = {
  draft_review_pending: '待确认发送',
  ready_to_send: '等待发送',
  sequence_running: '跟进中',
  paused: '已暂停跟进',
  stopped: '已停止跟进',
  replied: '客户已回复',
  archived: '已结束记录'
};
export const sequenceStatusTagTypeMap = {
  draft_review_pending: 'warning',
  ready_to_send: 'success',
  sequence_running: 'info',
  paused: 'warning',
  stopped: 'default',
  replied: 'success',
  archived: 'default'
};
export const messageStatusLabelMap = {
  draft_pending_review: '待确认发送',
  draft_ready: '等待发送',
  queued: '发送中',
  sent: '已发送',
  failed: '发送失败，可处理',
  skipped: '已跳过'
};
export const messageStatusTagTypeMap = {
  draft_pending_review: 'warning',
  draft_ready: 'success',
  queued: 'info',
  sent: 'success',
  failed: 'error',
  skipped: 'default'
};
export const sequenceBatchResultDisplayKey = Symbol('sequence-batch-result-display');
export const sequenceBatchResultStatusLabelMap = {
  success: '成功',
  skipped: '跳过',
  failed: '失败'
};
export const sequenceBatchResultTagTypeMap = {
  success: 'success',
  skipped: 'warning',
  failed: 'error'
};
export const sequenceCreatedAtScopeLabelMap = {
  today: '今天',
  yesterday: '昨天',
  last_3_days: '最近三天',
  last_7_days: '最近一周',
  last_30_days: '最近一月'
};
/** Create the default sequence review filter object for initial load and reset. */
export function createDefaultSequenceFilterModel() {
  return {
    keyword: '',
    currentStep: null,
    status: null,
    todoType: null,
    messageStatus: null,
    dateScope: null,
    createdAtScope: null
  };
}
/** Create an empty sequence review creation form. The first message is generated immediately; follow-ups are created later. */
export function createDefaultSequenceCreateForm() {
  return {
    accountId: null,
    contactId: null,
    productLineId: null,
    mailboxId: null,
    policyId: null
  };
}
/** Build sequence review list query params from pagination and filters. */
export function buildSequenceReviewSearchParams(options) {
  const { current, filterModel, size } = options;
  const params = {
    current,
    size
  };
  const keyword = filterModel.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
  }
  if (filterModel.currentStep) {
    params.currentStep = filterModel.currentStep;
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
  if (filterModel.createdAtScope) {
    params.createdAtScope = filterModel.createdAtScope;
  }
  return params;
}
/** Build compact active-filter tags so workbench jumps explain why this queue is shown. */
export function buildSequenceReviewFilterTags(filterModel) {
  const tags = [];
  const keyword = filterModel.keyword.trim();
  if (keyword) {
    tags.push({ key: 'keyword', label: `公司域名：${keyword}` });
  }
  if (filterModel.currentStep) {
    tags.push({ key: 'currentStep', label: `跟进进度：第 ${filterModel.currentStep} 封` });
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
  if (filterModel.createdAtScope) {
    tags.push({
      key: 'createdAtScope',
      label: `创建时间：${sequenceCreatedAtScopeLabelMap[filterModel.createdAtScope]}`
    });
  }
  return tags;
}
/** Convert nullable create form values into backend payload after local validation. */
export function normalizeSequenceCreatePayload(formModel) {
  const payload = {
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
export function formatSequenceDate(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}
export function formatNullableText(value) {
  return value || '-';
}
/** Display scheduled ready follow-ups with user-facing send wording without changing backend status. */
export function getMessageStatusView(message, enrollmentStatus) {
  if (message.status === 'draft_ready' && message.scheduledAt && enrollmentStatus === 'sequence_running') {
    return {
      label: '等待发送',
      tagType: 'warning'
    };
  }
  return {
    label: messageStatusLabelMap[message.status],
    tagType: messageStatusTagTypeMap[message.status]
  };
}
/** Build the save event payload from the currently selected draft. */
export function buildDraftReviewOperationPayload(messageId, draft) {
  return {
    messageId,
    draft: {
      subject: draft.subject.trim(),
      bodyText: draft.bodyText.trim()
    }
  };
}
/** Build compact draft version rows for the review drawer. */
export function buildDraftVersionListItems(versions) {
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
export function buildDraftVersionDiffSummary(currentDraft, versionDraft) {
  const fields = [
    buildDraftDiffFieldSummary('subject', '主题', currentDraft.subject, versionDraft.subject),
    buildDraftDiffFieldSummary('bodyText', '正文', currentDraft.bodyText, versionDraft.bodyText)
  ].filter(field => Boolean(field));
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
export function getPendingReviewMessage(messages) {
  return [...messages]
    .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt))
    .find(message => message.status === 'draft_pending_review');
}
/** Return the nearest scheduled message that still needs review or sending. */
export function getNextScheduledReviewMessage(messages) {
  return messages
    .filter(
      message => ['draft_pending_review', 'draft_ready', 'queued'].includes(message.status) && message.scheduledAt
    )
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))[0];
}
/** Return failed sequence messages ordered by step for audit and retry UX. */
export function getFailedSequenceMessages(messages) {
  return messages
    .filter(message => message.status === 'failed')
    .sort((left, right) => left.stepIndex - right.stepIndex || left.createdAt.localeCompare(right.createdAt));
}
/** Return the largest generated message step in one enrollment. */
export function getMaxSequenceMessageStep(messages) {
  return messages.reduce((maxStep, message) => Math.max(maxStep, message.stepIndex), 0);
}
/** Build drawer navigation items for generated sequence messages. */
export function buildSequenceMessageTimelineItems(messages, selectedMessageId, enrollmentStatus) {
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
export function canGenerateNextSequenceDraft(item) {
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
export function canOperateSelectedSequenceDraft(item, message) {
  if (!item.canOperateDraft || !message || message.status !== 'draft_pending_review') {
    return false;
  }
  if (message.stepIndex === 1) {
    return ['draft_review_pending', 'ready_to_send'].includes(item.enrollment.status);
  }
  return ['ready_to_send', 'sequence_running'].includes(item.enrollment.status);
}
/** Decide whether a just-approved first message should immediately enter the send queue. */
export function shouldQueueFirstMessageAfterApproval(enrollment, message) {
  return enrollment.status === 'ready_to_send' && message.stepIndex === 1 && message.status === 'draft_ready';
}
/** Check whether one selected row can be approved by an owner-only batch action. */
export function canApproveSequenceDraftInBatch(item) {
  if (!item.canOperateDraft) return false;
  const pendingMessage = getPendingReviewMessage(item.messages);
  if (!pendingMessage) return false;
  if (isDraftBlockedBySequencePolicy(item, pendingMessage)) return false;
  if (pendingMessage.stepIndex === 1) {
    return ['draft_review_pending', 'ready_to_send'].includes(item.enrollment.status);
  }
  // Running sequences require queue scheduling on approval, so batch approval intentionally skips them.
  return item.enrollment.status === 'ready_to_send';
}
/** Check whether one draft violates the sequence policy before approval. */
export function isDraftBlockedBySequencePolicy(item, message) {
  return Boolean(
    item.policy?.linkPolicy === 'block_new_links' && message && containsLink(`${message.subject}\n${message.bodyText}`)
  );
}
/** Check whether a selected row should be sent to the AI draft task backend. */
export function canCreateAiDraftTaskForSequence(item) {
  return canGenerateNextSequenceDraft(item) && Boolean(item.productLine?.aiWritingConfig?.enabled);
}
/** Check whether the selected pending-review draft can be regenerated from the AI prompt. */
export function canRegenerateAiDraft(item, message) {
  if (!item.productLine?.aiWritingConfig?.enabled || !canOperateSelectedSequenceDraft(item, message)) {
    return false;
  }
  return true;
}
/** Check whether one selected row can be stopped by an owner-only batch action. */
export function canStopSequenceInBatch(item) {
  return (
    item.canOperateDraft &&
    ['draft_review_pending', 'ready_to_send', 'sequence_running', 'paused'].includes(item.enrollment.status)
  );
}
/** Check whether the first message can be returned to editing without rewriting sent history. */
export function canReturnFirstMessageToEdit(item, message) {
  return Boolean(
    item.canOperateDraft &&
    message &&
    message.stepIndex === 1 &&
    ['draft_ready', 'queued', 'failed', 'skipped'].includes(message.status) &&
    ['ready_to_send', 'sequence_running', 'stopped', 'paused'].includes(item.enrollment.status) &&
    !message.sentAt &&
    !message.providerMessageId
  );
}
/** Check whether a stopped sequence can be restored by the owner. */
export function canResumeSequence(item) {
  return item.canControlSequence && item.enrollment.status === 'stopped';
}
/** Check whether an unsent first message can be sent back to the scheduler. */
export function canRetryFirstMessageSend(item, message) {
  return Boolean(
    item.canControlSequence &&
    message &&
    message.stepIndex === 1 &&
    ['draft_ready', 'failed', 'skipped'].includes(message.status) &&
    ['ready_to_send', 'stopped', 'paused'].includes(item.enrollment.status) &&
    !message.sentAt &&
    !message.providerMessageId
  );
}
/** Collect only owner-operable enrollment ids for batch stop requests. */
export function getStoppableSequenceIds(items) {
  return items.filter(canStopSequenceInBatch).map(item => item.enrollment.id);
}
/** Summarize currently selected sequence rows for the batch toolbar. */
export function summarizeSequenceBatchSelection(items) {
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
export function formatSequenceBatchResultText(action, result) {
  return `${action}完成：成功 ${result.successCount} 条，跳过 ${result.skippedCount} 条，失败 ${result.failedCount} 条`;
}
/** Convert backend per-item results into row display view models keyed by enrollment. */
export function buildSequenceBatchResultDisplayItems(result) {
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
export function buildSequenceBatchResultDisplayMap(items) {
  return new Map(items.map(item => [item.enrollmentId, item]));
}
/** Build strategy hints for the draft review drawer. */
export function buildSequencePolicyReviewHints(item, message) {
  if (!item.policy) return [];
  const hasLink = isDraftBlockedBySequencePolicy(item, message);
  const linkHint =
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
  const autoSendHint = item.policy.allowLowRiskAutoSend
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
export function getCurrentSequenceMessage(item) {
  return (
    getPendingReviewMessage(item.messages) ??
    getFailedSequenceMessages(item.messages)[0] ??
    getNextScheduledReviewMessage(item.messages) ??
    item.messages.find(message => message.stepIndex === item.enrollment.currentStep) ??
    item.firstMessage
  );
}
/** Return the message id that should be selected when opening a sequence detail drawer. */
export function getDefaultSequenceReviewMessageId(item) {
  return item ? (getCurrentSequenceMessage(item)?.id ?? null) : null;
}
function containsLink(text) {
  return /\b(?:https?:\/\/|www\.)\S+/i.test(text);
}
function formatSequenceMessageTimelineMeta(message) {
  if (message.sentAt) return `已发送 ${formatSequenceDate(message.sentAt)}`;
  if (message.scheduledAt) return `将在 ${formatSequenceDate(message.scheduledAt)} 自动发送`;
  return `更新于 ${formatSequenceDate(message.updatedAt)}`;
}
function truncateText(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
function buildDraftDiffFieldSummary(key, label, currentText, versionText) {
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
function buildDraftDiffFieldText(label, currentText, versionText, stats) {
  if (label === '主题') {
    if (!currentText) return `主题将恢复为「${versionText || '-'}」`;
    if (!versionText) return `主题将被清空`;
    return `主题将从「${truncateText(currentText, 32)}」恢复为「${truncateText(versionText, 32)}」`;
  }
  return `${label}：${formatDraftDiffLineStats(stats)}`;
}
function formatDraftDiffLineStats(stats) {
  const parts = [];
  if (stats.addedLineCount > 0) parts.push(`新增 ${stats.addedLineCount} 行`);
  if (stats.removedLineCount > 0) parts.push(`删除 ${stats.removedLineCount} 行`);
  if (stats.changedLineCount > 0) parts.push(`改 ${stats.changedLineCount} 行`);
  return parts.length ? parts.join('，') : '内容已调整';
}
function getDraftDiffChangeType(currentLineCount, versionLineCount, changedLineCount) {
  if (currentLineCount === 0 && versionLineCount > 0) return 'added';
  if (currentLineCount > 0 && versionLineCount === 0) return 'removed';
  if (changedLineCount > 0) return 'modified';
  return versionLineCount > currentLineCount ? 'added' : 'removed';
}
function normalizeDraftDiffText(value) {
  return value.replace(/\r\n?/g, '\n').trim();
}
function splitDraftDiffLines(value) {
  if (!value) return [];
  return value.split('\n');
}
/** Summarize the row checklist for dense table scanning. */
export function getSequenceChecklistSummary(item) {
  const failedCount = item.checklist.filter(check => !check.passed).length;
  return {
    failedCount,
    passedCount: item.checklist.length - failedCount,
    total: item.checklist.length
  };
}
/** Build a compact send-audit summary for table rows and drawer panels. */
export function getSequenceSendAuditSummary(item) {
  const checklist = getSequenceChecklistSummary(item);
  const failedMessages = getFailedSequenceMessages(item.messages);
  const currentMessage = getCurrentSequenceMessage(item);
  if (isFirstOutreachGenerating(item)) {
    return {
      label: '后台生成中',
      description: '系统正在生成首封开发信，完成后会进入发送计划',
      failedCheckCount: 0,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'info',
      totalCheckCount: checklist.total
    };
  }
  if (failedMessages.length > 0) {
    return {
      label: '发送失败',
      description: `第 ${failedMessages.map(message => message.stepIndex).join('、')} 封发送失败，可修改后再发送或直接重试`,
      failedCheckCount: checklist.failedCount,
      failedMessageCount: failedMessages.length,
      passedCheckCount: checklist.passedCount,
      tagType: 'error',
      totalCheckCount: checklist.total
    };
  }
  if (currentMessage?.status === 'queued') {
    return {
      label: '发送中',
      description: `第 ${currentMessage.stepIndex} 封正在发送，等待系统回写结果`,
      failedCheckCount: checklist.failedCount,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'info',
      totalCheckCount: checklist.total
    };
  }
  if (
    currentMessage?.status === 'draft_ready' &&
    currentMessage.scheduledAt &&
    item.enrollment.status === 'sequence_running'
  ) {
    return {
      label: '已排期',
      description: `第 ${currentMessage.stepIndex} 封已确认，等待系统按计划发送`,
      failedCheckCount: checklist.failedCount,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'info',
      totalCheckCount: checklist.total
    };
  }
  if (checklist.failedCount > 0) {
    return {
      label: `${checklist.failedCount} 项需确认`,
      description: '发送条件未全部通过，请先确认预警项',
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
      description: '发送条件已通过，可确认当前邮件',
      failedCheckCount: 0,
      failedMessageCount: 0,
      passedCheckCount: checklist.passedCount,
      tagType: 'success',
      totalCheckCount: checklist.total
    };
  }
  return {
    label: '暂无发送条件',
    description: '暂无发送条件校验项',
    failedCheckCount: 0,
    failedMessageCount: 0,
    passedCheckCount: 0,
    tagType: 'default',
    totalCheckCount: 0
  };
}
/** Describe the next expected user or system action for one sequence row. */
export function getSequenceNextAction(item) {
  const currentMessage = getCurrentSequenceMessage(item);
  if (isFirstOutreachGenerating(item)) {
    return {
      label: '后台生成中',
      description: '系统正在生成首封开发信，完成后会进入发送计划',
      buttonLabel: '查看',
      tagType: 'info'
    };
  }
  if (currentMessage?.status === 'draft_pending_review') {
    return {
      label: '确认发送',
      description: `第 ${currentMessage.stepIndex} 封还没发送，确认内容后按计划发送`,
      buttonLabel: '确认发送',
      tagType: 'warning'
    };
  }
  if (item.enrollment.status === 'ready_to_send' && item.firstMessage?.status === 'draft_ready') {
    return {
      label: '确认发送',
      description: '首封已确认，可按发送规则安排发送',
      buttonLabel: '安排发送',
      tagType: 'success'
    };
  }
  if (currentMessage?.status === 'failed') {
    return {
      label: '修改后再发送',
      description: `第 ${currentMessage.stepIndex} 封未成功发出，可修改或直接重试`,
      buttonLabel: '处理',
      tagType: 'error'
    };
  }
  if (currentMessage?.status === 'queued') {
    return {
      label: '发送中',
      description: '系统正在发送，请稍后查看结果',
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
      label: '等待发送',
      description: '已确认，等待系统按发送规则执行',
      buttonLabel: '查看',
      tagType: 'warning'
    };
  }
  if (canGenerateNextSequenceDraft(item)) {
    return {
      label: '生成下一封',
      description: `已生成到第 ${getMaxSequenceMessageStep(item.messages)} 封，可继续生成后续开发信`,
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
      label: '已停止，可恢复',
      description: '误操作可恢复，已发出的邮件不会重复发送',
      buttonLabel: '恢复',
      tagType: 'warning'
    };
  }
  if (item.enrollment.status === 'paused') {
    return {
      label: '已暂停，可恢复',
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
/** Check whether a placeholder sequence is waiting for its first AI email. */
export function isFirstOutreachGenerating(item) {
  return item.enrollment.status === 'draft_review_pending' && !item.firstMessage && item.messages.length === 0;
}
/** Format backend sequence progress as a compact table label. */
export function getSequenceProgressText(progress) {
  return `第 ${progress.currentStep} / ${progress.totalSteps} 封`;
}
