/** Sort keyword history records by updated time, newest first. */
export function sortKeywordHistoryRecords(records) {
  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
