import { useEffect, useState } from 'react';
import { apiMessage } from '../../../lib/apiClient';
import { listClassStudents } from '../../../lib/classAdminApi';
import { listStudentDirectory, type StudentDirectoryItemApiResponse } from '../../../lib/studentApi';

const RECIPIENT_RESULT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 220;

export default function usePaymentRecipientSearch(courseOfferingId?: string) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentDirectoryItemApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const normalizedQuery = query.trim().toLowerCase();
        const items = courseOfferingId
          ? (await listClassStudents(courseOfferingId))
              .filter((student) => !normalizedQuery || [
                student.firstName,
                student.lastName,
                student.studentNumber,
                student.universityEmail
              ].some((value) => value.toLowerCase().includes(normalizedQuery)))
              .map((student) => ({ student, attendanceRate: null }))
          : (await listStudentDirectory(0, RECIPIENT_RESULT_LIMIT, {
              query,
              sort: 'name',
              direction: 'asc'
            })).items;
        if (cancelled) return;
        setResults(items);
        setError('');
      } catch (cause) {
        if (!cancelled) {
          setResults([]);
          setError(apiMessage(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [courseOfferingId, query, refreshToken]);

  return { query, setQuery, results, loading, error, retry: () => setRefreshToken((value) => value + 1) };
}
