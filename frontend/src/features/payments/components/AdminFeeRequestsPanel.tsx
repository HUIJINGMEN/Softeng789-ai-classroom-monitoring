import { useCallback, useEffect, useState } from 'react';
import Modal from '../../../components/Modal';
import { IconChevronRight, IconUpload } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import {
  createInvoiceFromFeeRequest,
  declineStudentFeeRequest,
  downloadAdminFeeRequestEvidence,
  listAdminFeeRequests
} from '../api';
import { formatMoney } from '../format';
import type { StudentFeeRequest } from '../types';

function openEvidence(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ReviewFeeRequestModal({ request, onClose, onResolved }: {
  readonly request: StudentFeeRequest;
  readonly onClose: () => void;
  readonly onResolved: (invoiceId?: string) => void;
}) {
  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.title);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [declineMode, setDeclineMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validQuote = Boolean(title.trim() && description.trim() && Number(amount) > 0 && dueDate);

  const showEvidence = async () => {
    try { openEvidence(await downloadAdminFeeRequestEvidence(request.id)); }
    catch (cause) { setError(apiMessage(cause)); }
  };

  const approve = async () => {
    if (!validQuote) return;
    setBusy(true); setError('');
    try {
      const result = await createInvoiceFromFeeRequest(request.id, {
        invoiceTitle: title.trim(), dueDate, note: note.trim() || undefined,
        lineItems: [{ description: description.trim(), type: 'CHARGE', amount: Number(amount) }]
      });
      onResolved(result.invoiceId ?? undefined);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  };

  const decline = async () => {
    if (!note.trim()) return;
    setBusy(true); setError('');
    try { await declineStudentFeeRequest(request.id, note); onResolved(); }
    catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  };

  let submitLabel = declineMode ? 'Confirm decline' : 'Create invoice draft';
  if (busy) submitLabel = 'Saving…';

  return (
    <Modal size="wide" className="fee-review-modal" title="Review student request" subtitle={`${request.studentName} · ${request.studentNumber}`} closeButton onClose={onClose}
      footer={<><button type="button" className="btn" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="btn btn--danger" disabled={busy} onClick={() => setDeclineMode((value) => !value)}>{declineMode ? 'Keep reviewing' : 'Decline'}</button><span className="spacer" /><button type="button" className="btn btn--primary" disabled={busy || (declineMode ? !note.trim() : !validQuote)} onClick={declineMode ? decline : approve}>{submitLabel}</button></>}>
      <div className="fee-review-workspace">
        <section className="fee-review-source">
          <span>Student request</span><h3>{request.title}</h3><p>{request.requestDetails}</p>
          {request.evidenceFileName && <button type="button" className="btn btn--sm" onClick={showEvidence}><IconUpload /> View attachment</button>}
        </section>
        <section className="fee-review-quote">
          <div><span>{declineMode ? 'Response' : 'Invoice details'}</span><strong>{declineMode ? 'Explain why it cannot be approved' : 'Confirm the charge before reviewing and sending it'}</strong></div>
          {!declineMode && <>
            <label className="field"><span>Invoice title</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} /></label>
            <div className="fee-review-quote__row"><label className="field"><span>Line item</span><input value={description} maxLength={180} onChange={(event) => setDescription(event.target.value)} /></label><label className="field"><span>Amount (NZD)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label className="field"><span>Due date</span><input type="date" min={formatIsoDateInAuckland(new Date())} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
            {Number(amount) > 0 && <p className="fee-review-quote__total">Invoice total <strong>{formatMoney(Number(amount))}</strong></p>}
          </>}
          <label className="field"><span>{declineMode ? 'Reason' : 'Message'} <small>{declineMode ? 'Required' : 'Optional'}</small></span><textarea rows={3} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={declineMode ? 'Give the student a clear reason.' : 'Add useful context for the student.'} /></label>
          {error && <p className="field-error" role="alert">{error}</p>}
        </section>
      </div>
    </Modal>
  );
}

export default function AdminFeeRequestsPanel({ onInvoiceCreated }: {
  readonly onInvoiceCreated: (invoice: {
    invoiceId: string;
    studentName: string;
    studentNumber: string;
  }) => void;
}) {
  const [requests, setRequests] = useState<StudentFeeRequest[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<StudentFeeRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await listAdminFeeRequests(0, 10); setRequests(result.page.items); setCount(result.submittedCount); }
    catch (cause) { setError(apiMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className={`admin-fee-requests${count ? ' has-requests' : ''}`}>
      <header><div><span>Student requests</span><h2>Items & other fees</h2><p>Review student-submitted requirements before creating a charge.</p></div><b>{count}</b></header>
      {error && <div className="notice notice--warn" role="alert">{error}</div>}
      {loading && <output className="admin-fee-requests__state">Checking requests…</output>}
      {!loading && requests.length === 0 && <p className="admin-fee-requests__state">No student requests need review.</p>}
      {requests.length > 0 && <div className="admin-fee-request-list">{requests.map((item) => <button type="button" key={item.id} onClick={() => setSelected(item)}><span><strong>{item.studentName}</strong><small>{item.studentNumber}</small></span><span><strong>{item.title}</strong><small>{item.requestDetails}</small></span>{item.evidenceFileName && <em>Attachment</em>}<IconChevronRight /></button>)}</div>}
      {selected && <ReviewFeeRequestModal request={selected} onClose={() => setSelected(null)} onResolved={(invoiceId) => {
        const resolved = selected;
        setSelected(null);
        void load();
        if (invoiceId) onInvoiceCreated({ invoiceId, studentName: resolved.studentName, studentNumber: resolved.studentNumber });
      }} />}
    </section>
  );
}
