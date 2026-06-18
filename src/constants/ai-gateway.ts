export const aiPromptOptions = [
  {
    label: '关键词优化',
    value: 'lead_keyword_optimize',
    usage: 'AI获客第一步，将自然语言获客需求优化成 Serper Search / Maps 查询包。'
  },
  {
    label: '匹配分析',
    value: 'lead_match_analyze',
    usage: 'AI获客后续步骤，判断线索是否匹配并给出原因和风险。'
  },
  {
    label: '开发信生成',
    value: 'lead_email_generate',
    usage: 'AI获客后续步骤，根据客户证据生成开发信。'
  }
] as const;

export type AiPromptKey = (typeof aiPromptOptions)[number]['value'];

export const defaultAiPromptKey: AiPromptKey = 'lead_keyword_optimize';

export const defaultAiModelConfigKey = 'default';

export const leadKeywordOptimizePromptKey: AiPromptKey = 'lead_keyword_optimize';
