import { useMemo, useState } from 'react';
import type { SortState } from '../types';

export const PAGE_SIZE = 8;

export function useSort<K extends string>(initialKey: K) {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, dir: 1 });

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

export function usePagination<T>(rows: T[], page: number, setPage: (page: number) => void) {
  return useMemo(() => {
    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(page, pageCount - 1);

    return {
      rows: rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
      label:
        total === 0
          ? 'No records'
          : `Showing ${current * PAGE_SIZE + 1}–${Math.min(total, current * PAGE_SIZE + PAGE_SIZE)} of ${total}`,
      pageLabel: `Page ${current + 1} / ${pageCount}`,
      canPrev: current > 0,
      canNext: current < pageCount - 1,
      prev: () => setPage(Math.max(0, current - 1)),
      next: () => setPage(Math.min(pageCount - 1, current + 1))
    };
  }, [rows, page, setPage]);
}
