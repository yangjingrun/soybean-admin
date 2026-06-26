export interface VersionedTaskState<TStatus extends string> {
  status: TStatus;
  runVersion: number;
  readAt?: Date | null;
}

export type TaskStatusTransitionRules<TStatus extends string> = {
  readonly [Status in TStatus]: readonly TStatus[];
};

export interface TaskEventStateChange<TStatus extends string> {
  taskId: string;
  eventType: string;
  title: string;
  message?: string | null;
  fromStatus?: TStatus | null;
  toStatus?: TStatus | null;
  metadata?: unknown | null;
}

export function isStaleRunVersion(task: Pick<VersionedTaskState<string>, 'runVersion'> | null, runVersion: number) {
  return !task || task.runVersion !== runVersion;
}

export function isTaskInStatus<TStatus extends string>(
  task: Pick<VersionedTaskState<TStatus>, 'status'> | null,
  statuses: readonly TStatus[]
) {
  return Boolean(task && statuses.includes(task.status));
}

/** Checks an explicit status transition table instead of scattering status rules across callers. */
export function canTransitionTaskStatus<TStatus extends string>(
  rules: TaskStatusTransitionRules<TStatus>,
  fromStatus: TStatus,
  toStatus: TStatus
) {
  return rules[fromStatus].includes(toStatus);
}

/** Pick current task candidates without coupling AI and CRM task implementations. */
export function resolveCurrentTask<
  TTask extends { status: TStatus; updatedAt: Date; readAt?: Date | null },
  TStatus extends string
>(
  records: TTask[],
  options: {
    activeStatuses: readonly TStatus[];
    unreadTerminalStatuses?: readonly TStatus[];
    statusWeight: Record<TStatus, number>;
  }
) {
  const unreadTerminalStatuses = options.unreadTerminalStatuses ?? [];
  const candidates = records.filter(record => {
    if (options.activeStatuses.includes(record.status)) {
      return true;
    }

    return unreadTerminalStatuses.includes(record.status) && !record.readAt;
  });

  return (
    candidates.sort((left, right) => {
      const statusWeight = options.statusWeight[left.status] - options.statusWeight[right.status];

      if (statusWeight !== 0) {
        return statusWeight;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })[0] ?? null
  );
}

/** Keep system-notification metadata intentionally small for background task reminders. */
export function createTaskNotificationMetadata<TExtra extends Record<string, unknown> = Record<string, never>>(
  taskId: string,
  extra?: TExtra
) {
  return {
    taskId,
    ...extra
  };
}

/** Build a typed task event payload for state transitions. */
export function createTaskStateChangeEvent<TStatus extends string>(
  input: TaskEventStateChange<TStatus>
): TaskEventStateChange<TStatus> {
  return {
    taskId: input.taskId,
    eventType: input.eventType,
    title: input.title,
    message: input.message ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    metadata: input.metadata ?? null
  };
}
