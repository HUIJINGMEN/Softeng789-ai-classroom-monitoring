import { useEffect, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { listStudentDirectory, type StudentDirectoryItemApiResponse } from '../../../lib/studentApi';

const RECIPIENT_RESULT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 220;

export default function usePaymentRecipientSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentDirectoryItemApiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const page = await listStudentDirectory(0, RECIPIENT_RESULT_LIMIT, {
          query,
          sort: 'name',
          direction: 'asc'
        });
        if (cancelled) return;
        setResults(page.items);
        setError('');
      } catch (cause) {
        if (!cancelled) setError(apiMessage(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return { query, setQuery, results, loading, error };
}
