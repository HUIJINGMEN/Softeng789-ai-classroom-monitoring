import { useId, useRef, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { reviewManualPayment } from './api';
import { hasPaymentReceipt, manualPaymentReviewError, receiptDateToday, receiptDateError } from './manualPaymentReviewModel';
import type { ManualPaymentSubmission } from './types';
import { usePaymentReceipt } from './usePaymentReceipt';

/** Review request lifecycle is independent of receipt-preview availability. */
export function useManualPaymentReview(payment: ManualPaymentSubmission, onReviewed: () => void) {
  const [note, setNote] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [dateError, setDateError] = useState('');
  const dateInput = useRef<HTMLInputElement>(null);
  const dateId = useId();
  const today = receiptDateToday();
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [noteError, setNoteError] = useState('');
  const inFlight = useRef(false);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  const working = decision !== null;
  const cashPayment = payment.method === 'CASH';
  const receipt = usePaymentReceipt(payment.id, hasPaymentReceipt(payment));
  const knownBalance = Number.isFinite(payment.invoiceBalance);
  const balanceAllowsApproval = knownBalance && payment.amount <= payment.invoiceBalance;
  // Preview availability is not proof of receipt of funds. The administrator verifies
  // the institution payment record; the server rechecks invoice state and balance.
  const canApprove = balanceAllowsApproval;

  const review = async (next: 'APPROVED' | 'REJECTED') => {
    if (inFlight.current || (next === 'APPROVED' && !canApprove)) return;
    const validation = manualPaymentReviewError(next, note);
    setNoteError(validation);
    if (validation) { noteInput.current?.focus(); return; }
    const invalidDate = next === 'APPROVED' ? receiptDateError(receivedDate, today) : '';
    setDateError(invalidDate);
    if (invalidDate) { dateInput.current?.focus(); return; }
    inFlight.current = true;
    setDecision(next);
    setError('');
    try {
      if (next === 'APPROVED') await reviewManualPayment(payment.id, next, note.trim(), receivedDate);
      else await reviewManualPayment(payment.id, next, note.trim());
      onReviewed();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      inFlight.current = false;
      setDecision(null);
    }
  };
  return {
    receivedDate, setReceivedDate, dateError, setDateError, dateInput, dateId, today,
    note,
    setNote,
    decision,
    error,
    noteError,
    setNoteError,
    noteInput,
    noteId,
    working,
    cashPayment,
    receipt,
    knownBalance,
    balanceAllowsApproval,
    canApprove,
    review,
  };
}
