import { useState } from 'react';
import { classStatusBadge } from '../lib/classStatusBadge';
import { formatRate } from '../lib/format';
import {
  updateClass,
  type ClassApiResponse,
  type ClassSummaryApiResponse
} from '../lib/classAdminApi';
import type { Session } from '../types';

interface Props {
  readonly klass: ClassApiResponse | ClassSummaryApiResponse;
  readonly busy?: boolean;
  readonly runAction?: (action: () => Promise<unknown>) => Promise<void>;
  readonly attendanceRate: number | null;
  readonly completedSessionCount: number;
  readonly nextSession: Session | null;
}

export default function ClassHeaderCard({
  klass,
  busy = false,
  runAction,
  attendanceRate,
  completedSessionCount,
  nextSession
}: Props) {
  const [editingTerm, setEditingTerm] = useState(false);
  const [termDraft, setTermDraft] = useState(klass.academicTerm);

  const canManage = 'status' in klass && Boolean(runAction);

  const saveTerm = () => {
    const trimmed = termDraft.trim();
    if (!trimmed || trimmed === klass.academicTerm) {
      setEditingTerm(false);
      setTermDraft(klass.academicTerm);
      return;
    }
    if (!canManage || !runAction || !('status' in klass)) return;
    void runAction(async () => {
      await updateClass(klass.id, { academicTerm: trimmed, status: klass.status });
      setEditingTerm(false);
    });
  };

  const badge = 'status' in klass ? classStatusBadge(klass.status) : null;

  return (
    <section className="card dashboard-enter stagger-0">
      <div className="card__body">
        <div className="card__title-line">
          <div className="card__title">{klass.courseCode}</div>
          {badge && <span className={badge.className}>{badge.label}</span>}
        </div>
        <div className="cell-sub">{klass.offeringCode}</div>
        {canManage && editingTerm ? (
          <div className="row-inline class-term-editor">
            <input
              className="class-term-editor__input"
              value={termDraft}
              aria-label="Academic term"
              disabled={busy}
              autoFocus
              onChange={(event) => setTermDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  saveTerm();
                } else if (event.key === 'Escape') {
                  setEditingTerm(false);
                  setTermDraft(klass.academicTerm);
                }
              }}
            />
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
        ) : canManage ? (
          <div className="row-inline">
            <span className="cell-sub">{klass.academicTerm}</span>
            <button type="button" className="btn btn--sm" onClick={() => setEditingTerm(true)}>
              Edit term
            </button>
          </div>
        ) : (
          <div className="class-header__meta">
            <span className="cell-sub">{klass.academicTerm}</span>
            {klass.teachers.length > 0 && (
              <span className="cell-sub">
                {klass.teachers.map((teacher) => teacher.name).join(', ')}
              </span>
            )}
          </div>
        )}

        <div className="class-hero__stats">
          <div>
            <div className="stat__label">Students</div>
            <div className="profile-hero__metric">{klass.studentCount}</div>
          </div>
          <div>
            <div className="stat__label">Completed Sessions</div>
            <div className="profile-hero__metric">{completedSessionCount}</div>
          </div>
          <div>
            <div className="stat__label">Overall Attendance</div>
            <div className="profile-hero__metric">{formatRate(attendanceRate)}</div>
          </div>
          <div>
            <div className="stat__label">Next session</div>
            <div className="profile-hero__metric profile-hero__metric--sm">
              {nextSession ? `${nextSession.dateLabel} · ${nextSession.time}` : 'None scheduled'}
            </div>
          </div>
        </div>

        {canManage && runAction && 'status' in klass && (
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
        )}
      </div>
    </section>
  );
}
