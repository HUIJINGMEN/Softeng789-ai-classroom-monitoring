import { useEffect, useMemo, useState } from 'react';
import { apiMessage } from '../../lib/apiClient';
import { saveDownload } from '../../lib/saveDownload';
import { adjustInvoiceAccount, downloadAdminInvoice, emailInvoice, generateInvoiceMessage,
  getInvoiceAccount, manageSessionPackage, saveInvoiceMessage } from './api';
import { ACCOUNT_ADJUSTMENT_COPY, adjustmentAmountError, invoiceSessionPackages,
  deliveryConfirmed, nextServiceDate, shouldPrepareAiMessage } from './invoiceReviewModel';
import type { AccountAdjustmentType, InvoiceAccount, InvoiceMessageDraft, SessionPackageAction } from './types';

export interface InvoiceReviewOptions {
  readonly invoiceId: string;
  readonly studentName: string;
  readonly studentNumber?: string;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

// Keep an unreviewed AI draft available while the administrator moves around the
// payments workspace, without exposing it to the student or persisting it as an
// approved invoice message.
const invoiceDraftCache = new Map<string, InvoiceMessageDraft>();

export function useInvoiceReview({ invoiceId, studentName, studentNumber, onClose, onUpdated }: InvoiceReviewOptions) {
  const [account, setAccount] = useState<InvoiceAccount | null>(null);
  const [view, setView] = useState<'invoice' | 'account'>('invoice');
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState('');
  const [draftError, setDraftError] = useState('');
  const [busy, setBusy] = useState<'load' | 'draft' | 'save' | 'pdf' | 'email' | 'adjust' | 'package' | ''>('load');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [messageDirty, setMessageDirty] = useState(false);
  const [deliveryKey, setDeliveryKey] = useState(() => `single-${invoiceId}-${crypto.randomUUID()}`);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AccountAdjustmentType>('CREDIT');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [packageAction, setPackageAction] = useState<SessionPackageAction>('PAUSE');
  const [packageReason, setPackageReason] = useState('');
  const [serviceTo, setServiceTo] = useState('');
  const [targetCourseOfferingId, setTargetCourseOfferingId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const invoice = account?.invoice ?? null;
  const sessionPackages = useMemo(() => invoiceSessionPackages(invoice), [invoice]);
  const sessionPackage = sessionPackages.find((item) => item.id === selectedPackageId) ?? sessionPackages[0] ?? null;

  const reload = async () => {
    const result = await getInvoiceAccount(invoiceId);
    setAccount(result);
    return result;
  };

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      setBusy('load');
      setError('');
      setDraftError('');
      try {
        const result = await getInvoiceAccount(invoiceId);
        if (!active) return;
        setAccount(result);
        setMessageDirty(false);

        const reviewedMessage = result.invoice.note?.trim();
        if (reviewedMessage && !shouldPrepareAiMessage(result.invoice)) {
          setMessage(reviewedMessage);
          setProvider('');
          return;
        }

        const cachedDraft = invoiceDraftCache.get(invoiceId);
        if (cachedDraft) {
          setMessage(cachedDraft.message);
          setProvider(cachedDraft.provider);
          setMessageDirty(true);
          return;
        }

        // A note entered while creating the invoice is useful fallback text,
        // but is not an administrator-reviewed student message. Keep it visible
        // only while the automatic AI draft is being prepared.
        setMessage(reviewedMessage ?? '');
        setBusy('draft');
        try {
          const draft = await generateInvoiceMessage(invoiceId);
          if (!active) return;
          invoiceDraftCache.set(invoiceId, draft);
          setMessage(draft.message);
          setProvider(draft.provider);
          setMessageDirty(true);
        } catch (cause) {
          if (!active) return;
          setDraftError(`AI draft could not be prepared: ${apiMessage(cause)} You can write your own message or try again.`);
        }
      } catch (cause) {
        if (active) setError(apiMessage(cause));
      } finally {
        if (active) setBusy('');
      }
    };
    void initialise();
    return () => { active = false; };
  }, [invoiceId, loadAttempt]);

  useEffect(() => {
    if (!sessionPackage) return;
    setSelectedPackageId(sessionPackage.id);
    setServiceTo(nextServiceDate(sessionPackage.serviceTo));
    setPackageAction(sessionPackage.status === 'PAUSED' ? 'RESUME' : 'PAUSE');
  }, [sessionPackage?.id, sessionPackage?.serviceTo, sessionPackage?.status]);

  const transferClasses = useMemo(() => account?.transferOptions ?? [], [account?.transferOptions]);

  const generateDraft = async () => {
    setBusy('draft'); setDraftError(''); setNotice('');
    try {
      const result = await generateInvoiceMessage(invoiceId);
      invoiceDraftCache.set(invoiceId, result);
      setMessage(result.message); setProvider(result.provider);
      setMessageDirty(true);
    } catch (cause) {
      setDraftError(`AI draft could not be prepared: ${apiMessage(cause)} You can keep editing the current message or try again.`);
    } finally { setBusy(''); }
  };

  const editMessage = (nextMessage: string) => {
    setMessage(nextMessage);
    setMessageDirty(true);
    const cachedDraft = invoiceDraftCache.get(invoiceId);
    if (cachedDraft) invoiceDraftCache.set(invoiceId, { ...cachedDraft, message: nextMessage });
  };

  const saveMessage = async () => {
    if (!message.trim()) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      await saveInvoiceMessage(invoiceId, message.trim(), false);
      invoiceDraftCache.delete(invoiceId);
      setMessageDirty(false);
      setNotice('Message draft saved. The invoice is still private and has not been sent.');
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(''); }
  };

  const download = async () => {
    setBusy('pdf'); setError('');
    try { saveDownload(await downloadAdminInvoice(invoiceId), `${invoice?.invoiceNumber ?? 'ClassLens-invoice'}.pdf`); }
    catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const deliver = async () => {
    if (!message.trim()) return;
    setBusy('email'); setError(''); setNotice('');
    try {
      const result = await emailInvoice(invoiceId, message, deliveryKey);
      if (!deliveryConfirmed(result.status)) {
        setError(result.message);
        onUpdated();
        return;
      }
      invoiceDraftCache.delete(invoiceId);
      await reload();
      setProvider('');
      setMessageDirty(false);
      setDeliveryKey(`single-${invoiceId}-${crypto.randomUUID()}`);
      setNotice(result.message);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const submitAdjustment = async () => {
    if (!invoice || adjustmentAmountError(invoice, adjustmentType, adjustmentAmount)
      || !adjustmentReason.trim() || (adjustmentType === 'REFUND' && !refundReference.trim())) return;
    const amount = Number(adjustmentAmount);
    setBusy('adjust'); setError(''); setNotice('');
    try {
      const result = await adjustInvoiceAccount(invoiceId, {
        type: adjustmentType,
        amount,
        reason: adjustmentReason.trim(),
        ...(adjustmentType === 'REFUND' ? { externalReference: refundReference.trim() } : {})
      });
      setAccount(result);
      setAdjustmentAmount(''); setAdjustmentReason(''); setRefundReference('');
      setNotice(`${ACCOUNT_ADJUSTMENT_COPY[adjustmentType].label} recorded in the account history.`);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const submitPackageAction = async () => {
    if (!sessionPackage || !packageReason.trim()) return;
    setBusy('package'); setError(''); setNotice('');
    try {
      await manageSessionPackage(sessionPackage.id, {
        action: packageAction,
        reason: packageReason.trim(),
        ...(packageAction === 'EXTEND' ? { serviceTo } : {}),
        ...(packageAction === 'TRANSFER' ? { targetCourseOfferingId } : {})
      });
      await reload();
      setPackageReason('');
      setNotice(`Package ${packageAction.toLowerCase()} action saved.`);
      onUpdated();
    } catch (cause) { setError(apiMessage(cause)); } finally { setBusy(''); }
  };

  const packageActions: Array<{ value: SessionPackageAction; label: string }> = sessionPackage?.status === 'CANCELLED'
    ? []
    : [
      ...(sessionPackage?.status === 'PAUSED'
        ? [{ value: 'RESUME' as const, label: 'Resume package' }]
        : [{ value: 'PAUSE' as const, label: 'Pause package' }]),
      { value: 'EXTEND', label: 'Extend end date' },
      { value: 'TRANSFER', label: 'Transfer remaining lessons' },
      { value: 'CANCEL', label: 'Cancel remaining lessons' }
    ];

  const requestClose = () => {
    if (messageDirty && !window.confirm('Close without saving your message changes?')) return;
    onClose();
  };

  let messageHeading = 'Edit the message before sending';
  let messageHelp = 'This message appears in the PDF, email and student account after it is sent.';
  if (busy === 'draft') {
    messageHeading = 'AI is preparing the first draft…';
    messageHelp = 'Using the invoice, course access and attendance record';
  } else if (provider) {
    messageHeading = 'AI draft ready to edit';
    messageHelp = `Generated by ${provider} · review before sending`;
  } else {
    if (invoice?.lastEmailedAt) messageHeading = 'Review the saved message before sending again';
    else if (draftError) messageHeading = 'Write your message or retry AI';
    if (draftError) messageHelp = 'AI did not replace your text; retry or edit it manually';
  }
  const studentLabel = [studentName, studentNumber].filter(Boolean).join(' · ');

  return {
    view,
    studentLabel,
    busy,
    requestClose,
    invoice,
    download,
    message,
    messageDirty,
    saveMessage,
    deliver,
    setView,
    error,
    setLoadAttempt,
    notice,
    messageHeading,
    editMessage,
    invoiceId,
    draftError,
    generateDraft,
    messageHelp,
    account,
    adjustmentType,
    setAdjustmentType,
    adjustmentAmount,
    setAdjustmentAmount,
    refundReference,
    setRefundReference,
    adjustmentReason,
    setAdjustmentReason,
    submitAdjustment,
    sessionPackage,
    sessionPackages,
    setSelectedPackageId,
    setPackageReason,
    packageActions,
    packageAction,
    setPackageAction,
    serviceTo,
    setServiceTo,
    targetCourseOfferingId,
    setTargetCourseOfferingId,
    transferClasses,
    packageReason,
    submitPackageAction
  };
}
