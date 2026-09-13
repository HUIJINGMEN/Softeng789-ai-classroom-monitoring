import type { HealthAlertStatus } from '../types';

// Not folded into lib/format.ts's statusClass() — that function is already tightly typed to a
// bundle of unrelated status unions, and the badge colours here are deliberately a different
// semantic (amber/green/grey, not the events pipeline's blue/red) per this feature's own spec.
export function healthAlertStatusBadge(status: HealthAlertStatus): { className: string; label: string } {
  switch (status) {
    case 'confirmed':
      return { className: 'badge badge--confirmed', label: 'Incident recorded' };
    case 'dismissed':
      return { className: 'badge badge--neutral', label: 'Dismissed' };
    case 'awaiting-review':
    default:
      return { className: 'badge badge--pending-review', label: 'Needs review' };
  }
}
