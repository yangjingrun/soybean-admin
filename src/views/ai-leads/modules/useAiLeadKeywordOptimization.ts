import { createDefaultAiLeadExclusionRuleKeys, createDefaultAiLeadTargetCustomerTypeKeys } from './shared';

export interface LeadSearchForm {
  productLineId: string | null;
  targetRegionValues: string[];
  targetRegionLabels: string[];
  targetRegionCountryCodes: string[];
  targetCustomerTypeKeys: string[];
  exclusionRuleKeys: string[];
  keywordText: string;
  requirement: string;
  targetLeadCount: number | null;
  leadSourceMode: Api.AiLeads.LeadSourceMode;
}

/** Create the initial AI lead keyword optimization form state. */
export function createDefaultLeadSearchForm(defaultTargetLeadCount: number): LeadSearchForm {
  return {
    productLineId: null,
    targetRegionValues: [],
    targetRegionLabels: [],
    targetRegionCountryCodes: [],
    targetCustomerTypeKeys: createDefaultAiLeadTargetCustomerTypeKeys(),
    exclusionRuleKeys: createDefaultAiLeadExclusionRuleKeys(),
    keywordText: '',
    requirement: '',
    targetLeadCount: defaultTargetLeadCount,
    leadSourceMode: 'search'
  };
}
