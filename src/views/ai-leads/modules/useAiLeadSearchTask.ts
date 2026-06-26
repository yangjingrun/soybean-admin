import { createLeadSearchProgressState, isLeadSearchTaskPending } from './search-progress';
import type { LeadSearchProgressState } from './search-progress';

/** Convert a persisted task keyword plan into the AI result view shape used by the editor. */
export function createAiResultFromSearchTask(task: Api.AiLeads.TaskRecord): Api.AiGateway.AiTextResult {
  return {
    text: JSON.stringify(task.keywordPlan, null, 2),
    finishReason: task.status,
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null
    }
  };
}

/** Create optimistic progress shown immediately after submitting a background search task. */
export function createStartingSearchProgressState(): LeadSearchProgressState {
  return {
    ...createLeadSearchProgressState(),
    status: 'running',
    currentTitle: '准备搜索采集',
    currentDescription: '正在建立采集任务。',
    progressPercent: 3,
    startedAt: new Date().toISOString()
  };
}

/** Restore only tasks that can still make progress after a create request error. */
export function shouldRestoreSearchTaskAfterCreateRequestError(task: Api.AiLeads.TaskRecord) {
  return isLeadSearchTaskPending(task.status);
}
