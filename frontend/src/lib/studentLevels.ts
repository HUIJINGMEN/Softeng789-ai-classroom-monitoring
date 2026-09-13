import type { StudentLevel } from '../types';

export const STUDENT_LEVEL_OPTIONS: { value: StudentLevel; label: string }[] = [
  { value: 'LEVEL_1', label: 'Level 1' },
  { value: 'LEVEL_2', label: 'Level 2' },
  { value: 'LEVEL_3', label: 'Level 3' },
  { value: 'LEVEL_4', label: 'Level 4' }
];

export function studentLevelLabel(level: StudentLevel): string {
  return STUDENT_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

/** A class's roster can span more than one level — this collapses that into one compact string
 *  for a table cell: a single level reads as "Level 2", a spread reads as a "Level 1–3" range
 *  (levels are only ever LEVEL_1..LEVEL_4, so min/max is a meaningful range, not an arbitrary
 *  sort), and no students yet reads as nothing rather than a misleading "Level 1" default. */
export function summarizeLevels(levels: readonly StudentLevel[]): string | null {
  if (levels.length === 0) return null;
  const indexes = levels.map((level) => STUDENT_LEVEL_OPTIONS.findIndex((option) => option.value === level));
  const min = Math.min(...indexes);
  const max = Math.max(...indexes);
  if (min === max) return STUDENT_LEVEL_OPTIONS[min].label;
  return `${STUDENT_LEVEL_OPTIONS[min].label}–${STUDENT_LEVEL_OPTIONS[max].label.replace('Level ', '')}`;
}
