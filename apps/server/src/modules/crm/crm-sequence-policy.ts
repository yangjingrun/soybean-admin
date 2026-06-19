import type { CrmMessageThreadMode } from './crm.types';

export const defaultSequencePolicySteps: CrmSequencePolicyStep[] = [
  { stepIndex: 1, delayDays: 0, threadMode: 'new_subject' },
  { stepIndex: 2, delayDays: 3, threadMode: 'same_thread' },
  { stepIndex: 3, delayDays: 7, threadMode: 'new_subject' },
  { stepIndex: 4, delayDays: 14, threadMode: 'new_subject' },
  { stepIndex: 5, delayDays: 21, threadMode: 'new_subject' }
];

export const sequencePolicyLinkPolicies = ['preserve_template_links', 'block_new_links'] as const;
export const sequencePolicySameCompanyStrategies = ['single_active_per_company', 'allow_multiple_contacts'] as const;
export const sequencePolicyStatuses = ['active', 'archived'] as const;

export type CrmSequencePolicyLinkPolicy = (typeof sequencePolicyLinkPolicies)[number];
export type CrmSequencePolicySameCompanyStrategy = (typeof sequencePolicySameCompanyStrategies)[number];
export type CrmSequencePolicyStatus = (typeof sequencePolicyStatuses)[number];

export interface CrmSequencePolicyStep {
  stepIndex: number;
  delayDays: number;
  threadMode: CrmMessageThreadMode;
}

const validThreadModes = new Set<CrmMessageThreadMode>(['new_subject', 'same_thread']);
const maxDelayDays = 90;

/** Normalizes a five-step sequence policy while keeping step one immediate. */
export function normalizeSequencePolicySteps(value: unknown): CrmSequencePolicyStep[] {
  const source = Array.isArray(value) ? value : defaultSequencePolicySteps;
  const byStep = new Map<number, Partial<CrmSequencePolicyStep>>();

  for (const item of source) {
    if (!isRecord(item)) continue;
    const stepIndex = Number(item.stepIndex);
    if (!Number.isInteger(stepIndex) || stepIndex < 1 || stepIndex > 5) continue;
    byStep.set(stepIndex, item as Partial<CrmSequencePolicyStep>);
  }

  return defaultSequencePolicySteps.map(defaultStep => {
    const item = byStep.get(defaultStep.stepIndex);
    const threadMode = validThreadModes.has(item?.threadMode as CrmMessageThreadMode)
      ? (item?.threadMode as CrmMessageThreadMode)
      : defaultStep.threadMode;

    return {
      stepIndex: defaultStep.stepIndex,
      delayDays: defaultStep.stepIndex === 1 ? 0 : normalizeDelayDays(item?.delayDays, defaultStep.delayDays),
      threadMode
    };
  });
}

/** Serializes policy step delays into a compact DB field. */
export function serializeSequencePolicyStepDelayDays(steps: CrmSequencePolicyStep[]) {
  return normalizeSequencePolicySteps(steps)
    .map(step => step.delayDays)
    .join(',');
}

/** Serializes policy thread modes into a compact DB field. */
export function serializeSequencePolicyThreadModes(steps: CrmSequencePolicyStep[]) {
  return normalizeSequencePolicySteps(steps)
    .map(step => step.threadMode)
    .join(',');
}

/** Parses DB text fields into five structured policy steps. */
export function parseSequencePolicySteps(delayDaysText: string, threadModesText: string): CrmSequencePolicyStep[] {
  const delayDays = delayDaysText.split(',');
  const threadModes = threadModesText.split(',');

  return normalizeSequencePolicySteps(
    defaultSequencePolicySteps.map((step, index) => ({
      stepIndex: step.stepIndex,
      delayDays: Number(delayDays[index]),
      threadMode: threadModes[index]
    }))
  );
}

export function normalizeSequencePolicyLinkPolicy(value: unknown): CrmSequencePolicyLinkPolicy {
  return sequencePolicyLinkPolicies.includes(value as CrmSequencePolicyLinkPolicy)
    ? (value as CrmSequencePolicyLinkPolicy)
    : 'preserve_template_links';
}

export function normalizeSequencePolicySameCompanyStrategy(value: unknown): CrmSequencePolicySameCompanyStrategy {
  return sequencePolicySameCompanyStrategies.includes(value as CrmSequencePolicySameCompanyStrategy)
    ? (value as CrmSequencePolicySameCompanyStrategy)
    : 'single_active_per_company';
}

export function normalizeSequencePolicyStatus(value: unknown): CrmSequencePolicyStatus {
  return sequencePolicyStatuses.includes(value as CrmSequencePolicyStatus)
    ? (value as CrmSequencePolicyStatus)
    : 'active';
}

function normalizeDelayDays(value: unknown, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }

  return Math.min(numberValue, maxDelayDays);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
