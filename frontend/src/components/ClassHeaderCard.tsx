import { useState } from 'react';
import { classStatusBadge } from '../lib/classStatusBadge';
import { updateClass, type ClassApiResponse } from '../lib/classAdminApi';

interface Props {
  readonly klass: ClassApiResponse;
  readonly busy: boolean;
  readonly runAction: (action: () => Promise<unknown>) => Promise<void>;
  readonly attendanceRate: number | null;
}

export default function ClassHeaderCard({ klass, busy, runAction, attendanceRate }: Props) {
  const [editingTerm, setEditingTerm] = useState(false);
  const [termDraft, setTermDraft] = useState(klass.academicTerm);

  const saveTerm = () => {
    const trimmed = termDraft.trim();
    if (!trimmed || trimmed === klass.academicTerm) {
      setEditingTerm(false);
      setTermDraft(klass.academicTerm);
      return;
    }
    runAction(() => updateClass(klass.id, { academicTerm: trimmed, status: klass.status })).then(() =>
      setEditingTerm(false)
    );
  };

  const badge = classStatusBadge(klass.status);

  return (
    <section className="card dashboard-enter stagger-0">
      <div className="card__body profile-hero">
        <div className="profile-hero__main">
          <div className="profile-hero__name">{klass.courseCode}</div>
          <div className="cell-sub profile-hero__sub">{klass.offeringCode}</div>
          {editingTerm ? (
            <div className="row-inline">
              <input value={termDraft} onChange={(event) => setTermDraft(event.target.value)} />
              <button type="button" className="btn btn--sm" disabled={busy} onClick={saveTerm}>
                Save
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setEditingTerm(false);
                  setTermDraft(klass.academicTerm);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="row-inline">
              <span className="cell-sub">{klass.academicTerm}</span>
              <button type="button" className="btn btn--sm" onClick={() => setEditingTerm(true)}>
                Edit
              </button>
            </div>
          )}
        </div>
        <div className="profile-hero__stats">
          <div>
            <div className="stat__label">Status</div>
            <span className={badge.className}>{badge.label}</span>
          </div>
          <div>
            <div className="stat__label">Attendance</div>
            <div className="profile-hero__metric">{attendanceRate === null ? '—' : `${attendanceRate}%`}</div>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            runAction(() =>
              updateClass(klass.id, {
                academicTerm: klass.academicTerm,
                status: klass.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
              })
            )
          }
        >
          {klass.status === 'ACTIVE' ? 'Archive class' : 'Reactivate class'}
        </button>
      </div>
    </section>
  );
}
