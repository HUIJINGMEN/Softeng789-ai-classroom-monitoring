import { useState } from 'react';
import type { EventStatus } from '../types';
import { formatIsoDateInAuckland, schoolDateMonthsAgo } from '../lib/sessionTime';

/** Shared filters whose values intentionally persist while users move between console pages. */
export function useConsoleFilters() {
  const [course, setCourse] = useState('All courses');
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'All' | EventStatus>('All');
  // A relative default keeps demo and production data in range as calendar time moves forward.
  const [dateFrom, setDateFrom] = useState(() => schoolDateMonthsAgo(2));
  const [dateTo, setDateTo] = useState(() => formatIsoDateInAuckland(new Date()));

  return {
    course,
    setCourse,
    query,
    setQuery,
    reviewFilter,
    setReviewFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo
  };
}

export type ConsoleFilters = ReturnType<typeof useConsoleFilters>;
