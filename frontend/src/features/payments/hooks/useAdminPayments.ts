import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import {
  listAdminPayments,
  type AdminPaymentsResponse,
  type InvoiceStatus
} from '../api';

const ADMIN_PAYMENT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 220;

export type PaymentStatusFilter = InvoiceStatus | '';

export default function useAdminPayments() {
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PaymentStatusFilter>('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await listAdminPayments(page, ADMIN_PAYMENT_PAGE_SIZE, { query, status });
      if (requestId !== requestSequence.current) return;
      setData(response);
      setError('');
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setError(apiMessage(cause));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [load]);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setPage(0);
  }, []);

  const changeStatus = useCallback((value: PaymentStatusFilter) => {
    setStatus(value);
    setPage(0);
  }, []);

  return {
    data,
    query,
    status,
    loading,
    error,
    setQuery: changeQuery,
    setStatus: changeStatus,
    setPage,
    reload: load
  };
}
