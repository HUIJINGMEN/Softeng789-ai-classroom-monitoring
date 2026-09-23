import { useCallback, useEffect, useRef, useState } from 'react';
import {
  confirmAccomplishment,
  listAccomplishmentsForStudent,
  revokeAccomplishment
} from '../../lib/accomplishmentApi';
import { apiMessage } from '../../lib/apiClient';
import { listFeedbackSummaries } from '../../lib/feedbackSummaryApi';
import { listMyClassOptions } from '../../lib/healthIncidentApi';
import { createProgressReport, listProgressReportsForStudent } from '../../lib/progressReportApi';
import type {
  Accomplishment,
  FeedbackSummary,
  HealthClassOption,
  ProgressReport
} from '../../types';

interface UseStudentProfileRecordsOptions {
  studentRecordId?: string;
  showToast: (message: string) => void;
  onAccomplishmentUpdated: (accomplishment: Accomplishment) => void;
}

export interface StudentFeedbackInput {
  courseOfferingId: string;
  comment: string;
}

/**
 * Owns student-profile API state and mutations. The page consumes one cohesive feature boundary
 * instead of coordinating four endpoints and duplicating loading/error transitions in the view.
 */
export function useStudentProfileRecords({
  studentRecordId,
  showToast,
  onAccomplishmentUpdated
}: UseStudentProfileRecordsOptions) {
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsLoadError, setReportsLoadError] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
  const [classOptions, setClassOptions] = useState<HealthClassOption[]>([]);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [loadingAccomplishments, setLoadingAccomplishments] = useState(true);
  const [accomplishmentsLoadError, setAccomplishmentsLoadError] = useState(false);
  const [accomplishmentBusyId, setAccomplishmentBusyId] = useState<string | null>(null);
  const reportsRequestRef = useRef(0);
  const summariesRequestRef = useRef(0);
  const accomplishmentsRequestRef = useRef(0);
  const activeStudentRecordIdRef = useRef(studentRecordId);

  useEffect(() => {
    activeStudentRecordIdRef.current = studentRecordId;
    return () => {
      reportsRequestRef.current += 1;
      summariesRequestRef.current += 1;
      accomplishmentsRequestRef.current += 1;
      activeStudentRecordIdRef.current = undefined;
    };
  }, [studentRecordId]);

  const refreshReports = useCallback(async () => {
    const requestId = ++reportsRequestRef.current;
    if (!studentRecordId) {
      setProgressReports([]);
      setLoadingReports(false);
      return;
    }
    setLoadingReports(true);
    setReportsLoadError(false);
    try {
      const reports = await listProgressReportsForStudent(studentRecordId);
      if (requestId === reportsRequestRef.current) setProgressReports(reports);
    } catch (error) {
      if (requestId !== reportsRequestRef.current) return;
      setReportsLoadError(true);
      showToast(apiMessage(error));
    } finally {
      if (requestId === reportsRequestRef.current) setLoadingReports(false);
    }
  }, [showToast, studentRecordId]);

  const refreshSummaries = useCallback(async () => {
    const requestId = ++summariesRequestRef.current;
    if (!studentRecordId) {
      setSummaries([]);
      return;
    }
    try {
      const nextSummaries = await listFeedbackSummaries(studentRecordId);
      if (requestId === summariesRequestRef.current) setSummaries(nextSummaries);
    } catch (error) {
      if (requestId === summariesRequestRef.current) showToast(apiMessage(error));
    }
  }, [showToast, studentRecordId]);

  const refreshAccomplishments = useCallback(async () => {
    const requestId = ++accomplishmentsRequestRef.current;
    if (!studentRecordId) {
      setAccomplishments([]);
      setLoadingAccomplishments(false);
      return;
    }
    setLoadingAccomplishments(true);
    setAccomplishmentsLoadError(false);
    try {
      const nextAccomplishments = await listAccomplishmentsForStudent(studentRecordId);
      if (requestId === accomplishmentsRequestRef.current) {
        setAccomplishments(nextAccomplishments);
      }
    } catch (error) {
      if (requestId !== accomplishmentsRequestRef.current) return;
      setAccomplishmentsLoadError(true);
      showToast(apiMessage(error));
    } finally {
      if (requestId === accomplishmentsRequestRef.current) setLoadingAccomplishments(false);
    }
  }, [showToast, studentRecordId]);

  useEffect(() => {
    setAccomplishmentBusyId(null);
    void refreshReports();
    void refreshSummaries();
    void refreshAccomplishments();
  }, [refreshAccomplishments, refreshReports, refreshSummaries, studentRecordId]);

  useEffect(() => {
    let cancelled = false;
    if (!studentRecordId) {
      setClassOptions([]);
      return () => {
        cancelled = true;
      };
    }

    void listMyClassOptions()
      .then((options) => {
        if (!cancelled) {
          setClassOptions(
            options.filter((option) =>
              option.students.some((student) => student.id === studentRecordId)
            )
          );
        }
      })
      .catch((error) => {
        if (!cancelled) showToast(apiMessage(error));
      });

    return () => {
      cancelled = true;
    };
  }, [showToast, studentRecordId]);

  const addFeedback = useCallback(async (payload: StudentFeedbackInput) => {
    if (!studentRecordId) return false;
    setSavingFeedback(true);
    try {
      await createProgressReport({ studentId: studentRecordId, ...payload });
      await refreshReports();
      return true;
    } catch (error) {
      showToast(apiMessage(error));
      return false;
    } finally {
      setSavingFeedback(false);
    }
  }, [refreshReports, showToast, studentRecordId]);

  const replaceAccomplishment = useCallback((updated: Accomplishment) => {
    setAccomplishments((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
    onAccomplishmentUpdated(updated);
  }, [onAccomplishmentUpdated]);

  const updateAccomplishmentStatus = useCallback(async (
    item: Accomplishment,
    action: 'confirm' | 'revoke'
  ) => {
    setAccomplishmentBusyId(item.id);
    try {
      const updated = action === 'confirm'
        ? await confirmAccomplishment(item.id)
        : await revokeAccomplishment(item.id);
      if (activeStudentRecordIdRef.current !== studentRecordId) return;
      replaceAccomplishment(updated);
      showToast(
        action === 'confirm'
          ? 'Achievement shared with the student.'
          : 'Achievement removed from the student view.'
      );
    } catch (error) {
      if (activeStudentRecordIdRef.current === studentRecordId) showToast(apiMessage(error));
    } finally {
      if (activeStudentRecordIdRef.current === studentRecordId) setAccomplishmentBusyId(null);
    }
  }, [replaceAccomplishment, showToast, studentRecordId]);

  return {
    progressReports,
    loadingReports,
    reportsLoadError,
    savingFeedback,
    summaries,
    classOptions,
    accomplishments,
    loadingAccomplishments,
    accomplishmentsLoadError,
    accomplishmentBusyId,
    refreshReports,
    refreshSummaries,
    refreshAccomplishments,
    addFeedback,
    replaceAccomplishment,
    updateAccomplishmentStatus
  };
}

export type StudentProfileRecords = ReturnType<typeof useStudentProfileRecords>;
