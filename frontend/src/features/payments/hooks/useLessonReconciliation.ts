import { useCallback, useEffect, useState } from 'react';
import { listClasses, type ClassApiResponse } from '../../../lib/classAdminApi';
import { apiMessage } from '../../../lib/apiClient';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import { getLessonReconciliation } from '../api';
import { startOfIsoWeek } from '../lessonReconciliationModel';
import type { LessonReconciliationResponse, ReconciliationView } from '../types';

export default function useLessonReconciliation(
  fixedCourseOfferingId?: string,
  externalRefreshToken = 0,
  initialWeekStart?: string
) {
  const [classes, setClasses] = useState<ClassApiResponse[]>([]);
  const [courseOfferingId, setCourseOfferingId] = useState(fixedCourseOfferingId ?? '');
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(initialWeekStart ?? formatIsoDateInAuckland(new Date())));
  const [view, setView] = useState<ReconciliationView>('WEEK');
  const [query, setQuery] = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LessonReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (fixedCourseOfferingId) {
      setCourseOfferingId(fixedCourseOfferingId);
      setWeekStart(startOfIsoWeek(initialWeekStart ?? formatIsoDateInAuckland(new Date())));
      setPage(0);
      return undefined;
    }
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        const activeClasses = items.filter((item) => item.status === 'ACTIVE');
        setClasses(activeClasses);
        setCourseOfferingId((current) => current || activeClasses[0]?.id || '');
      })
      .catch((cause) => active && setError(apiMessage(cause)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [fixedCourseOfferingId, initialWeekStart]);

  useEffect(() => {
    if (!courseOfferingId) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getLessonReconciliation({ courseOfferingId, weekStart, view, query, exceptionsOnly, page, size: 25 })
        .then((result) => active && setData(result))
        .catch((cause) => active && setError(apiMessage(cause)))
        .finally(() => active && setLoading(false));
    }, query ? 220 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [courseOfferingId, exceptionsOnly, externalRefreshToken, page, query, refreshToken, view, weekStart]);

  const reload = useCallback(() => setRefreshToken((value) => value + 1), []);

  return {
    classes,
    courseOfferingId,
    weekStart,
    view,
    query,
    exceptionsOnly,
    page,
    data,
    loading,
    error,
    setCourseOfferingId: (value: string) => { setCourseOfferingId(value); setPage(0); },
    setWeekStart: (value: string) => { setWeekStart(startOfIsoWeek(value)); setPage(0); },
    setView: (value: ReconciliationView) => { setView(value); setPage(0); },
    setQuery: (value: string) => { setQuery(value); setPage(0); },
    setExceptionsOnly: (value: boolean) => { setExceptionsOnly(value); setPage(0); },
    setPage,
    reload
  };
}
