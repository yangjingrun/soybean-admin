/** Trims string DTO values while leaving non-string values for validators to reject. */
export function trimStringValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}
