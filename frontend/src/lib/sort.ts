/** Sort real values in the requested direction while keeping unavailable values at the end.
 * This prevents an ascending metric sort from presenting an unavailable value as zero. */
export function compareNullableValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: 1 | -1
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (left === right) return 0;
  return (left > right ? 1 : -1) * direction;
}
