import { mapAiLeadTaskResultToCrmImportInputs } from '../../ai-leads/ai-lead-crm-import.adapter';
import type { AiLeadProductLineSnapshot } from '../../ai-leads/ai-lead-product-line-context';
import { normalizeCrmDomain, normalizeCrmName } from '../shared/crm-normalizers';

export interface CrmAccountSourceSnapshotBackfillAccount {
  id: string;
  sourceTaskId: string | null;
  name: string;
  normalizedName: string;
  domain: string | null;
  websiteUrl: string | null;
}

export interface CrmAccountSourceSnapshotBackfillTask {
  id: string;
  productLineSnapshot?: AiLeadProductLineSnapshot | null;
  result: unknown;
}

export interface CrmAccountSourceSnapshotBackfillDatabase {
  findAccountsMissingSourceSnapshot(): Promise<CrmAccountSourceSnapshotBackfillAccount[]>;
  findTasksByIds(ids: string[]): Promise<CrmAccountSourceSnapshotBackfillTask[]>;
  updateAccountSourceSnapshot(id: string, sourceSnapshot: Record<string, unknown>): Promise<unknown>;
}

export interface CrmAccountSourceSnapshotBackfillOptions {
  dryRun?: boolean;
}

export interface CrmAccountSourceSnapshotBackfillSummary {
  scannedAccountCount: number;
  taskCount: number;
  matchedCount: number;
  updatedCount: number;
  skippedNoTaskCount: number;
  skippedNoSnapshotCount: number;
}

interface CandidateSnapshotMatch {
  taskId: string;
  normalizedName: string;
  domain: string | null;
  sourceSnapshot: Record<string, unknown>;
}

/** Backfills CRM account source snapshots from completed AI lead task results. */
export async function backfillCrmAccountSourceSnapshots(
  database: CrmAccountSourceSnapshotBackfillDatabase,
  options: CrmAccountSourceSnapshotBackfillOptions = {}
): Promise<CrmAccountSourceSnapshotBackfillSummary> {
  const accounts = await database.findAccountsMissingSourceSnapshot();
  const taskIds = Array.from(
    new Set(accounts.map(account => account.sourceTaskId).filter((id): id is string => Boolean(id)))
  );
  const tasks = taskIds.length ? await database.findTasksByIds(taskIds) : [];
  const taskIdSet = new Set(tasks.map(task => task.id));
  const candidateMatches = buildCandidateSnapshotMatches(tasks);
  const summary: CrmAccountSourceSnapshotBackfillSummary = {
    scannedAccountCount: accounts.length,
    taskCount: tasks.length,
    matchedCount: 0,
    updatedCount: 0,
    skippedNoTaskCount: 0,
    skippedNoSnapshotCount: 0
  };

  for (const account of accounts) {
    if (!account.sourceTaskId || !taskIdSet.has(account.sourceTaskId)) {
      summary.skippedNoTaskCount += 1;
      continue;
    }

    const match = findAccountCandidateSnapshot(account, candidateMatches);
    if (!match) {
      summary.skippedNoSnapshotCount += 1;
      continue;
    }

    summary.matchedCount += 1;
    if (!options.dryRun) {
      await database.updateAccountSourceSnapshot(account.id, match.sourceSnapshot);
      summary.updatedCount += 1;
    }
  }

  return summary;
}

function buildCandidateSnapshotMatches(tasks: CrmAccountSourceSnapshotBackfillTask[]) {
  return tasks.flatMap(task =>
    mapAiLeadTaskResultToCrmImportInputs(task, task.result).flatMap(input => {
      if (!input.sourceSnapshot) return [];

      return [
        {
          taskId: task.id,
          normalizedName: normalizeCrmName(input.name),
          domain: normalizeCrmDomain(input.websiteUrl),
          sourceSnapshot: input.sourceSnapshot
        }
      ];
    })
  );
}

function findAccountCandidateSnapshot(
  account: CrmAccountSourceSnapshotBackfillAccount,
  candidates: CandidateSnapshotMatch[]
) {
  const accountDomain = account.domain ?? normalizeCrmDomain(account.websiteUrl);
  const accountName = account.normalizedName || normalizeCrmName(account.name);

  return (
    candidates.find(candidate => {
      return candidate.taskId === account.sourceTaskId && Boolean(accountDomain) && candidate.domain === accountDomain;
    }) ??
    candidates.find(candidate => {
      return (
        candidate.taskId === account.sourceTaskId && Boolean(accountName) && candidate.normalizedName === accountName
      );
    }) ??
    null
  );
}
