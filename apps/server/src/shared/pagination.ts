export interface PageResult<T> {
  current: number;
  size: number;
  total: number;
  records: T[];
}

/** Build the project-standard pagination payload. */
export function createPageResult<T>(input: PageResult<T>): PageResult<T> {
  return {
    current: input.current,
    size: input.size,
    total: input.total,
    records: input.records
  };
}
