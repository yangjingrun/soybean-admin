export type LeadSearchProgressStatus = 'idle' | 'running' | 'completed' | 'failed';
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
  return typeof metric.total === 'number' ? `${metric.label} ${metric.value}/${metric.total}` : `${metric.label} ${metric.value}`;
}

export function isSearchWorkflowFinished(state: LeadSearchProgressState) {
  return state.status === 'completed' || state.status === 'failed';
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
