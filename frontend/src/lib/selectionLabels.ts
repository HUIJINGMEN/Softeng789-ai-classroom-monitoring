/** Shared wording for class roster pickers; selection and saving remain owned by each flow. */
export function addSelectionLabel(noun: 'student' | 'teacher', count: number, busy: boolean): string {
  if (busy) return 'Adding…';
  if (count === 0) return `Add ${noun}s`;
  const suffix = count === 1 ? '' : 's';
  return `Add ${count} ${noun}${suffix}`;
}
