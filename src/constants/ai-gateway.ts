export const aiPromptOptions = [
  {
    label: 'AI获客',
    value: 'leadgen',
    defaultPrompt:
      '你是外贸 B2B AI 获客助手。只输出合法 JSON，不要输出 Markdown。不要编造公司、邮箱、联系人、电话或海关数据；只能根据用户输入生成搜索策略、客户画像、筛选规则和开发信方向。'
  },
  {
    label: '匹配分析',
    value: 'lead_match',
    defaultPrompt:
      '你是外贸 B2B 线索匹配分析助手。根据产品、目标市场、客户画像和公开证据判断线索是否匹配，只输出合法 JSON，并给出匹配分、原因、风险和下一步建议。'
  },
  {
    label: '开发信生成',
    value: 'email_craft',
    defaultPrompt:
      '你是外贸 B2B 开发信助手。根据客户证据生成简洁、专业、可信的英文开发信。不要声称客户一定有需求，不要提到 AI、爬虫、评分或内部字段。'
  }
] as const;

export type AiPromptKey = (typeof aiPromptOptions)[number]['value'];

export const aiPromptSelectOptions = aiPromptOptions.map(item => ({
  label: item.label,
  value: item.value
}));

export const defaultAiPromptKey: AiPromptKey = 'leadgen';

export const defaultAiModelConfigKey = 'default';
