import { hasPermission } from '@soybean/shared';
/** Build permission-aware CRM settings tab visibility to keep member setup focused. */
export function buildCrmSettingsTabVisibility(input) {
  const hasPlatformRulePermission =
    hasPermission(input, 'crm:settings:global:write') || hasPermission(input, 'crm:settings:ai-draft-queue:write');
  return {
    assets: hasPermission(input, 'crm:settings:assets:read') || hasPermission(input, 'crm:settings:assets:write'),
    operations: hasPermission(input, 'crm:settings:operations:write'),
    rules:
      hasPlatformRulePermission ||
      hasPermission(input, 'crm:settings:rules:read') ||
      hasPermission(input, 'crm:settings:rules:write'),
    safety: hasPermission(input, 'crm:settings:safety:read') || hasPermission(input, 'crm:settings:safety:write'),
    start: true
  };
}
