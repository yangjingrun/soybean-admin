export type LeadSearchProgressStatus = 'idle' | 'running' | 'interrupted' | 'completed' | 'failed';
export type LeadSearchProgressStepStatus = 'active' | 'completed' | 'failed';

export interface LeadSearchProgressStep {
  key: string;
  title: string;
  description?: string;
  status: LeadSearchProgressStepStatus;
  sequence: number;
}

export interface LeadSearchProgressState {
  status: LeadSearchProgressStatus;
  steps: LeadSearchProgressStep[];
  currentTitle: string;
  currentDescription: string;
  progressPercent?: number;
  metrics: Api.AiLeads.LeadSearchProgressMetric[];
  result: Api.AiLeads.LeadSearchPublicResult | null;
  errorMessage: string;
}

export interface LeadSearchTaskActionState {
  canInterrupt: boolean;
  canResume: boolean;
  canRetry: boolean;
  canDiscard: boolean;
  canMarkRead: boolean;
}

export type LeadSearchTaskAction = 'interrupt' | 'resume' | 'retry' | 'discard' | 'read';

/** Creates the initial local state for one search collection workflow. */
export function createLeadSearchProgressState(): LeadSearchProgressState {
  return {
    status: 'idle',
    steps: [],
    currentTitle: '',
    currentDescription: '',
    metrics: [],
    result: null,
    errorMessage: ''
  };
}

/** Restores the display progress state from one persisted backend search task. */
export function createLeadSearchProgressStateFromTask(task: Api.AiLeads.TaskRecord): LeadSearchProgressState {
  const baseState = createTaskBaseProgressState(task);
  const progressState = task.progressState ? reduceLeadSearchProgressEvent(baseState, task.progressState) : baseState;

  if (task.status === 'interrupted') {
    return {
      ...progressState,
      status: 'interrupted',
      currentTitle: baseState.currentTitle,
      currentDescription: baseState.currentDescription,
      errorMessage: task.errorMessage || progressState.errorMessage,
      progressPercent: progressState.progressPercent ?? baseState.progressPercent
    };
  }

  if (task.status === 'failed') {
    return {
      ...progressState,
      status: 'failed',
      errorMessage: task.errorMessage || progressState.errorMessage || '后台采集任务失败，请稍后重试'
    };
  }

  if (task.status !== 'completed') {
    return progressState;
  }

  return {
    ...progressState,
    status: 'completed',
    currentTitle: progressState.currentTitle || '搜索采集完成',
    currentDescription: progressState.currentDescription || '后台采集任务已完成。',
    progressPercent: progressState.progressPercent ?? 100,
    result: task.result ? normalizeTaskSearchResult(task.result) : progressState.result
  };
}

/** Reduces one backend progress event into display state without assuming a fixed step list. */
export function reduceLeadSearchProgressEvent(
  state: LeadSearchProgressState,
  event: Api.AiLeads.LeadSearchProgressEvent
): LeadSearchProgressState {
  if (event.type === 'workflow_started') {
    return {
      ...state,
      status: 'running',
      currentTitle: event.title || state.currentTitle,
      currentDescription: event.description || state.currentDescription,
      progressPercent: event.progressPercent ?? state.progressPercent
    };
  }

  if (event.type === 'workflow_completed') {
    return {
      ...state,
      status: 'completed',
      steps: state.steps.map(step => (step.status === 'active' ? { ...step, status: 'completed' } : step)),
      currentTitle: event.title || '搜索采集完成',
      currentDescription: event.description || state.currentDescription,
      progressPercent: event.progressPercent ?? 100,
      result: event.result ?? state.result,
      metrics: event.metrics ?? state.metrics
    };
  }

  if (event.type === 'workflow_failed') {
    return {
      ...state,
      status: 'failed',
      steps: state.steps.map(step => (step.status === 'active' ? { ...step, status: 'failed' } : step)),
      currentTitle: event.title || '搜索采集失败',
      currentDescription: event.description || state.currentDescription,
      errorMessage: event.errorMessage || '搜索采集失败，请稍后重试',
      progressPercent: event.progressPercent ?? state.progressPercent
    };
  }

  if (!event.stepKey) {
    return state;
  }

  const stepStatus = resolveStepStatus(event.type);
  const nextSteps = upsertStep(state.steps, {
    key: event.stepKey,
    title: event.title || event.stepKey,
    description: event.description,
    status: stepStatus,
    sequence: event.sequence
  });

  return {
    ...state,
    status: 'running',
    steps: nextSteps,
    currentTitle: event.title || state.currentTitle,
    currentDescription: event.description || state.currentDescription,
    progressPercent: event.progressPercent ?? state.progressPercent,
    metrics: event.metrics ?? state.metrics
  };
}

export function getMetricDisplayText(metric: Api.AiLeads.LeadSearchProgressMetric) {
  return typeof metric.total === 'number'
    ? `${metric.label} ${metric.value}/${metric.total}`
    : `${metric.label} ${metric.value}`;
}

export function isSearchWorkflowFinished(state: LeadSearchProgressState) {
  return state.status === 'completed' || state.status === 'failed';
}

/** Checks whether a backend task still needs polling for status changes. */
export function isLeadSearchTaskPending(status: Api.AiLeads.TaskStatus | null | undefined) {
  return status === 'queued' || status === 'running';
}

/** Resolves which task actions should be shown for one backend task status. */
export function getLeadSearchTaskActionState(
  status: Api.AiLeads.TaskStatus | null | undefined,
  readAt: string | null | undefined = null
): LeadSearchTaskActionState {
  return {
    canInterrupt: status === 'running',
    canResume: status === 'interrupted',
    canRetry: status === 'failed',
    canDiscard: status === 'queued' || status === 'interrupted' || status === 'failed',
    canMarkRead: status === 'completed' && !readAt
  };
}

/** Checks whether an accepted task action should leave the persisted task workflow. */
export function shouldClearSearchTaskAfterAction(action: LeadSearchTaskAction) {
  return action === 'discard' || action === 'read';
}

/** Checks whether the user can leave the search result panel and review keywords again. */
export function canReturnToKeywordOptimizationStep(state: LeadSearchProgressState, isSearching: boolean) {
  return !isSearching && isSearchWorkflowFinished(state);
}

function resolveStepStatus(type: Api.AiLeads.LeadSearchProgressEventType): LeadSearchProgressStepStatus {
  if (type === 'step_completed') {
    return 'completed';
  }

  return 'active';
}

function upsertStep(steps: LeadSearchProgressStep[], nextStep: LeadSearchProgressStep) {
  const nextSteps = steps.map(step => {
    if (step.key !== nextStep.key) {
      return step;
    }

    return {
      ...step,
      title: nextStep.title,
      description: nextStep.description || step.description,
      status: nextStep.status,
      sequence: Math.min(step.sequence, nextStep.sequence)
    };
  });

  if (!steps.some(step => step.key === nextStep.key)) {
    nextSteps.push(nextStep);
  }

  return nextSteps.sort((left, right) => left.sequence - right.sequence);
}

function createTaskBaseProgressState(task: Api.AiLeads.TaskRecord): LeadSearchProgressState {
  const baseState = createLeadSearchProgressState();
  const statusStateMap: Record<Api.AiLeads.TaskStatus, LeadSearchProgressState> = {
    queued: {
      ...baseState,
      status: 'running',
      currentTitle: '采集任务已排队',
      currentDescription: '任务正在等待后台 worker 执行。',
      progressPercent: 3
    },
    running: {
      ...baseState,
      status: 'running',
      currentTitle: '采集任务执行中',
      currentDescription: '后台 worker 正在采集线索。',
      progressPercent: 8
    },
    interrupted: {
      ...baseState,
      status: 'interrupted',
      currentTitle: '采集任务已中断',
      currentDescription: '任务已暂停，可以继续采集或放弃任务。',
      progressPercent: task.progressState?.progressPercent ?? 50
    },
    failed: {
      ...baseState,
      status: 'failed',
      currentTitle: '采集任务失败',
      currentDescription: task.errorMessage || '后台采集任务失败，请稍后重试。',
      errorMessage: task.errorMessage || '后台采集任务失败，请稍后重试',
      progressPercent: task.progressState?.progressPercent
    },
    completed: {
      ...baseState,
      status: 'completed',
      currentTitle: '搜索采集完成',
      currentDescription: '后台采集任务已完成，可用线索已进入 CRM。下一步处理本次客户，补齐联系人并创建开发信。',
      progressPercent: 100
    },
    discarded: baseState
  };

  return statusStateMap[task.status];
}

function normalizeTaskSearchResult(
  result: Api.AiLeads.SearchOrchestrateResult | Api.AiLeads.LeadSearchPublicResult
): Api.AiLeads.LeadSearchPublicResult {
  if ('summary' in result) {
    return result;
  }

  return {
    summary: {
      actionCount: result.serperRequests.length,
      qualityCheckCount: result.decisions.length,
      candidateCount: result.candidates.length,
      stopReason: result.stopReason
    },
    candidates: result.candidates.map(toCandidateView),
    serperResults: result.serperResults.map(toSerperResultView),
    warnings: result.qualityWarnings
  };
}

function toCandidateView(candidate: Record<string, unknown>): Api.AiLeads.LeadSearchCandidateView {
  return {
    title: readString(candidate.title),
    website: readString(candidate.website) || readString(candidate.url),
    snippet: readString(candidate.snippet),
    country: readString(candidate.country),
    city: readString(candidate.city),
    address: readString(candidate.address),
    phoneNumber: readString(candidate.phoneNumber),
    sourceType: readString(candidate.sourceType),
    sourceLabel: readString(candidate.sourceLabel) || toSourceLabel(readString(candidate.sourceType)),
    sourceUrl: readString(candidate.sourceUrl) || readString(candidate.url) || readString(candidate.link),
    score: readNumber(candidate.score),
    reason: readString(candidate.reason)
  };
}

function toSerperResultView(result: Api.AiLeads.LeadSearchSerperResultView): Api.AiLeads.LeadSearchSerperResultView {
  return {
    endpoint: result.endpoint,
    requestBody: result.requestBody,
    result: result.result
  };
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toSourceLabel(sourceType?: string) {
  if (sourceType === 'place' || sourceType === 'local') {
    return '本地商家线索';
  }

  if (sourceType === 'organic') {
    return '公开线索';
  }

  return '候选线索';
}
