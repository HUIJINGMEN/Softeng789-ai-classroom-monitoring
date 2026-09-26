import { useCallback } from 'react';
import {
  listBehaviourEventsPage,
  type BehaviourEventPageFilters
} from '../lib/behaviourEventApi';
import type { CandidateEvent } from '../types';
import { usePagedResource } from './usePagedResource';

const keepEvent = (event: CandidateEvent) => event;

export function useBehaviourEventPage(
  page: number,
  size: number,
  filters: BehaviourEventPageFilters,
  refreshKey: string
) {
  const {
    reviewStatus,
    course,
    sessionId,
    eventType,
    dateFrom,
    dateTo
  } = filters;
  const loadPage = useCallback(
    () => listBehaviourEventsPage(page, size, {
      reviewStatus,
      course,
      sessionId,
      eventType,
      dateFrom,
      dateTo
    }),
    [course, dateFrom, dateTo, eventType, page, refreshKey, reviewStatus, sessionId, size]
  );
  return usePagedResource(size, loadPage, keepEvent, 'AI observations');
}
