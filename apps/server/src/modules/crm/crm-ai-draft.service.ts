import { Inject, Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../shared/request-context';
import { defaultAiModelConfigKey } from '../ai-gateway/ai-gateway.constants';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { buildCrmAiDraftPrompt, parseCrmAiDraftOutput } from './crm-ai-draft-prompt';
import type { CrmAiDraftGenerateResult, CrmAiDraftPromptInput } from './crm-ai-draft.types';
import { buildCrmAiWritingContext } from './ai-writing/crm-ai-writing-context';
import { resolveCrmAiWritingModules } from './ai-writing/crm-ai-writing-module-resolver';
import { checkCrmAiDraftQuality, checkCrmAiPolishCandidate } from './ai-writing/crm-ai-writing-quality-check';
import type { CrmAiWritingSelectedModule } from './ai-writing/crm-ai-writing-module.types';
import type { CrmAiDraftOutput } from './crm-ai-draft.types';

const crmAiPolishModuleKeys = [
  'crm_outreach_ai_polish',
  'crm_outreach_public_source_grounding',
  'crm_outreach_deliverability_guard',
  'crm_outreach_output_contract'
] as const;

@Injectable()
export class CrmAiDraftService {
  constructor(
    @Inject(AiGatewayService) private readonly aiGatewayService: Pick<AiGatewayService, 'generateText' | 'getPrompt'>
  ) {}

  /** Generates a review-only CRM draft from product-line AI writing configuration. */
  async generateDraft(input: CrmAiDraftPromptInput, context: RequestUserContext): Promise<CrmAiDraftGenerateResult> {
    const writingContext = buildCrmAiWritingContext(input);
    const selectedModules = await this.loadPromptModules(
      resolveCrmAiWritingModules({
        stepIndex: input.stepIndex,
        contactTitle: input.contact.title,
        account: input.account,
        previousMessages: input.previousMessages
      })
    );
    const prompt = buildCrmAiDraftPrompt(input, { selectedModules, writingContext });
    const result = await this.aiGatewayService.generateText(
      {
        prompt: prompt.userPrompt,
        systemPrompt: prompt.systemPrompt,
        modelConfigKey: defaultAiModelConfigKey,
        temperature: 0.4,
        maxOutputTokens: 1600
      },
      { user: context }
    );
    const firstOutput = parseCrmAiDraftOutput(result.text);
    const quality = checkCrmAiDraftQuality({
      stepIndex: input.stepIndex,
      subject: firstOutput.subject,
      bodyText: firstOutput.bodyText,
      usedFacts: firstOutput.usedFacts,
      allowedFactIds: writingContext.publicFacts.map(fact => fact.id)
    });
    const output = await this.maybePolishDraft({
      input,
      context,
      selectedModules,
      firstOutput: {
        ...firstOutput,
        qualityFlags: [...new Set([...firstOutput.qualityFlags, ...quality.qualityFlags])]
      },
      shouldPolish: quality.shouldPolish
    });
    const riskNotes = [...new Set([...prompt.riskNotes, ...output.riskNotes])];
    const qualityFlags = [...new Set(output.qualityFlags)];

    return {
      ...output,
      riskNotes,
      qualityFlags,
      metadata: {
        generated: true,
        reason: output.reason,
        riskNotes,
        snapshot: {
          productLineId: input.productLine.id,
          productLineName: input.productLine.name,
          stepIndex: input.stepIndex,
          writingConfig: input.writingConfig,
          reason: output.reason,
          riskNotes,
          selectedModules: selectedModules.map(({ promptKey, title, reason, updatedAt }) => ({
            promptKey,
            title,
            reason,
            updatedAt: updatedAt ?? null
          })),
          publicFacts: writingContext.publicFacts,
          usedAngles: output.usedAngles,
          usedFacts: output.usedFacts,
          nextReviewHints: output.nextReviewHints,
          qualityFlags,
          polishChanges: output.polishChanges,
          generatedAt: new Date().toISOString()
        }
      }
    };
  }

  private async maybePolishDraft(input: {
    input: CrmAiDraftPromptInput;
    context: RequestUserContext;
    selectedModules: Array<{ promptKey: string; title: string; systemPrompt?: string }>;
    firstOutput: CrmAiDraftOutput;
    shouldPolish: boolean;
  }): Promise<CrmAiDraftOutput> {
    const policy = input.input.writingConfig.polishPolicy ?? 'auto_when_flagged';

    if (policy === 'off' || (policy === 'auto_when_flagged' && !input.shouldPolish)) {
      return input.firstOutput;
    }

    const polishModules = await this.loadPromptModules(
      crmAiPolishModuleKeys.map(promptKey => ({
        promptKey,
        title: resolvePolishModuleTitle(promptKey),
        reason: 'Required for one-pass expression polish without changing facts, promises, or CTA.'
      }))
    );
    const polishPrompt = [
      'Rewrite only subject and bodyText to sound natural.',
      'Keep facts, promises, CTA, reason, riskNotes, usedAngles, usedFacts, and review hints unchanged.',
      'Return the same strict JSON contract.',
      '',
      JSON.stringify(input.firstOutput, null, 2)
    ].join('\n');
    const result = await this.aiGatewayService.generateText(
      {
        prompt: polishPrompt,
        systemPrompt: composePolishSystemPrompt(polishModules),
        modelConfigKey: defaultAiModelConfigKey,
        temperature: 0.4,
        maxOutputTokens: 1600
      },
      { user: input.context }
    );
    const polished = parseCrmAiDraftOutput(result.text);
    const polishCheck = checkCrmAiPolishCandidate({
      base: input.firstOutput,
      polished
    });

    if (!polishCheck.acceptable) {
      return {
        ...input.firstOutput,
        qualityFlags: [...new Set([...input.firstOutput.qualityFlags, ...polishCheck.qualityFlags])]
      };
    }

    return {
      ...polished,
      qualityFlags: [...new Set([...polished.qualityFlags, ...polishCheck.qualityFlags])]
    };
  }

  private async loadPromptModules(modules: CrmAiWritingSelectedModule[]): Promise<CrmAiWritingSelectedModule[]> {
    return Promise.all(
      modules.map(async module => {
        const prompt = await this.aiGatewayService.getPrompt(module.promptKey);

        return {
          ...module,
          title: prompt.title || module.title,
          systemPrompt: prompt.systemPrompt,
          updatedAt: prompt.updatedAt
        };
      })
    );
  }
}

function composePolishSystemPrompt(modules: CrmAiWritingSelectedModule[]) {
  return [
    'Polish one CRM outbound email draft exactly once.',
    'Do not add facts, promises, CTA intents, riskNotes, usedFacts, or review hints.',
    '',
    modules
      .map(module =>
        [`## ${module.title} (${module.promptKey})`, `Reason: ${module.reason}`, module.systemPrompt || ''].join('\n')
      )
      .join('\n\n')
  ].join('\n');
}

function resolvePolishModuleTitle(promptKey: (typeof crmAiPolishModuleKeys)[number]) {
  const titles: Record<(typeof crmAiPolishModuleKeys)[number], string> = {
    crm_outreach_ai_polish: 'AI 味润色',
    crm_outreach_public_source_grounding: '公开资料事实约束',
    crm_outreach_deliverability_guard: '送达率保护',
    crm_outreach_output_contract: '输出结构契约'
  };

  return titles[promptKey];
}
