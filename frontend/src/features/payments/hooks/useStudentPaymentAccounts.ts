import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { listStudentPaymentAccounts } from '../api';
import type { StudentPaymentDirectoryFilter, StudentPaymentDirectoryResponse } from '../types';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 220;

export default function useStudentPaymentAccounts() {
  const [data, setData] = useState<StudentPaymentDirectoryResponse | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StudentPaymentDirectoryFilter | ''>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await listStudentPaymentAccounts(page, PAGE_SIZE, { query, filter });
      if (requestId !== requestSequence.current) return;
      setData(response);
      setError('');
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setError(apiMessage(cause));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [load]);

  return {
    data,
    query,
    filter,
    loading,
    error,
    setQuery: (value: string) => { setQuery(value); setPage(0); },
    setFilter: (value: StudentPaymentDirectoryFilter | '') => { setFilter(value); setPage(0); },
    setPage,
    reload: load
  };
}
