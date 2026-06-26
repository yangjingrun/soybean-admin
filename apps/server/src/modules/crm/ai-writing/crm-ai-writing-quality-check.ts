export interface CrmAiDraftQualityInput {
  stepIndex: number;
  subject: string;
  bodyText: string;
  usedFacts: string[];
  allowedFactIds: string[];
  stepStrategy?: {
    wordRange: { min: number; max: number };
    taskDescription: string;
  };
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
const weakPersonalizationPattern =
  /\b(came up as a company|is based in|are based in|i found your company|i noticed your website|i noticed your company)\b/i;
const weakFollowUpPattern = /\b(just checking in|bumping this up|did you see my last email)\b/i;
const genericListCtaPattern =
  /\b(short|brief|quick)\s+(model|product|range)?\s*(list|selection|overview)\b|\b(regular model list|2-3 regular options|3-5 common models|product overview|model overview|range overview)\b/i;
const customerTypeLabelPattern =
  /\b(for|as|some|many)\s+(a\s+|an\s+)?(bearing\s+|industrial\s+)?(distributors?|importers?|stockists?|wholesalers?|dealers?|retailers?|traders?)\b|\bworks\s+in\s+(distributors?|importers?|stockists?|wholesalers?|dealers?|retailers?|traders?)\b/i;
const bearingContextPattern =
  /\bbearings?\b|\b620\d\b|\b63\d\d\b|\b30[23]\d\b|\bUC\d+\b|\bUCP\b|\bNU\b|\bNJ\b|\bNUP\b/i;
const bearingModelPattern =
  /\bbearing\s+models?\b|\bmodels?\s+(to compare|for bearings?|under discussion|you compare)\b/i;
const bearingGenericFitPattern = /\b(fit|fits|good fit|perfect fit|closest fit)\b/i;
const bearingUnsafeEquivalentPattern = /\bequivalent(?:s| options?| models?)\b/i;
const bearingUnverifiedStockPattern =
  /\b(in stock|ready stock|immediate stock|stable stock|stock options?|stock gaps?)\b/i;
const bearingDrawingMatchPattern = /\bdrawing-based matching\b/i;
const meetingCtaPattern = /\b(schedule|book|set up)\s+(a\s+)?(meeting|call|demo)\b/i;
const spamRiskPattern =
  /\b(urgent|last chance|act now|guaranteed|100% results|best price|huge discount|free offer)\b|!{2,}|^(re|fwd):/i;
const emojiPattern = /\p{Extended_Pictographic}/u;
const linkPattern = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
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
  const wordCount = countEnglishWords(input.bodyText);
  const paragraphCount = countParagraphs(input.bodyText);
  const linkCount = input.bodyText.match(linkPattern)?.length ?? 0;

  if (aiishPhrasePattern.test(input.bodyText)) qualityFlags.push('发现 AI 味开头或模板句');
  if (weakPersonalizationPattern.test(input.bodyText)) {
    qualityFlags.push('开头个性化较弱，建议改成职位相关的业务场景');
  }
  if (customerTypeLabelPattern.test(input.bodyText)) {
    qualityFlags.push('直接把客户类型标签写给客户，建议改成职位相关的采购/供应场景');
  }
  if (genericListCtaPattern.test(input.bodyText)) {
    qualityFlags.push('CTA 疑似使用 generic list/overview，建议改成一个具体判断对象');
  }
  if (bearingContextPattern.test(`${input.subject}\n${input.bodyText}`)) {
    if (bearingModelPattern.test(input.bodyText)) {
      qualityFlags.push('轴承邮件疑似把标准编号称为 model，建议改成 designation');
    }
    if (bearingGenericFitPattern.test(input.bodyText)) {
      qualityFlags.push('轴承邮件疑似泛化使用 fit，建议改成 relevant、worth comparing 或 supply option');
    }
    if (bearingUnsafeEquivalentPattern.test(input.bodyText)) {
      qualityFlags.push('轴承邮件疑似无依据使用 equivalent，建议改成 replacement option 或 cross-reference candidate');
    }
    if (bearingUnverifiedStockPattern.test(input.bodyText)) {
      qualityFlags.push('轴承邮件疑似写了未验证 stock，建议改成 availability 或 supply coverage');
    }
    if (bearingDrawingMatchPattern.test(input.bodyText)) {
      qualityFlags.push('轴承邮件疑似默认使用 drawing-based matching，标准轴承优先 designation-based matching');
    }
  }
  if (subjectWords.length > 6) qualityFlags.push('主题过长，建议控制在 2-6 个词');
  if (input.stepStrategy && wordCount > input.stepStrategy.wordRange.max) {
    qualityFlags.push(
      `正文过长，建议控制在 ${input.stepStrategy.wordRange.min}-${input.stepStrategy.wordRange.max} 个英文词`
    );
  }
  if (paragraphCount > 3) qualityFlags.push('正文段落过多，建议 1-2 个主要短段落');
  if (spamRiskPattern.test(input.subject) || spamRiskPattern.test(input.bodyText)) {
    qualityFlags.push('主题含高风险营销或紧迫表达');
  }
  if (input.stepIndex === 1 && linkCount > 0) qualityFlags.push('首封包含链接，建议先获得兴趣再发送资料');
  if (emojiPattern.test(input.subject) || emojiPattern.test(input.bodyText)) {
    qualityFlags.push('工业 B2B 首封默认不使用 Emoji');
  }
  if (countCtaIntents(input.bodyText) > 1 || (input.bodyText.match(questionPattern)?.length ?? 0) > 1) {
    qualityFlags.push('疑似包含多个 CTA');
  }
  if (invalidFacts.length > 0) qualityFlags.push(`引用了不存在的 fact id: ${invalidFacts.join(', ')}`);
  if (input.stepIndex > 1 && weakFollowUpPattern.test(input.bodyText)) qualityFlags.push('follow-up 包含无价值跟进句');

  return {
    qualityFlags,
    shouldPolish: qualityFlags.some(
      flag =>
        flag.includes('AI 味') ||
        flag.includes('个性化较弱') ||
        flag.includes('客户类型标签') ||
        flag.includes('generic list') ||
        flag.includes('轴承邮件') ||
        flag.includes('无价值跟进句') ||
        flag.includes('正文过长') ||
        flag.includes('正文段落过多') ||
        flag.includes('主题过长')
    )
  };
}

function countCtaIntents(bodyText: string) {
  return ctaIntentPatterns.reduce((count, pattern) => count + (pattern.test(bodyText) ? 1 : 0), 0);
}

function countEnglishWords(text: string) {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g) ?? []).length;
}

function countParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean).length;
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
