import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { formatIsoDateInAuckland } from '../../lib/sessionTime';
import { getBillingOperations } from './api';
import type { OperationsAlert, OperationsDashboard } from './types';

function localDate(value: Date) {
  return formatIsoDateInAuckland(value);
}

function currentYearRange() {
  const today = localDate(new Date());
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

/** Owns period selection and request ordering; the workspace only renders this read model. */
export function useBillingOperations(refreshToken: number) {
  const [data, setData] = useState<OperationsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(currentYearRange);
  const [draftRange, setDraftRange] = useState(currentYearRange);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const result = await getBillingOperations(range);
      if (requestId === requestRef.current) setData(result);
    } catch (cause) {
      if (requestId === requestRef.current) setError(apiMessage(cause));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); return () => { requestRef.current++; }; }, [load, refreshToken]);

  const alertGroups = useMemo(() => {
    if (!data) return { urgent: [] as OperationsAlert[], upcoming: [] as OperationsAlert[] };
    return {
      urgent: data.alerts.filter((alert) => alert.severity === 'high'),
      upcoming: data.alerts.filter((alert) => alert.severity !== 'high')
    };
  }, [data]);

  return { data, loading, error, draftRange, setDraftRange, setRange, load, alertGroups };
}
