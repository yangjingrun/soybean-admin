/** Create the initial AI lead keyword optimization form state. */
export function createDefaultLeadSearchForm(defaultTargetLeadCount) {
  return {
    requirement: '',
    targetLeadCount: defaultTargetLeadCount,
    leadSourceMode: 'search'
  };
}
