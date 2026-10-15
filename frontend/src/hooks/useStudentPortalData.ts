import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../lib/apiClient';
import { listPublishedFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { listPublishedStudentReports, type StudentReport } from '../features/student-reports';
import { listMyProgressReports } from '../lib/progressReportApi';
import { listMyAccomplishments } from '../lib/accomplishmentApi';
import { getStudent, mapStudentApiToUi } from '../lib/studentApi';
import { getStudentPaymentStatement, type StudentPaymentStatement } from '../features/payments';
import {
  getMyAttendanceBenchmark,
  getMyAttendanceHistory,
  getMySchedule,
  type StudentSchedule,
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
  readonly studentReports: StudentReport[];
  readonly publishedReportsError: string;
  readonly paymentStatement: StudentPaymentStatement | null;
  readonly paymentError: string;
  readonly schedule: StudentSchedule | null;
  readonly scheduleError: string;
  readonly errors: string[];
  readonly loading: boolean;
  readonly retry: () => void;
}

function applyPortalResult<T>(result: PromiseSettledResult<T>, onSuccess: (value: T) => void, onFailure: (reason: unknown) => void) {
  if (result.status === 'fulfilled') onSuccess(result.value);
  else onFailure(result.reason);
}

export function useStudentPortalData(user: AuthUser): StudentPortalData {
  const [profile, setProfile] = useState<Student | null>(null);
  const [history, setHistory] = useState<StudentAttendanceHistoryEntry[]>([]);
  const [benchmark, setBenchmark] = useState<StudentAttendanceBenchmark | null>(null);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [publishedReports, setPublishedReports] = useState<FeedbackSummary[]>([]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [publishedReportsError, setPublishedReportsError] = useState('');
  const [paymentStatement, setPaymentStatement] = useState<StudentPaymentStatement | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [schedule, setSchedule] = useState<StudentSchedule | null>(null);
  const [scheduleError, setScheduleError] = useState('');
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
      Promise.all([listPublishedFeedbackSummaries(user.id), listPublishedStudentReports(user.id)]),
      getStudentPaymentStatement(user.id),
      getMySchedule(user.id)
    ]).then(([profileResult, historyResult, benchmarkResult, reportsResult, accomplishmentsResult, publishedResult, paymentResult, scheduleResult]) => {
      if (cancelled) return;
      const nextErrors: string[] = [];

      applyPortalResult(profileResult, (value) => setProfile(mapStudentApiToUi(value)), (cause) => {
        setProfile(null);
        nextErrors.push(`Profile: ${apiMessage(cause)}`);
      });
      applyPortalResult(historyResult, setHistory, (cause) => {
        setHistory([]);
        nextErrors.push(`Attendance: ${apiMessage(cause)}`);
      });
      applyPortalResult(benchmarkResult, setBenchmark, (cause) => {
        setBenchmark(null);
        nextErrors.push(`Class comparison: ${apiMessage(cause)}`);
      });
      applyPortalResult(reportsResult, setReports, (cause) => {
        setReports([]);
        nextErrors.push(`Feedback: ${apiMessage(cause)}`);
      });
      applyPortalResult(accomplishmentsResult, setAccomplishments, (cause) => {
        setAccomplishments([]);
        nextErrors.push(`Achievements: ${apiMessage(cause)}`);
      });
      applyPortalResult(publishedResult, (value) => {
        setPublishedReports(value[0]);
        setStudentReports(value[1]);
        setPublishedReportsError('');
      }, (cause) => {
        setPublishedReports([]);
        setStudentReports([]);
        setPublishedReportsError(apiMessage(cause));
      });
      applyPortalResult(paymentResult, (value) => {
        setPaymentStatement(value);
        setPaymentError('');
      }, (cause) => {
        setPaymentStatement(null);
        setPaymentError(apiMessage(cause));
      });
      applyPortalResult(scheduleResult, (value) => {
        setSchedule(value);
        setScheduleError('');
      }, (cause) => {
        setSchedule(null);
        setScheduleError(apiMessage(cause));
        nextErrors.push(`Schedule: ${apiMessage(cause)}`);
      });

      setErrors(nextErrors);
    }).catch((cause) => {
      if (!cancelled) setErrors([`Student data could not be processed: ${apiMessage(cause)}`]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
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
    studentReports,
    publishedReportsError,
    paymentStatement,
    paymentError,
    schedule,
    scheduleError,
    errors,
    loading,
    retry
  };
}
