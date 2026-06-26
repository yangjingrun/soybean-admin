type AiDraftTaskPollingTimer = ReturnType<typeof setInterval>;

interface AiDraftTaskPollingControllerOptions {
  getDetail: () => Api.Crm.AiDraftTaskDetail | null;
  intervalMs: number;
  isVisible: () => boolean;
  refresh: (taskId: string) => Promise<void>;
}

/** Check whether the AI draft task still needs live progress refreshes. */
export function isAiDraftTaskPollingStatus(status: Api.Crm.AiDraftTaskStatus | null | undefined) {
  return status === 'queued' || status === 'running';
}

/** Ignore late responses when the drawer has already moved to another task. */
export function canApplyAiDraftTaskDetail(currentDetail: Api.Crm.AiDraftTaskDetail | null, requestedTaskId: string) {
  return !currentDetail || currentDetail.task.id === requestedTaskId;
}

/** Create a tiny polling controller so task progress refresh stays testable outside Vue. */
export function createAiDraftTaskPollingController(options: AiDraftTaskPollingControllerOptions) {
  let timer: AiDraftTaskPollingTimer | null = null;

  const shouldPoll = () => {
    const detail = options.getDetail();

    return Boolean(options.isVisible() && detail && isAiDraftTaskPollingStatus(detail.task.status));
  };

  const refreshCurrentTask = () => {
    const detail = options.getDetail();

    if (!detail) {
      return;
    }

    void options.refresh(detail.task.id);
  };

  const stop = () => {
    if (!timer) {
      return;
    }

    clearInterval(timer);
    timer = null;
  };

  const sync = () => {
    if (!shouldPoll()) {
      stop();
      return;
    }

    if (timer) {
      return;
    }

    timer = setInterval(refreshCurrentTask, options.intervalMs);
  };

  return {
    dispose: stop,
    isPolling: () => Boolean(timer),
    sync
  };
}
