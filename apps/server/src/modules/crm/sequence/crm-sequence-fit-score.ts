import type { CrmAccountRecord, CrmContactRecord, CrmProductLineRecord } from '../crm.types';

export interface CrmSequenceFitScoreInput {
  account: Pick<CrmAccountRecord, 'customerType' | 'country' | 'sourceSnapshot'>;
  contact: Pick<CrmContactRecord, 'title' | 'emailStatus'>;
  productLine: Pick<
    CrmProductLineRecord,
    'name' | 'targetCustomerType' | 'coreSellingPoints' | 'commonModelsText' | 'certifications'
  > | null;
}

export interface CrmSequenceFitScoreResult {
  score: number;
  recommendedColdSteps: number;
  canCreateColdSequence: boolean;
  reasons: string[];
}

/** Scores whether a lead has enough factual basis for a cold outreach sequence. */
export function scoreCrmSequenceFit(input: CrmSequenceFitScoreInput): CrmSequenceFitScoreResult {
  const reasons: string[] = [];
  let score = 0;

  score += addScore(Boolean(input.account.customerType), 15, reasons, '公司类型明确');
  score += addScore(
    Boolean(readSnapshotText(input.account.sourceSnapshot, 'website_product_fact')),
    15,
    reasons,
    '有公司产品事实'
  );
  score += addScore(Boolean(input.contact.title), 20, reasons, '联系人职位明确');
  score += addScore(
    Boolean(input.productLine?.coreSellingPoints || input.productLine?.commonModelsText),
    20,
    reasons,
    '产品匹配信息明确'
  );
  score += addScore(
    Boolean(readSnapshotText(input.account.sourceSnapshot, 'recent_trigger')),
    15,
    reasons,
    '有近期触发信号'
  );
  score += normalizeConfidenceScore(input.account.sourceSnapshot);
  score += addScore(Boolean(input.productLine?.certifications), 5, reasons, '有认证或证明材料');

  const recommendedColdSteps = resolveRecommendedColdSteps(score);

  return {
    score,
    recommendedColdSteps,
    canCreateColdSequence: recommendedColdSteps > 0 && input.contact.emailStatus !== 'invalid',
    reasons
  };
}

function addScore(condition: boolean, points: number, reasons: string[], reason: string) {
  if (condition) reasons.push(reason);
  return condition ? points : 0;
}

function normalizeConfidenceScore(snapshot?: Record<string, unknown> | null) {
  const raw = snapshot?.confidence_score;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  if (raw >= 80) return 10;
  if (raw >= 60) return 6;
  if (raw >= 40) return 3;
  return 0;
}

function readSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const value = snapshot?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveRecommendedColdSteps(score: number) {
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 0;
}
