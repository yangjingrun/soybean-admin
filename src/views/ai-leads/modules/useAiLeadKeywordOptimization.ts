export interface LeadSearchForm {
  requirement: string;
  targetLeadCount: number | null;
  leadSourceMode: Api.AiLeads.LeadSourceMode;
}

/** Create the initial AI lead keyword optimization form state. */
export function createDefaultLeadSearchForm(defaultTargetLeadCount: number): LeadSearchForm {
  return {
    requirement: '',
    targetLeadCount: defaultTargetLeadCount,
    leadSourceMode: 'search'
  };
}
