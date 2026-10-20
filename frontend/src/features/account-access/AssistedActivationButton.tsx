import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { apiMessage } from '../../lib/apiClient';
import { useWorkflowCapabilities } from '../../lib/workflowCapabilities';
import { activationEligibility, createAssistedActivation, type AssistedActivation } from './api';
import './account-access.css';

interface Props {
  readonly kind: 'STUDENT' | 'STAFF';
  readonly accountId: string;
  readonly name: string;
}

function ActivationDialog({ kind, accountId, name, onClose }: Props & { readonly onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [activation, setActivation] = useState<AssistedActivation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const create = async () => {
    if (!confirmed || submitting.current || activation) return;
    submitting.current = true;
    setBusy(true); setError('');
    try { setActivation(await createAssistedActivation(kind, accountId)); }
    catch (cause) { setError(apiMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <Modal title="Help activate this account" subtitle={name} size="narrow" closeButton
    onClose={onClose} closeDisabled={busy} footer={<>
      <button type="button" className="btn" onClick={onClose} disabled={busy}>Close</button>
      {!activation && <button type="button" className="btn btn--primary" disabled={!confirmed || busy}
        onClick={() => void create()}>{busy ? 'Creating link…' : 'Create activation link'}</button>}
    </>}>
    <div className="activation-assistance">
      <p>For local testing only. This helps an existing account set its first password; it does not reset a password, approve a student or change access permissions.</p>
      {activation ? <>
        <label className="field"><span>Single-use activation link</span>
          <textarea rows={4} readOnly value={activation.link} onFocus={event => event.currentTarget.select()} />
        </label>
        <output>Ready to share privately. Expires {new Date(activation.expiresAt).toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland' })} Auckland time.</output>
        <p>Copy this link to the verified person. No email was sent. The link is not saved in this browser and disappears when you close this dialog.</p>
      </> : <label className="activation-assistance__confirmation">
        <input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
        <span>I have checked this person's identity and will share the link privately.</span>
      </label>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </Modal>;
}

export default function AssistedActivationButton(props: Props) {
  const { capabilities } = useWorkflowCapabilities();
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    let active = true;
    setEligible(false);
    if (capabilities?.assistedActivation) {
      activationEligibility(props.kind, props.accountId)
        .then(value => { if (active) setEligible(value.eligible); })
        .catch(() => { if (active) setEligible(false); });
    }
    return () => { active = false; };
  }, [capabilities?.assistedActivation, props.kind, props.accountId]);
  if (!eligible) return null;
  return <>
    <button type="button" className="btn btn--sm" onClick={() => setOpen(true)}>Help activate account</button>
    {open && <ActivationDialog {...props} onClose={() => setOpen(false)} />}
  </>;
}
