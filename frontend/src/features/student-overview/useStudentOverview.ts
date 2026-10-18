import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiMessage } from '../../lib/apiClient';
import { listClasses, type ClassApiResponse } from '../../lib/classAdminApi';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import { startOfIsoWeek, type ReconciliationView } from '../payments/model';
import { getStudentOverview, getStudentOverviewStudent } from './api';
import { refreshedStudentOverview, overviewPageData, overviewScopeKey } from './studentOverviewState';
import { ALL_CLASSES, type LessonSelection, type StudentOverviewPage, type StudentOverviewScope } from './types';

function overviewLoadError(cause: unknown, resource: string): string {
  const recovery = cause instanceof ApiError ? apiMessage(cause) : 'Check your connection and retry.';
  return `Could not load ${resource}. ${recovery}`;
}

export default function useStudentOverview() {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogToken, setCatalogToken] = useState(0);
  const [courseOfferingId, setCourseOfferingId] = useState(ALL_CLASSES);
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(formatIsoDateInAuckland(new Date())));
  const [view, setView] = useState<ReconciliationView>('WEEK');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<{ key: string; source: StudentOverviewPage } | null>(null);
  const [requestState, setRequestState] = useState({ key: '', loading: true, error: '' });
  const studentRequest = useRef<AbortController | null>(null);
  const scope: StudentOverviewScope = { courseOfferingId, weekStart, view, query: debouncedQuery, exceptionsOnly, page };
  const scopeKey = overviewScopeKey(scope);
  const queryPending = query.trim() !== debouncedQuery;
  const currentKey = useRef(scopeKey);
  currentKey.current = scopeKey;
  const latestSource = useRef(result);
  latestSource.current = result;

  useEffect(() => {
    let active = true;
    setCatalogError('');
    listClasses().then(rows => { if (active) setClasses(rows.filter(item => item.status === 'ACTIVE')); })
      .catch(cause => { if (active) setCatalogError(overviewLoadError(cause, 'the class list')); });
    return () => { active = false; };
  }, [catalogToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    studentRequest.current?.abort();
    if (queryPending) return;
    const controller = new AbortController();
    setRequestState({ key: scopeKey, loading: true, error: '' });
    getStudentOverview(scope, controller.signal).then(source => {
      if (!controller.signal.aborted) setResult({ key: scopeKey, source });
    }).catch(cause => {
      if (!controller.signal.aborted) setRequestState({ key: scopeKey, loading: false, error: overviewLoadError(cause, 'students and lessons for this period') });
    }).finally(() => {
      if (!controller.signal.aborted) setRequestState(state => ({ ...state, loading: false }));
    });
    return () => controller.abort();
  }, [scopeKey, refreshToken, queryPending]);

  useEffect(() => () => studentRequest.current?.abort(), []);

  const error = requestState.key === scopeKey ? requestState.error : '';
  const loading = queryPending || requestState.key !== scopeKey || requestState.loading || (!error && result?.key !== scopeKey);
  const source = !loading && !error && result?.key === scopeKey ? result.source : null;
  const data = useMemo(() => overviewPageData(source), [source]);

  const refreshStudent = async (selection: LessonSelection) => {
    studentRequest.current?.abort();
    const controller = new AbortController();
    studentRequest.current = controller;
    try {
      const update = await getStudentOverviewStudent(scope, selection, controller.signal);
      if (controller.signal.aborted || currentKey.current !== scopeKey) return;
      const previous = latestSource.current;
      if (!previous || previous.key !== scopeKey) return;
      const merged = refreshedStudentOverview(previous.source, update, selection, exceptionsOnly);
      if (!merged) {
        setResult(null);
        setRefreshToken(value => value + 1);
        return;
      }
      setResult({ key: scopeKey, source: merged });
    } catch (cause) {
      if (!controller.signal.aborted && currentKey.current === scopeKey) {
        if (cause instanceof ApiError && (cause.status === 400 || cause.status === 404)) {
          setResult(null);
          setRefreshToken(value => value + 1);
          setCatalogToken(value => value + 1);
        }
        throw new Error(`Changes were saved, but the latest records could not be loaded. Close and retry. ${apiMessage(cause)}`);
      }
    }
  };

  const changeCourseOfferingId = (value: string) => {
    setCourseOfferingId(value);
    if (value === ALL_CLASSES) setView('WEEK');
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
    scopeKey,
    refreshStudent,
    loading,
    error: catalogError || error,
    setCourseOfferingId: changeCourseOfferingId,
    setWeekStart: (value: string) => { setWeekStart(startOfIsoWeek(value)); setPage(0); },
    setView: (value: ReconciliationView) => { setView(value); setPage(0); },
    setQuery: (value: string) => { setQuery(value); setPage(0); },
    setExceptionsOnly: (value: boolean) => { setExceptionsOnly(value); setPage(0); },
    setPage,
    reload: useCallback(() => { setRefreshToken(value => value + 1); setCatalogToken(value => value + 1); }, [])
  };
}
