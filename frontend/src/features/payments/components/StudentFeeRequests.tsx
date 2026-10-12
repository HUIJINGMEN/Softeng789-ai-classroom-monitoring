import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import { IconChevronRight, IconPlus, IconUpload } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { listStudentFeeRequests, submitStudentFeeRequest } from '../api';
import type { StudentFeeRequest } from '../types';

interface Props {
  readonly studentId: string;
  readonly compact?: boolean;
}

const STATUS_COPY: Record<StudentFeeRequest['status'], string> = {
  SUBMITTED: 'Awaiting review',
  INVOICED: 'Approved',
  DECLINED: 'Not approved'
};

function RequestForm({ studentId, onClose, onCreated }: {
  readonly studentId: string;
  readonly onClose: () => void;
  readonly onCreated: (request: StudentFeeRequest) => void;
}) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!title.trim() || !details.trim()) return;
    setSaving(true);
    setError('');
    try {
      onCreated(await submitStudentFeeRequest(studentId, { title, details, evidence }));
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="narrow"
      className="fee-request-modal"
      title="Request an item or fee"
      subtitle="Tell the office what you need. They will review it before any charge is created."
      closeButton
      onClose={onClose}
      footer={<><button className="btn" type="button" disabled={saving} onClick={onClose}>Cancel</button><span className="spacer" /><button className="btn btn--primary" type="button" disabled={saving || !title.trim() || !details.trim()} onClick={submit}>{saving ? 'Sending…' : 'Send request'}</button></>}
    >
      <div className="fee-request-form">
        <div className="fee-request-form__intro"><strong>No payment is created yet</strong><span>The office will confirm the item, quantity and price with you first.</span></div>
        <label className="field"><span>What do you need?</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 10 pencils and 5 erasers" autoFocus /></label>
        <label className="field"><span>Details</span><textarea value={details} maxLength={2000} rows={5} onChange={(event) => setDetails(event.target.value)} placeholder="Include quantities, preferred type and anything the office should know." /></label>
        <label className={`fee-request-upload${evidence ? ' has-file' : ''}`}>
          <IconUpload />
          <span><strong>{evidence?.name ?? 'Attach a photo or form'}</strong><small>Optional · JPG, PNG or PDF</small></span>
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

export default function StudentFeeRequests({ studentId, compact = false }: Props) {
  const [items, setItems] = useState<StudentFeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    listStudentFeeRequests(studentId)
      .then((result) => { if (active) setItems(result); })
      .catch((cause) => { if (active) setError(apiMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId]);

  const visible = useMemo(() => items.slice(0, compact ? 3 : 6), [compact, items]);
  return (
    <section className={`student-fee-requests${compact ? ' is-compact' : ''}`}>
      <div className="student-fee-requests__head">
        <div><span>Need something else?</span><h2>Items & other fees</h2><p>Request materials or another charge for the office to review.</p></div>
        <button type="button" className="btn student-fee-requests__create" onClick={() => setCreating(true)}><IconPlus /> New request</button>
      </div>
      {error && <div className="notice notice--warn" role="alert">{error}</div>}
      {loading && <output className="student-fee-requests__state">Loading requests…</output>}
      {!loading && visible.length > 0 && (
        <div className="student-fee-request-list">
          {visible.map((item) => (
            <article key={item.id}>
              <span className={`fee-request-status fee-request-status--${item.status.toLowerCase()}`}>{STATUS_COPY[item.status]}</span>
              <div><strong>{item.title}</strong><small>{item.requestDetails}</small></div>
              {item.status === 'INVOICED' ? <IconChevronRight /> : <span />}
            </article>
          ))}
        </div>
      )}
      {!loading && items.length === 0 && <p className="student-fee-requests__state">No item requests yet.</p>}
      {creating && <RequestForm studentId={studentId} onClose={() => setCreating(false)} onCreated={(request) => { setItems((current) => [request, ...current]); setCreating(false); }} />}
    </section>
  );
}
