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
  const offeringIncludesTerm = klass.offeringCode
    .toLocaleLowerCase()
    .includes(klass.academicTerm.trim().toLocaleLowerCase());

  return (
    <section className="card class-detail-summary dashboard-enter stagger-0">
      <div className="card__body class-detail-summary__body">
        <div className="class-detail-summary__head">
          <div className="class-detail-summary__identity">
            <h2 className="card__title class-detail-summary__title">{klass.courseCode}</h2>
            <div className="class-header__meta">
              <span className="cell-sub">{klass.offeringCode}</span>
              {!editingTerm && !offeringIncludesTerm && <span className="cell-sub">{klass.academicTerm}</span>}
              {!canManage && klass.teachers.length > 0 && (
                <span className="cell-sub">
                  {klass.teachers.map((teacher) => teacher.name).join(', ')}
                </span>
              )}
              {canManage && !editingTerm && (
                <button
                  type="button"
                  className="btn btn--quiet btn--sm class-detail-summary__edit"
                  disabled={busy}
                  onClick={() => setEditingTerm(true)}
                >
                  Edit term
                </button>
              )}
            </div>
          </div>

          {(badge || (canManage && runAction && 'status' in klass)) && (
            <div className="class-detail-summary__actions">
              {badge && <span className={badge.className}>{badge.label}</span>}
              {canManage && runAction && 'status' in klass && (
                <button
                  type="button"
                  className={`btn btn--sm${klass.status === 'ACTIVE' ? ' btn--quiet' : ''}`}
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
          )}
        </div>

        {canManage && editingTerm && (
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
        )}

        <div className="class-hero__stats">
          <div className="class-detail-summary__metric class-detail-summary__metric--students">
            <div className="stat__label">Students</div>
            <div className="profile-hero__metric">{klass.studentCount}</div>
          </div>
          <div className="class-detail-summary__metric class-detail-summary__metric--support">
            <div className="stat__label">Completed Sessions</div>
            <div className="profile-hero__metric">{completedSessionCount}</div>
          </div>
          <div className="class-detail-summary__metric class-detail-summary__metric--primary">
            <div className="stat__label">Overall Attendance</div>
            <div className="profile-hero__metric">{formatRate(attendanceRate)}</div>
          </div>
          <div className="class-detail-summary__metric class-detail-summary__metric--session">
            <div className="stat__label">Next session</div>
            <div className="profile-hero__metric profile-hero__metric--sm">
              {nextSession ? `${nextSession.dateLabel} · ${nextSession.time}` : 'None scheduled'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
