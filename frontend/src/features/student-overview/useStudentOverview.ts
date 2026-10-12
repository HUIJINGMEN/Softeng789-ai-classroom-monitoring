import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { listClasses, type ClassApiResponse } from '../../lib/classAdminApi';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import {
  startOfIsoWeek,
  type LessonReconciliationResponse,
  type ReconciliationView,
  type StudentPaymentAccountRow
} from '../payments/data';
import { getCompleteLessonReconciliation, listAllStudentPaymentAccounts } from './api';
import { buildStudentOverview } from './studentOverviewModel';
import { ALL_CLASSES } from './types';

const PAGE_SIZE = 6;

export default function useStudentOverview() {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [accounts, setAccounts] = useState<StudentPaymentAccountRow[]>([]);
  const [reconciliations, setReconciliations] = useState<LessonReconciliationResponse[]>([]);
  const [courseOfferingId, setCourseOfferingIdState] = useState(ALL_CLASSES);
  const [weekStart, setWeekStartState] = useState(() => startOfIsoWeek(formatIsoDateInAuckland(new Date())));
  const [view, setViewState] = useState<ReconciliationView>('WEEK');
  const [query, setQueryState] = useState('');
  const [exceptionsOnly, setExceptionsOnlyState] = useState(false);
  const [page, setPage] = useState(0);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [reconciliationError, setReconciliationError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    setCatalogReady(false);
    setCatalogLoading(true);
    setCatalogError('');
    Promise.all([listClasses(), listAllStudentPaymentAccounts()])
      .then(([classRows, accountRows]) => {
        if (!active) return;
        setClasses(classRows.filter((item) => item.status === 'ACTIVE'));
        setAccounts(accountRows);
      })
      .catch((cause) => active && setCatalogError(apiMessage(cause)))
      .finally(() => {
        if (!active) return;
        setCatalogReady(true);
        setCatalogLoading(false);
      });
    return () => { active = false; };
  }, [refreshToken]);

  useEffect(() => {
    if (!catalogReady || catalogError) return undefined;
    const selectedClasses = courseOfferingId === ALL_CLASSES
      ? classes
      : classes.filter((item) => item.id === courseOfferingId);
    if (selectedClasses.length === 0) {
      setReconciliations([]);
      return undefined;
    }
    let active = true;
    setReconciliationLoading(true);
    setReconciliationError('');
    Promise.all(selectedClasses.map((item) => getCompleteLessonReconciliation({
      courseOfferingId: item.id,
      weekStart,
      view: courseOfferingId === ALL_CLASSES ? 'WEEK' : view
    })))
      .then((responses) => active && setReconciliations(responses))
      .catch((cause) => active && setReconciliationError(apiMessage(cause)))
      .finally(() => active && setReconciliationLoading(false));
    return () => { active = false; };
  }, [catalogError, catalogReady, classes, courseOfferingId, refreshToken, view, weekStart]);

  const data = useMemo(() => buildStudentOverview(
    { accounts, reconciliations },
    { courseOfferingId, query, exceptionsOnly, page, size: PAGE_SIZE }
  ), [accounts, classes, courseOfferingId, exceptionsOnly, page, query, reconciliations]);

  const setCourseOfferingId = (value: string) => {
    setCourseOfferingIdState(value);
    if (value === ALL_CLASSES) setViewState('WEEK');
    setPage(0);
  };

  return {
    classes,
    courseOfferingId,
    weekStart,
    view,
    query,
    exceptionsOnly,
    page: data.page,
    data,
    loading: catalogLoading || reconciliationLoading,
    error: catalogError || reconciliationError,
    setCourseOfferingId,
    setWeekStart: (value: string) => { setWeekStartState(startOfIsoWeek(value)); setPage(0); },
    setView: (value: ReconciliationView) => { setViewState(value); setPage(0); },
    setQuery: (value: string) => { setQueryState(value); setPage(0); },
    setExceptionsOnly: (value: boolean) => { setExceptionsOnlyState(value); setPage(0); },
    setPage,
    reload: useCallback(() => setRefreshToken((current) => current + 1), [])
  };
}
