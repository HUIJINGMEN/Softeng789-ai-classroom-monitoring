import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { cancelLessonMakeup, decideLessonCredit, getLessonCreditDetail, listMakeupOptions,
  scheduleLessonMakeup, updateReconciliationAttendance } from './api';
import { formatMoney, PAYMENT_STATUS_LABELS } from './format';
import { ATTENDANCE_OPTIONS } from './lessonCreditPanelModel';
import type { AbsenceReason, LessonCreditDetail, MakeupOption, ReconciliationCell,
  ReconciliationRow, ReconciliationSession } from './types';

export interface LessonCreditPanelOptions {
  readonly row: ReconciliationRow;
  readonly cell: ReconciliationCell;
  readonly session: ReconciliationSession;
  readonly onClose: () => void;
  readonly onUpdated: () => void | Promise<void>;
  readonly onOpenPayment?: () => void;
}

/** Owns lesson editing, guarded writes, source refresh and dialog lifecycle. */
export function useLessonCreditPanel({ row, cell, session, onClose, onUpdated, onOpenPayment }: LessonCreditPanelOptions) {
  const [detail, setDetail] = useState<LessonCreditDetail | null>(null);
  const [options, setOptions] = useState<MakeupOption[]>([]);
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [targetSessionId, setTargetSessionId] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState<ReconciliationCell['attendanceStatus']>(cell.attendanceStatus);
  const [savedAttendanceStatus, setSavedAttendanceStatus] = useState<ReconciliationCell['attendanceStatus']>(cell.attendanceStatus);
  const [reason, setReason] = useState<AbsenceReason | ''>(cell.absenceReason ?? '');
  const [savedReason, setSavedReason] = useState<AbsenceReason | ''>(cell.absenceReason ?? '');
  const [note, setNote] = useState(cell.absenceNote ?? cell.decisionNote ?? '');
  const [savedNote, setSavedNote] = useState(cell.absenceNote ?? cell.decisionNote ?? '');
  const [savedMessage, setSavedMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    setDetail(null);
    setDetailLoading(false);
    if (!cell.lessonCreditId) return;
    let active = true;
    setDetailLoading(true);
    getLessonCreditDetail(cell.lessonCreditId)
      .then((result) => active && setDetail(result))
      .catch((cause) => active && setError(apiMessage(cause)))
      .finally(() => active && setDetailLoading(false));
    return () => { active = false; };
  }, [cell.lessonCreditId, cell.creditStatus, cell.decisionNote]);

  useEffect(() => {
    if (!cell.lessonCreditId
      || (detail?.status !== 'MAKEUP_DUE' && detail?.status !== 'MAKEUP_SCHEDULED')) return;
    let active = true;
    listMakeupOptions(cell.lessonCreditId)
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setTargetSessionId(result[0]?.sessionId ?? '');
      })
      .catch((cause) => active && setError(apiMessage(cause)));
    return () => { active = false; };
  }, [cell.lessonCreditId, detail?.status, optionsVersion]);

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const attendanceDirty = attendanceStatus !== savedAttendanceStatus
    || (attendanceStatus === 'ABSENT' && (reason !== savedReason || note.trim() !== savedNote));

  const requestClose = () => {
    if (busy || detailLoading) return;
    if (attendanceDirty && !window.confirm('Discard unsaved attendance changes?')) return;
    onClose();
  };

  useEffect(() => {
    // Only a new source cell may update this form; never erase an in-progress local edit.
    if (attendanceDirty) return;
    setAttendanceStatus(cell.attendanceStatus);
    setSavedAttendanceStatus(cell.attendanceStatus);
    setReason(cell.absenceReason ?? '');
    setSavedReason(cell.absenceReason ?? '');
    setNote(cell.absenceNote ?? cell.decisionNote ?? '');
    setSavedNote(cell.absenceNote ?? cell.decisionNote ?? '');
  }, [cell]);

  const refreshSource = async () => {
    setRefreshFailed(false);
    try {
      await onUpdated();
    } catch (cause) {
      setRefreshFailed(true);
      setError(apiMessage(cause));
    }
  };

  const retryRefresh = async () => {
    setBusy(true);
    setError('');
    try { await refreshSource(); } finally { setBusy(false); }
  };

  const saveAttendance = async () => {
    if (busy || detailLoading || refreshFailed) return;
    if (attendanceStatus === 'ABSENT' && (!reason || !note.trim())) {
      setError('Choose an absence reason and add a short note.');
      return;
    }
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await updateReconciliationAttendance(session.id, row.studentId, {
        status: attendanceStatus,
        absenceReason: attendanceStatus === 'ABSENT' && reason ? reason : undefined,
        absenceNote: attendanceStatus === 'ABSENT' ? note.trim() : undefined
      });
      setAttendanceStatus(result.status);
      setSavedAttendanceStatus(result.status);
      setReason(result.absenceReason ?? '');
      setSavedReason(result.absenceReason ?? '');
      setNote(result.absenceNote ?? '');
      setSavedNote(result.absenceNote ?? '');
      setSavedMessage(result.status === 'ABSENT' ? 'Absence classification saved.' : 'Attendance updated.');
      await refreshSource();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'COUNT_AS_USED' | 'GRANT_MAKEUP') => {
    if (!cell.lessonCreditId || savedAttendanceStatus !== 'ABSENT' || !reason || !note.trim() || attendanceDirty) return;
    setBusy(true);
    setError('');
    try {
      const result = await decideLessonCredit(cell.lessonCreditId, { decision, reason, note });
      setDetail(result);
      await refreshSource();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const schedule = async () => {
    if (!cell.lessonCreditId || !targetSessionId) return;
    setBusy(true);
    setError('');
    try {
      const result = await scheduleLessonMakeup(cell.lessonCreditId, targetSessionId);
      setDetail(result);
      setOptionsVersion((version) => version + 1);
      await refreshSource();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async () => {
    if (!cell.lessonCreditId) return;
    setBusy(true);
    setError('');
    try {
      const result = await cancelLessonMakeup(cell.lessonCreditId);
      setDetail(result);
      setOptionsVersion((version) => version + 1);
      await refreshSource();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const currentStatus = detail?.status ?? cell.creditStatus;
  const currentMakeupDate = detail?.currentSessionDate ?? cell.makeupSessionDate;
  const attendanceLabel = ATTENDANCE_OPTIONS.find((option) => option.value === savedAttendanceStatus)?.label
    ?? 'Not recorded';
  const missingCoverage = !cell.lessonCreditId && !cell.creditStatus;
  const showCoverageIssue = cell.uncoveredAttendance || missingCoverage;
  const paymentLabel = row.paymentStatus ? PAYMENT_STATUS_LABELS[row.paymentStatus] : 'No invoice issued';
  const balanceLabel = row.balance !== null && row.balance > 0
    ? `${formatMoney(row.balance, row.currency)} due`
    : 'No outstanding balance';
  let coverageLabel = 'No active purchase';
  if (row.purchaseMode === 'LESSON_PACKAGE') {
    coverageLabel = `${row.purchasedSessions} bought · ${row.usedSessions} used · ${row.remainingSessions} left`;
  } else if (row.purchaseMode === 'COURSE_ENROLMENT') {
    coverageLabel = 'Full-course enrolment';
  } else if (row.purchaseMode === 'MEMBERSHIP') {
    coverageLabel = 'Membership access';
  } else if (row.purchaseMode === 'PAY_PER_LESSON') {
    coverageLabel = `${row.purchasedSessions} lesson${row.purchasedSessions === 1 ? '' : 's'} purchased`;
  }
  let attendanceSaveLabel = 'Attendance is up to date';
  if (savedMessage) attendanceSaveLabel = savedMessage;
  else if (attendanceDirty) attendanceSaveLabel = 'Unsaved changes';
  else if (savedAttendanceStatus === 'UNKNOWN') attendanceSaveLabel = 'Choose what happened in this lesson';

  return {
    onClose: requestClose,
    panelRef,
    handlePanelKeyDown,
    row,
    session,
    error,
    savedAttendanceStatus,
    attendanceLabel,
    showCoverageIssue,
    currentStatus,
    currentMakeupDate,
    paymentLabel,
    cell,
    balanceLabel,
    coverageLabel,
    onOpenPayment,
    busy: busy || detailLoading || refreshFailed,
    refreshFailed,
    retryRefresh,
    refreshing: busy || detailLoading,
    onUpdated,
    attendanceStatus,
    setAttendanceStatus,
    setSavedMessage,
    setError,
    reason,
    setReason,
    note,
    setNote,
    savedMessage,
    attendanceSaveLabel,
    attendanceDirty,
    saveAttendance,
    decide,
    options,
    targetSessionId,
    setTargetSessionId,
    cancelBooking,
    schedule,
    detail
  };
}
