import { useMemo, useState } from 'react';
import type { SortState } from '../types';

export const PAGE_SIZE = 8;

export function useSort<K extends string>(initialKey: K, initialDirection: 1 | -1 = 1) {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, dir: initialDirection });

  const toggle = (key: K) =>
    setSort((current) => ({ key, dir: current.key === key ? ((current.dir * -1) as 1 | -1) : 1 }));

  return { sort, toggle };
}

export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessor: (row: T, key: K) => string | number
): T[] {
  return [...rows].sort((a, b) => {
    const left = accessor(a, sort.key);
    const right = accessor(b, sort.key);
    if (left === right) return 0;
    return (left > right ? 1 : -1) * sort.dir;
  });
}

/** Sort real values in the requested direction while keeping unavailable values at the end.
 *  This prevents an ascending attendance sort from presenting "Not available" as the lowest
 *  performer, which would incorrectly imply a measured zero. */
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

export function usePagination<T>(
  rows: T[],
  page: number,
  setPage: (page: number) => void,
  pageSize: number = PAGE_SIZE
) {
  return useMemo(() => {
    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, pageCount - 1);

    return {
      rows: rows.slice(current * pageSize, current * pageSize + pageSize),
      label:
        total === 0
          ? 'No records'
          : `Showing ${current * pageSize + 1}–${Math.min(total, current * pageSize + pageSize)} of ${total}`,
      pageLabel: `Page ${current + 1} / ${pageCount}`,
      page: current,
      pageCount,
      canPrev: current > 0,
      canNext: current < pageCount - 1,
      prev: () => setPage(Math.max(0, current - 1)),
      next: () => setPage(Math.min(pageCount - 1, current + 1)),
      goToPage: (target: number) => setPage(Math.max(0, Math.min(pageCount - 1, target)))
    };
  }, [rows, page, setPage, pageSize]);
}
