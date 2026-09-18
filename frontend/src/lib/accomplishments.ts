import type { AccomplishmentCategory, AccomplishmentStatus } from '../types';

export const ACCOMPLISHMENT_CATEGORIES: { value: AccomplishmentCategory; label: string }[] = [
  { value: 'PROJECT', label: 'Completed project' },
  { value: 'MILESTONE', label: 'Milestone reached' },
  { value: 'AWARD', label: 'Award' },
  { value: 'IMPROVEMENT', label: 'Significant improvement' },
  { value: 'LEADERSHIP', label: 'Leadership' },
  { value: 'OTHER', label: 'Other achievement' }
];

export function accomplishmentCategoryLabel(category: AccomplishmentCategory): string {
  return ACCOMPLISHMENT_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

export function accomplishmentStatusLabel(status: AccomplishmentStatus): string {
  if (status === 'CONFIRMED') return 'Shared';
  if (status === 'REVOKED') return 'Removed';
  return 'Draft';
}

export function accomplishmentStatusClass(status: AccomplishmentStatus): string {
  if (status === 'CONFIRMED') return 'badge badge--ok';
  if (status === 'REVOKED') return 'badge badge--bad';
  return 'badge badge--neutral';
}

export function formatAccomplishmentPoints(points: number | null): string | null {
  if (points === null) return null;
  return `${Number.isInteger(points) ? points : points.toFixed(2)} points`;
}

export function accomplishmentCorrectionLabel(status: 'PENDING' | 'ACCEPTED' | 'DECLINED'): string {
  if (status === 'ACCEPTED') return 'Updated by your teacher';
  if (status === 'DECLINED') return 'Reviewed by your teacher';
  return 'Waiting for your teacher';
}
