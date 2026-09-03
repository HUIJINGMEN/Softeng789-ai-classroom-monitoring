// Mirrors lib/healthAlertStatus.ts's shape — kept as its own tiny mapper rather than folded into
// lib/format.ts's statusClass(), which is already tightly typed to a bundle of unrelated status
// unions.
export function classStatusBadge(status: 'ACTIVE' | 'ARCHIVED'): { className: string; label: string } {
  return status === 'ACTIVE'
    ? { className: 'badge badge--present', label: 'Active' }
    : { className: 'badge badge--neutral', label: 'Archived' };
}
