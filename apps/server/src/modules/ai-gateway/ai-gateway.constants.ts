export const aiPromptDefinitions = [
  {
    promptKey: 'lead_keyword_optimize',
    title: '关键词优化',
    usage: 'AI获客第一步，将自然语言获客需求优化成可执行关键词和搜索方向。'
  },
  {
    promptKey: 'lead_match_analyze',
    title: '匹配分析',
    usage: 'AI获客后续步骤，判断线索是否匹配并给出原因和风险。'
  },
  {
    promptKey: 'lead_email_generate',
    title: '开发信生成',
    usage: 'AI获客后续步骤，根据客户证据生成开发信。'
  }
] as const;

export const aiPromptKeys = aiPromptDefinitions.map(item => item.promptKey);

export const defaultAiModelConfigKey = 'default';
export const defaultAiTemperature = 0.2;

export const leadKeywordOptimizePromptKey = 'lead_keyword_optimize';
