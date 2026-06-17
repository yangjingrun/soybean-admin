export const aiPromptDefinitions = [
  {
    promptKey: 'leadgen',
    title: 'AI 获客'
  },
  {
    promptKey: 'lead_match',
    title: '匹配分析'
  },
  {
    promptKey: 'email_craft',
    title: '开发信生成'
  }
] as const;

export const aiPromptKeys = aiPromptDefinitions.map(item => item.promptKey);

export const defaultAiModelConfigKey = 'default';
