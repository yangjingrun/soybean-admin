const configHintRules = [
  { test: /serper/i, target: { tab: 'serper', label: '去配置 Serper' } },
  { test: /hunter/i, target: { tab: 'hunter', label: '去配置 Hunter' } },
  { test: /模型|model|api\s*key|apikey|通道|ai\s*网关/i, target: { tab: 'model', label: '去配置模型通道' } }
];
/** Resolves which AI settings tab a hint/error points to; returns null when not config related. */
export function resolveConfigHintTarget(message) {
  const text = message?.trim();
  if (!text) {
    return null;
  }
  return configHintRules.find(rule => rule.test.test(text))?.target ?? null;
}
