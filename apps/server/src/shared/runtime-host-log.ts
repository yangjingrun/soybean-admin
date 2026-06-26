import { createSystemLogErrorMetadata } from '../modules/system-log/system-log-error-taxonomy';
import type { SystemLogRecorder } from '../modules/system-log/system-log.types';

export interface RuntimeHostLogInput {
  recorder?: Pick<SystemLogRecorder, 'record'>;
  module: string;
  action: string;
  message: string;
  error: unknown;
  metadata?: Record<string, unknown>;
  includeErrorTaxonomy?: boolean;
}

/** Record worker/scheduler runtime failures without letting logging errors escape host callbacks. */
export async function recordRuntimeHostError(input: RuntimeHostLogInput) {
  if (!input.recorder) {
    return;
  }

  try {
    await input.recorder.record({
      level: 'error',
      status: 'failed',
      module: input.module,
      action: input.action,
      message: input.message,
      errorMessage: input.error instanceof Error ? input.error.message : String(input.error),
      metadata:
        input.includeErrorTaxonomy === false
          ? (input.metadata ?? {})
          : createSystemLogErrorMetadata(input.error, input.metadata ?? {})
    });
  } catch {
    // Runtime host callbacks must not create a second unhandled failure when logging is unavailable.
  }
}
