import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { listPublishedFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { listMyProgressReports } from '../lib/progressReportApi';
import { listMyAccomplishments } from '../lib/accomplishmentApi';
import { getStudent, mapStudentApiToUi } from '../lib/studentApi';
import {
  getMyAttendanceBenchmark,
  getMyAttendanceHistory,
  type StudentAttendanceBenchmark
} from '../lib/studentPortalApi';
import type {
  AuthUser,
  Accomplishment,
  FeedbackSummary,
  ProgressReport,
  Student,
  StudentAttendanceHistoryEntry
} from '../types';

interface StudentPortalData {
  readonly profile: Student | null;
  readonly history: StudentAttendanceHistoryEntry[];
  readonly benchmark: StudentAttendanceBenchmark | null;
  readonly reports: ProgressReport[];
  readonly accomplishments: Accomplishment[];
  readonly publishedReports: FeedbackSummary[];
  readonly publishedReportsError: string;
  readonly errors: string[];
  readonly loading: boolean;
  readonly retry: () => void;
}

export function useStudentPortalData(user: AuthUser): StudentPortalData {
  const [profile, setProfile] = useState<Student | null>(null);
  const [history, setHistory] = useState<StudentAttendanceHistoryEntry[]>([]);
  const [benchmark, setBenchmark] = useState<StudentAttendanceBenchmark | null>(null);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [publishedReports, setPublishedReports] = useState<FeedbackSummary[]>([]);
  const [publishedReportsError, setPublishedReportsError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const retry = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    Promise.allSettled([
      getStudent(user.id),
      getMyAttendanceHistory(user.id),
      getMyAttendanceBenchmark(user.id),
      listMyProgressReports(user.id),
      listMyAccomplishments(user.id),
      listPublishedFeedbackSummaries(user.id)
    ]).then(([profileResult, historyResult, benchmarkResult, reportsResult, accomplishmentsResult, publishedResult]) => {
      if (cancelled) return;
      const nextErrors: string[] = [];

      if (profileResult.status === 'fulfilled') {
        setProfile(mapStudentApiToUi(profileResult.value));
      } else {
        nextErrors.push(`Profile: ${apiMessage(profileResult.reason)}`);
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      } else {
        nextErrors.push(`Attendance: ${apiMessage(historyResult.reason)}`);
      }

      if (benchmarkResult.status === 'fulfilled') {
        setBenchmark(benchmarkResult.value);
      } else {
        setBenchmark(null);
        nextErrors.push(`Class comparison: ${apiMessage(benchmarkResult.reason)}`);
      }

      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value);
      } else {
        nextErrors.push(`Feedback: ${apiMessage(reportsResult.reason)}`);
      }

      if (accomplishmentsResult.status === 'fulfilled') {
        setAccomplishments(accomplishmentsResult.value);
      } else {
        nextErrors.push(`Achievements: ${apiMessage(accomplishmentsResult.reason)}`);
      }

      if (publishedResult.status === 'fulfilled') {
        setPublishedReports(publishedResult.value);
        setPublishedReportsError('');
      } else {
        setPublishedReports([]);
        setPublishedReportsError(apiMessage(publishedResult.reason));
      }

      setErrors(nextErrors);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, user.id, user.token]);

  return {
    profile,
    history,
    benchmark,
    reports,
    accomplishments,
    publishedReports,
    publishedReportsError,
    errors,
    loading,
    retry
  };
}
