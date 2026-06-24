export interface CrmAiDraftQualityInput {
  stepIndex: number;
  subject: string;
  bodyText: string;
  usedFacts: string[];
  allowedFactIds: string[];
}

export interface CrmAiDraftQualityResult {
  qualityFlags: string[];
  shouldPolish: boolean;
}

export interface CrmAiPolishCandidateInput {
  base: {
    subject: string;
    bodyText: string;
    usedFacts: string[];
  };
  polished: {
    subject: string;
    bodyText: string;
    usedFacts: string[];
  };
}

export interface CrmAiPolishCandidateResult {
  acceptable: boolean;
  qualityFlags: string[];
}

const aiishPhrasePattern =
  /\b(i hope this email finds you well|i came across your profile|my name is|i wanted to reach out)\b/i;
const weakFollowUpPattern = /\b(just checking in|bumping this up|did you see my last email)\b/i;
const meetingCtaPattern = /\b(schedule|book|set up)\s+(a\s+)?(meeting|call|demo)\b/i;
const questionPattern = /\?/g;
const ctaIntentPatterns = [
  /\bwho\s+(handles|owns|is responsible for)\b/i,
  /\b(schedule|book|set up)\s+(a\s+)?(meeting|call|demo)\b/i,
  /\bcan\s+(you|we)\b/i,
  /\bcould\s+you\b/i,
  /\bwould\s+this\b/i
];

/** Runs deterministic checks that should not require another model call. */
export function checkCrmAiDraftQuality(input: CrmAiDraftQualityInput): CrmAiDraftQualityResult {
  const qualityFlags: string[] = [];
  const subjectWords = input.subject.trim().split(/\s+/).filter(Boolean);
  const invalidFacts = input.usedFacts.filter(factId => !input.allowedFactIds.includes(factId));

  if (aiishPhrasePattern.test(input.bodyText)) qualityFlags.push('发现 AI 味开头或模板句');
  if (subjectWords.length > 6) qualityFlags.push('主题过长，建议控制在 2-6 个词');
  if (countCtaIntents(input.bodyText) > 1 || (input.bodyText.match(questionPattern)?.length ?? 0) > 1) {
    qualityFlags.push('疑似包含多个 CTA');
  }
  if (invalidFacts.length > 0) qualityFlags.push(`引用了不存在的 fact id: ${invalidFacts.join(', ')}`);
  if (input.stepIndex > 1 && weakFollowUpPattern.test(input.bodyText)) qualityFlags.push('follow-up 包含无价值跟进句');

  return {
    qualityFlags,
    shouldPolish: qualityFlags.some(flag => flag.includes('AI 味') || flag.includes('无价值跟进句'))
  };
}

function countCtaIntents(bodyText: string) {
  return ctaIntentPatterns.reduce((count, pattern) => count + (pattern.test(bodyText) ? 1 : 0), 0);
}

/** Checks whether a polished draft stayed within the first draft's facts and CTA level. */
export function checkCrmAiPolishCandidate(input: CrmAiPolishCandidateInput): CrmAiPolishCandidateResult {
  const qualityFlags: string[] = [];
  const baseFactIds = new Set(input.base.usedFacts);
  const newFactIds = input.polished.usedFacts.filter(factId => !baseFactIds.has(factId));

  if (newFactIds.length > 0) {
    qualityFlags.push(`润色版新增了首版未使用的 fact id: ${newFactIds.join(', ')}`);
  }

  if (!meetingCtaPattern.test(input.base.bodyText) && meetingCtaPattern.test(input.polished.bodyText)) {
    qualityFlags.push('润色版疑似把 CTA 升级为会议邀约');
  }

  return {
    acceptable: qualityFlags.length === 0,
    qualityFlags
  };
}
