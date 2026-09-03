import { useState } from 'react';
import { usePagination } from '../lib/table';

/** Shared by the three "collapsed list → Show all → Pager" sections on StudentProfile (courses,
 *  attendance, events) — each paired a usePagination call with an identical show-more/pager
 *  toggle; this just centralises that pairing so a future change to the toggle only needs to
 *  happen once. */
export function useExpandablePage<T>(items: T[], pageSize: number) {
  const [showingAll, setShowingAll] = useState(false);
  const [page, setPage] = useState(0);
  const paged = usePagination(items, page, setPage, pageSize);
  const visibleItems = showingAll ? paged.rows : items.slice(0, pageSize);
  const hasMore = items.length > pageSize;

  return {
    visibleItems,
    showingAll,
    showAll: () => setShowingAll(true),
    hasMore,
    paged
  };
}
