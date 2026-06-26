import type { CrmAiWritingModuleResolveInput, CrmAiWritingSelectedModule } from './crm-ai-writing-module.types';
import { resolveCrmAiWritingStepPromptKey } from './crm-ai-writing-prompt-template';

const stepModuleTitles: Record<number, string> = {
  1: '通用模板第 1 封：相关性与初始价值',
  2: '通用模板第 2 封：具体产品或采购判断',
  3: '通用模板第 3 封：采购风险与验证路径',
  4: '通用模板第 4 封：选择题跟进',
  5: '通用模板第 5 封：轻退出与未来入口'
};

const baseModules: CrmAiWritingSelectedModule[] = [
  {
    promptKey: 'crm_outreach_base_rules',
    title: 'CRM 开发信基础规则',
    reason: 'Required for factual boundaries, one CTA, and human-review output.'
  },
  {
    promptKey: 'crm_outreach_cold_email_core',
    title: '冷邮件核心方法',
    reason: 'Required for relevance, personalization, and low-friction outbound structure.'
  },
  {
    promptKey: 'crm_outreach_sequence_strategy',
    title: '序列跟进策略',
    reason: 'Required to align this email with the 1-5 step sequence.'
  },
  {
    promptKey: 'crm_outreach_public_source_grounding',
    title: '公开资料事实约束',
    reason: 'Required so the model only uses CRM and public-source facts.'
  },
  {
    promptKey: 'crm_outreach_subject_line',
    title: '主题行规则',
    reason: 'Required for short, natural, low-risk subject lines.'
  },
  {
    promptKey: 'crm_outreach_deliverability_guard',
    title: '送达率保护',
    reason: 'Required to avoid spammy wording, pressure, and weak follow-ups.'
  },
  {
    promptKey: 'crm_outreach_output_contract',
    title: '输出结构契约',
    reason: 'Required for strict JSON and review metadata fields.'
  }
];

/** Selects the global prompt modules that should shape one CRM AI draft. */
export function resolveCrmAiWritingModules(input: CrmAiWritingModuleResolveInput): CrmAiWritingSelectedModule[] {
  const modules = baseModules.map(module => ({ ...module }));
  const roleBucket = resolveRoleBucket(input.contactTitle);
  const stepPromptKey = resolveCrmAiWritingStepPromptKey({
    templateKey: input.promptTemplateKey,
    stepIndex: input.stepIndex
  });

  modules.splice(3, 0, {
    promptKey: stepPromptKey,
    title: stepModuleTitles[input.stepIndex],
    reason: `Required published prompt template for CRM outreach step ${input.stepIndex}.`
  });

  if (input.stepIndex > 1 || input.previousMessages.length > 0) {
    const sequenceModule = modules.find(module => module.promptKey === 'crm_outreach_sequence_strategy');
    if (sequenceModule) {
      sequenceModule.reason = `Required follow-up strategy for step ${input.stepIndex}; follow-up must add a new value angle.`;
    }
  }

  if (roleBucket) {
    modules.splice(3, 0, {
      promptKey: 'crm_outreach_role_persona',
      title: '职位画像',
      reason: `Emphasize ${roleBucket} persona guidance from the contact title.`
    });
  }

  if (input.account.country || input.account.city || input.account.timeZone) {
    modules.splice(roleBucket ? 4 : 3, 0, {
      promptKey: 'crm_outreach_region_localization',
      title: '地区本地化',
      reason: 'Account has country, city, or timezone context that can shape wording.'
    });
  }

  return modules;
}

function resolveRoleBucket(title: string | null) {
  const normalized = title?.trim().toLowerCase();
  if (!normalized) return null;

  if (/\b(founder|ceo|owner|president|general manager)\b/.test(normalized)) return 'founder_ceo';
  if (/\b(sales|business development|bd|commercial)\b/.test(normalized)) return 'sales_bd';
  if (/\b(procurement|purchas|sourcing|buyer|supply chain)\b/.test(normalized)) return 'procurement_sourcing';
  if (/\b(operation|ops|logistics|warehouse|plant|production)\b/.test(normalized)) return 'operations';
  if (/\b(marketing|growth|demand generation|brand)\b/.test(normalized)) return 'marketing';

  return 'unknown_title';
}
