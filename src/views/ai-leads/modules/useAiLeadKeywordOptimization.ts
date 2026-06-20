export interface LeadSearchForm {
  requirement: string;
  targetLeadCount: number | null;
}

/** Create the initial AI lead keyword optimization form state. */
export function createDefaultLeadSearchForm(defaultTargetLeadCount: number): LeadSearchForm {
  return {
    requirement: '',
    targetLeadCount: defaultTargetLeadCount
  };
}
