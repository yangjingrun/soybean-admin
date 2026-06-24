import type { CrmAiDraftPrompt, CrmAiDraftPromptInput } from '../crm-ai-draft.types';
import type { CrmAiWritingContext, CrmAiWritingSelectedModule } from './crm-ai-writing-module.types';

export interface CrmAiWritingPromptComposerInput {
  input: CrmAiDraftPromptInput;
  selectedModules: CrmAiWritingSelectedModule[];
  writingContext: CrmAiWritingContext;
  riskNotes: string[];
}

/** Composes the final system and user prompts from global modules and CRM facts. */
export function composeCrmAiWritingPrompt(composerInput: CrmAiWritingPromptComposerInput): CrmAiDraftPrompt {
  const { input, selectedModules, writingContext, riskNotes } = composerInput;
  const modulePrompts = selectedModules
    .map(module =>
      [`## ${module.title} (${module.promptKey})`, `Reason: ${module.reason}`, module.systemPrompt || ''].join('\n')
    )
    .join('\n\n');

  return {
    systemPrompt: [
      'You customize an existing B2B outbound email draft for human review.',
      'Keep the same output language as the base draft unless the input explicitly requires another language.',
      'Start from the base draft structure and wording, then tailor it with the provided CRM facts, matched persona, and step goal.',
      'Return only one valid JSON object with subject, bodyText, reason, riskNotes, usedAngles, usedFacts, nextReviewHints, qualityFlags, and polishChanges.',
      'Do not wrap JSON in Markdown.',
      'Never invent price, MOQ, lead time, certifications, customer references, exclusive claims, or compliance claims.',
      'Use missing fields as missing; do not create fake personalization.',
      'Do not mix languages inside one email unless the base draft already mixes languages.',
      '',
      modulePrompts
    ].join('\n'),
    userPrompt: [
      `Step ${input.stepIndex} of 5.`,
      input.stepIndex > 1
        ? 'Change the angle according to the step prompt and previous messages.'
        : 'Use a relevant first-touch opening.',
      'Do not repeat previous emails.',
      `Template language:\n${normalizeString(input.templateLanguage) || 'en'}`,
      `Sender:\n${input.senderName || 'Sales team'}`,
      '',
      'Null product-line writing config values mean: use the system built-in guidance from the selected global modules.',
      `Product-line writing config:\n${JSON.stringify(
        {
          sequenceStrategy: input.writingConfig.sequenceStrategy ?? null,
          languagePolicy: input.writingConfig.languagePolicy ?? null,
          tone: input.writingConfig.tone ?? null,
          ctaPreference: input.writingConfig.ctaPreference ?? null,
          stepPrompt: getStepPrompt(input)
        },
        null,
        2
      )}`,
      `Base draft to customize:\n${JSON.stringify(input.baseDraft, null, 2)}`,
      `Matched persona:\n${input.persona ? JSON.stringify(input.persona, null, 2) : 'No matched persona.'}`,
      '',
      `Public facts:\n${JSON.stringify(writingContext.publicFacts, null, 2)}`,
      `Previous messages:\n${JSON.stringify(writingContext.previousMessages, null, 2)}`,
      `Review notes:\n${JSON.stringify([...new Set([...writingContext.reviewNotes, ...riskNotes])], null, 2)}`,
      '',
      'Output JSON contract:',
      JSON.stringify(
        {
          subject: 'string',
          bodyText: 'string',
          reason: 'string',
          riskNotes: ['string'],
          usedAngles: ['string'],
          usedFacts: ['fact id'],
          nextReviewHints: ['string'],
          qualityFlags: ['string'],
          polishChanges: ['string']
        },
        null,
        2
      )
    ].join('\n'),
    riskNotes
  };
}

function getStepPrompt(input: CrmAiDraftPromptInput) {
  return input.writingConfig.steps.find(step => step.stepIndex === input.stepIndex)?.prompt || null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
