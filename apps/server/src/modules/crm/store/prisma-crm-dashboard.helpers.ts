/** Reads a bounded progress percentage from an AI task progress payload. */
export function readProgressPercent(progressState: unknown, status: string) {
  if (status === 'completed' || status === 'failed') return 100;
  if (!progressState || typeof progressState !== 'object' || !('progressPercent' in progressState)) return undefined;

  const value = (progressState as { progressPercent?: unknown }).progressPercent;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  return Math.max(0, Math.min(100, Math.round(value)));
}
