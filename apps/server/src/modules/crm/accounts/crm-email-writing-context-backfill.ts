import {
  buildFallbackAiLeadEmailWritingContext,
  normalizeAiLeadEmailWritingContext
} from '../../ai-leads/ai-lead-email-writing-context';
import { normalizeAiLeadProductLineSnapshot } from '../../ai-leads/ai-lead-product-line-context';
import type {
  AiLeadPrecisionAnalysis,
  AiLeadWebsiteEvidence
} from '../../ai-leads/ai-lead-website-crawler.types';

export interface CrmEmailWritingContextBackfillAccount {
  id: string;
  sourceSnapshot: Record<string, unknown> | null;
}

export interface CrmEmailWritingContextBackfillDatabase {
  findAccountsMissingEmailWritingContext(): Promise<CrmEmailWritingContextBackfillAccount[]>;
  updateAccountSourceSnapshot(id: string, sourceSnapshot: Record<string, unknown>): Promise<unknown>;
}

export interface CrmEmailWritingContextBackfillOptions {
  dryRun?: boolean;
}

export interface CrmEmailWritingContextBackfillSummary {
  scannedAccountCount: number;
  updatedCount: number;
  skippedNoSnapshotCount: number;
  skippedAlreadyHasContextCount: number;
  skippedNoContextCount: number;
}

/** Backfills AI 写信用客户资料 from existing CRM sourceSnapshot JSON only. */
export async function backfillCrmEmailWritingContexts(
  database: CrmEmailWritingContextBackfillDatabase,
  options: CrmEmailWritingContextBackfillOptions = {}
): Promise<CrmEmailWritingContextBackfillSummary> {
  const accounts = await database.findAccountsMissingEmailWritingContext();
  const summary: CrmEmailWritingContextBackfillSummary = {
    scannedAccountCount: accounts.length,
    updatedCount: 0,
    skippedNoSnapshotCount: 0,
    skippedAlreadyHasContextCount: 0,
    skippedNoContextCount: 0
  };

  for (const account of accounts) {
    const sourceSnapshot = readRecord(account.sourceSnapshot);
    if (!sourceSnapshot) {
      summary.skippedNoSnapshotCount += 1;
      continue;
    }

    if (normalizeAiLeadEmailWritingContext(sourceSnapshot.emailWritingContext)) {
      summary.skippedAlreadyHasContextCount += 1;
      continue;
    }

    const emailWritingContext = buildFallbackAiLeadEmailWritingContext({
      websiteEvidence: readRecord(sourceSnapshot.websiteEvidence) as AiLeadWebsiteEvidence | null,
      precisionAnalysis: readRecord(sourceSnapshot.precisionAnalysis) as AiLeadPrecisionAnalysis | null,
      productLineSnapshot: normalizeAiLeadProductLineSnapshot(sourceSnapshot.productLine),
      candidate: {
        title: sourceSnapshot.title,
        snippet: sourceSnapshot.snippet,
        website: sourceSnapshot.website,
        url: sourceSnapshot.url
      }
    });

    if (!emailWritingContext) {
      summary.skippedNoContextCount += 1;
      continue;
    }

    if (!options.dryRun) {
      await database.updateAccountSourceSnapshot(account.id, {
        ...sourceSnapshot,
        emailWritingContext
      });
      summary.updatedCount += 1;
    }
  }

  return summary;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
