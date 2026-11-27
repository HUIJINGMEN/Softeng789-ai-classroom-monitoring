import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import { apiMessage } from '../../lib/apiClient';
import type { PageResponse } from '../../lib/pagination';
import { getKioskReviewEvidence, listKioskReviews, resolveKioskReview } from './api';
import {
  NOTE_MAX,
  RESOLUTIONS,
  evidenceErrorMessage,
  formatReviewTime,
  kindExplanation,
  kindLabel,
  noteError,
  resolutionLabel,
  resolveErrorMessage,
  resultLabel,
  studentLabel
} from './reviewModel';
import type { KioskReviewFilter, KioskReviewItem, KioskReviewResolution } from './types';
import './kioskReview.css';

interface Props {
  /** Opens the session register so an admin can correct a mark with the normal attendance history. */
  readonly onOpenSession: (sessionId: string) => void;
  /** Called after a review is resolved so the navigation badge can refresh. */
  readonly onChanged: () => void;
}

const FILTERS: readonly { value: KioskReviewFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ALL', label: 'All' }
];

export default function KioskReviewPage({ onOpenSession, onChanged }: Props) {
  const [filter, setFilter] = useState<KioskReviewFilter>('OPEN');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<KioskReviewItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listKioskReviews(filter, page));
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { void load(); }, [load]);

  const items = data?.items ?? [];
  const opened = items.find(item => item.id === openId) ?? null;

  function replace(updated: KioskReviewItem) {
    setData(current => current && {
      ...current,
      items: current.items.map(item => (item.id === updated.id ? updated : item))
    });
    onChanged();
  }

  return (
    <div className="kiosk-review">
      <div className="kiosk-review__toolbar">
        <div className="kiosk-review__filters" role="group" aria-label="Review status">
          {FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`btn btn--sm${filter === option.value ? ' btn--primary' : ''}`}
              aria-pressed={filter === option.value}
              onClick={() => { setFilter(option.value); setPage(0); }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--sm" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <p className="kiosk-review__intro">
        Kiosk check-ins where a student chose a lower-ranked match, or tried to check in without active enrolment.
        A mismatch is not proof of an error: check the evidence, then correct the session register if needed.
        Evidence photos are deleted 30 days after capture; the log stays.
      </p>

      {error && <p className="kiosk-review__error" role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="empty-state">{filter === 'OPEN' ? 'No kiosk check-ins need review.' : 'No kiosk reviews to show.'}</p>
      )}

      <ul className="kiosk-review__list">
        {items.map(item => (
          <li key={item.id} className="card kiosk-review__item">
            <div className="kiosk-review__item-head">
              <span className={`kiosk-review__kind kiosk-review__kind--${item.kind === 'NOT_ENROLLED_ATTEMPT' ? 'blocked' : 'mismatch'}`}>
                {kindLabel(item.kind)}
              </span>
              <span className={`kiosk-review__state${item.state === 'OPEN' ? ' kiosk-review__state--open' : ''}`}>
                {item.state === 'OPEN' ? 'Open' : resolutionLabel(item.resolution)}
              </span>
            </div>
            <dl className="kiosk-review__facts">
              <div><dt>Chosen</dt><dd>{studentLabel(item.selectedStudent)}{item.selectedRank ? ` · match ${item.selectedRank}` : ''}</dd></div>
              {item.kind === 'CANDIDATE_SELECTION_MISMATCH' && (
                <div><dt>Top match</dt><dd>{studentLabel(item.topCandidate)}</dd></div>
              )}
              <div><dt>Class</dt><dd>{item.session.classLabel} · {formatReviewTime(item.session.startTime)}</dd></div>
              <div><dt>Kiosk</dt><dd>{item.locationLabel}{item.campusName ? ` · ${item.campusName}` : ''}</dd></div>
              <div><dt>Result</dt><dd>{resultLabel(item.attemptResult, item.attendanceStatus)} · {formatReviewTime(item.processedAt ?? item.capturedAt)}</dd></div>
            </dl>
            <div className="kiosk-review__item-actions">
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setOpenId(item.id)}>
                {item.state === 'OPEN' ? 'Review' : 'View'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {data && data.totalPages > 1 && (
        <nav className="kiosk-review__pager" aria-label="Review pages">
          <button type="button" className="btn btn--sm" disabled={!data.hasPrevious || loading} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {data.page + 1} of {data.totalPages}</span>
          <button type="button" className="btn btn--sm" disabled={!data.hasNext || loading} onClick={() => setPage(page + 1)}>Next</button>
        </nav>
      )}

      {opened && (
        <ReviewDialog
          key={opened.id}
          item={opened}
          onClose={() => setOpenId(null)}
          onResolved={replace}
          onOpenSession={sessionId => { setOpenId(null); onOpenSession(sessionId); }}
        />
      )}
    </div>
  );
}

function ReviewDialog({ item, onClose, onResolved, onOpenSession }: {
  readonly item: KioskReviewItem;
  readonly onClose: () => void;
  readonly onResolved: (item: KioskReviewItem) => void;
  readonly onOpenSession: (sessionId: string) => void;
}) {
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [resolution, setResolution] = useState<KioskReviewResolution>('VERIFIED_CORRECT');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!item.evidenceAvailable) return undefined;
    const controller = new AbortController();
    let url = '';
    getKioskReviewEvidence(item.id, controller.signal)
      .then(blob => {
        // A late response after the dialog closed must not create an object URL nobody revokes.
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setEvidenceUrl(url);
      })
      .catch(cause => { if (!controller.signal.aborted) setEvidenceError(evidenceErrorMessage(cause)); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id, item.evidenceAvailable]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = noteError(note);
    if (invalid) { setSaveError(invalid); return; }
    setSaving(true);
    setSaveError('');
    try {
      onResolved(await resolveKioskReview(item.id, resolution, note));
    } catch (cause) {
      setSaveError(resolveErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const open = item.state === 'OPEN';
  return (
    <Modal
      size="wide"
      title={kindLabel(item.kind)}
      subtitle={kindExplanation(item)}
      closeButton
      closeDisabled={saving}
      onClose={onClose}
      onSubmit={open ? submit : undefined}
      footer={<>
        <button type="button" className="btn" onClick={() => onOpenSession(item.session.id)} disabled={saving}>
          Open session register
        </button>
        {open
          ? <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Resolve review'}</button>
          : <button type="button" className="btn btn--primary" onClick={onClose}>Close</button>}
      </>}
    >
      <div className="kiosk-review__dialog">
        <figure className="kiosk-review__evidence">
          {evidenceUrl && <img src={evidenceUrl} alt={`Kiosk capture for ${item.selectedStudent.name}`} />}
          {!evidenceUrl && !evidenceError && item.evidenceAvailable && <p role="status">Loading evidence…</p>}
          {!item.evidenceAvailable && <p>The evidence photo was deleted after 30 days. The log entry remains.</p>}
          {evidenceError && <p role="alert">{evidenceError}</p>}
          {item.evidenceAvailable && item.evidenceDeleteAfter && (
            <figcaption>Deleted automatically after {formatReviewTime(item.evidenceDeleteAfter)}.</figcaption>
          )}
        </figure>

        <dl className="kiosk-review__facts">
          <div><dt>Chosen</dt><dd>{studentLabel(item.selectedStudent)}{item.selectedRank ? ` · match ${item.selectedRank}` : ''}</dd></div>
          {item.kind === 'CANDIDATE_SELECTION_MISMATCH' && <div><dt>Top match</dt><dd>{studentLabel(item.topCandidate)}</dd></div>}
          <div><dt>Class</dt><dd>{item.session.classLabel} · {formatReviewTime(item.session.startTime)}</dd></div>
          <div><dt>Kiosk</dt><dd>{item.locationLabel}{item.campusName ? ` · ${item.campusName}` : ''}</dd></div>
          <div><dt>Captured</dt><dd>{formatReviewTime(item.capturedAt)}</dd></div>
          <div><dt>Result</dt><dd>{resultLabel(item.attemptResult, item.attendanceStatus)} · {formatReviewTime(item.processedAt)}</dd></div>
          {!open && <>
            <div><dt>Resolution</dt><dd>{resolutionLabel(item.resolution)}{item.resolvedByName ? ` by ${item.resolvedByName}` : ''} · {formatReviewTime(item.resolvedAt)}</dd></div>
            {item.note && <div><dt>Note</dt><dd>{item.note}</dd></div>}
          </>}
        </dl>

        {open && (
          <fieldset className="kiosk-review__resolve">
            <legend>Resolution</legend>
            <p className="kiosk-review__hint">Resolving does not change attendance. Correct marks in the session register first.</p>
            {RESOLUTIONS.map(option => (
              <label key={option.value} className="kiosk-review__option">
                <input type="radio" name="resolution" value={option.value} checked={resolution === option.value}
                  onChange={() => setResolution(option.value)} disabled={saving} />
                <span><strong>{option.label}</strong> {option.hint}</span>
              </label>
            ))}
            <label className="kiosk-review__note">
              <span>Note (optional)</span>
              <textarea value={note} maxLength={NOTE_MAX} rows={3} disabled={saving} onChange={event => setNote(event.target.value)} />
            </label>
            {saveError && <p className="kiosk-review__error" role="alert">{saveError}</p>}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
