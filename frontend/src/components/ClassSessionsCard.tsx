import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CreateSessionModal from './CreateSessionModal';
import ClassScheduleBuilder from './ClassScheduleBuilder';
import ClassScheduleTimetable from './ClassScheduleTimetable';
import { percentageOf } from '../lib/attendanceAnalytics';
import { sessionRoomLabel } from '../lib/classroomApi';
import { formatRate, statusClass } from '../lib/format';
import { sessionMatchesSearch } from '../lib/sessionSearch';
import { usePagination } from '../lib/table';
import Pager from './Pager';
import SearchField from './SearchField';
import { IconArrowRight, IconPlus } from './icons';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';
import type { ClassApiResponse, ClassSummaryApiResponse } from '../lib/classAdminApi';

interface Props {
  readonly klass: ClassApiResponse | ClassSummaryApiResponse;
  readonly sessions: readonly Session[];
  readonly sessionsLoading: boolean;
  readonly sessionsError: string;
  readonly console: Console;
  readonly onRetry?: () => void;
  readonly editable?: boolean;
}

export default function ClassSessionsCard({
  klass,
  sessions,
  sessionsLoading,
  sessionsError,
  console: c,
  onRetry,
  editable = false
}: Props) {
  const [view, setView] = useState<'timetable' | 'list'>('timetable');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [creatingSession, setCreatingSession] = useState(false);
  const [buildingSchedule, setBuildingSchedule] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const filteredSessions = useMemo(
    () => sessions.filter((session) => sessionMatchesSearch(session, query)),
    [sessions, query]
  );
  const paged = usePagination(filteredSessions, page, setPage);
  const completedCount = sessions.filter((session) => session.status === 'Completed').length;
  const scheduledCount = sessions.filter((session) => session.status === 'Scheduled').length;
  const liveCount = sessions.filter((session) => session.status === 'Live').length;
  const statusSummary = [
    `${sessions.length} total`,
    completedCount > 0 ? `${completedCount} completed` : '',
    scheduledCount > 0 ? `${scheduledCount} scheduled` : '',
    liveCount > 0 ? `${liveCount} live` : ''
  ].filter(Boolean).join(' · ');
  const openAttendance = (session: Session) => c.openSessionDetail(session.id, {
    page: 'classes',
    label: `Back to ${klass.courseCode} schedule`,
    classId: klass.id
  });

  return (
    <section className="card class-sessions-card dashboard-enter stagger-3">
      <div className="card__head">
        <div className="card__title-row">
          <div>
            <div className="card__title">Class schedule</div>
            <div className="card__sub">{statusSummary}</div>
          </div>
        </div>
        {editable && <div className="card__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setBuildingSchedule((current) => !current)}
          >
            {buildingSchedule ? 'Close timetable builder' : 'Add recurring timetable'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm btn--with-icon"
            onClick={() => setCreatingSession(true)}
          >
            <IconPlus /> Add one-off session
          </button>
        </div>}
      </div>

      <div className="card__body class-sessions-card__body">
        {buildingSchedule && (
          <ClassScheduleBuilder
            klass={klass}
            onClose={() => setBuildingSchedule(false)}
            onCreated={async (count) => {
              c.showToast(`${count} scheduled session${count === 1 ? '' : 's'} created.`);
              await Promise.all([c.refreshSessions(), onRetry?.()]);
            }}
          />
        )}
        {sessions.length > 0 && (
          <div className="class-schedule-viewbar">
            <div className="class-schedule-view-switch" role="group" aria-label="Schedule view">
              <button type="button" className={view === 'timetable' ? 'is-active' : ''} aria-pressed={view === 'timetable'} onClick={() => setView('timetable')}>Timetable</button>
              <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>Session list</button>
            </div>
            <span>Each block is one session. Edit its schedule or open its attendance separately.</span>
          </div>
        )}

        {sessions.length > 0 && view === 'timetable' && (
          <ClassScheduleTimetable
            sessions={sessions}
            editable={editable}
            onEditSession={setEditingSession}
            onOpenSession={openAttendance}
          />
        )}

        {sessions.length > 0 && view === 'list' && (
          <div className="class-sessions-toolbar">
            <SearchField
              className="class-sessions__search"
              label="Search sessions"
              value={query}
              placeholder="Date, room, teacher or status"
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
            />
            <span className="cell-sub">
              {query.trim()
                ? `${filteredSessions.length} result${filteredSessions.length === 1 ? '' : 's'}`
                : `${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
            </span>
          </div>
        )}

        {sessionsError && (
          <div className="notice notice--warn">
            <span className="notice__mark" aria-hidden="true" />
            <span>{sessionsError}</span>
            {onRetry && (
              <>
                <span className="spacer" />
                <button type="button" className="btn btn--sm" onClick={onRetry}>
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        {view === 'list' && paged.rows.length > 0 && (
          <div className="class-session-list-head" aria-hidden="true">
            <span>Session</span>
            <span>Location</span>
            <span>Attendance</span>
            <span>Status</span>
            <span />
          </div>
        )}

        {view === 'list' && paged.rows.map((session) => {
          const counts = c.countsForSession(session.id);
          const rate = percentageOf(counts.present + counts.late, counts.total);
          return (
            <div key={session.id} className="kv class-session-row">
              <div className="class-session-row__identity">
                <div className="cell-strong cell-strong--compact">{session.dateLabel}</div>
                <div className="cell-sub class-session-row__time">{session.time}</div>
              </div>
              <div className="class-session-row__location">
                <div className="cell-strong cell-strong--compact">{sessionRoomLabel(session)}</div>
                <div className="cell-sub">
                  {session.teacherName || 'Teacher not assigned'}
                </div>
              </div>
              <div className="class-session-row__attendance">
                {session.status === 'Completed' && counts.total > 0 ? (
                  <>
                    <strong>{formatRate(rate)}</strong>
                    <span>{counts.present + counts.late} of {counts.total} attended</span>
                  </>
                ) : (
                  <span>Not recorded</span>
                )}
              </div>
              <span className={`${statusClass(session.status)} class-session-row__status`}>{session.status}</span>
              {session.recordId ? (
                <div className="class-session-row__actions">
                  {editable && (session.status === 'Scheduled' || session.status === 'Live') && (
                    confirmingCancelId === session.id ? (
                      <span className="class-session-row__confirm">
                        <small>Cancel this session?</small>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => {
                            void (async () => {
                              await c.cancelSession(session.id);
                              setConfirmingCancelId(null);
                              await onRetry?.();
                            })();
                          }}
                        >Confirm</button>
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmingCancelId(null)}>Back</button>
                      </span>
                    ) : (
                      <>
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEditingSession(session)}>Edit schedule</button>
                        <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmingCancelId(session.id)}>Cancel</button>
                      </>
                    )
                  )}
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm btn--with-icon class-session-row__open"
                    onClick={() => openAttendance(session)}
                  >
                    Attendance <IconArrowRight />
                  </button>
                </div>
              ) : <span />}
            </div>
          );
        })}

        {sessionsLoading && sessions.length === 0 && (
          <div className="class-session-skeletons" aria-live="polite" aria-label="Loading sessions">
            {[0, 1, 2].map((item) => (
              <div key={item} className="class-session-skeleton">
                <span className="skeleton class-session-skeleton__primary" />
                <span className="skeleton class-session-skeleton__secondary" />
                <span className="skeleton class-session-skeleton__metric" />
                <span className="skeleton class-session-skeleton__status" />
              </div>
            ))}
          </div>
        )}

        {!sessionsLoading && !sessionsError && sessions.length === 0 && (
          <div className="empty empty--compact">
            No sessions scheduled yet. Add a recurring timetable or create a one-off session.
          </div>
        )}

        {view === 'list' && !sessionsLoading && !sessionsError && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="empty empty--compact">No sessions match your search.</div>
        )}

        {view === 'list' && filteredSessions.length > 0 && (
          <Pager
            label={paged.label}
            page={paged.page}
            pageCount={paged.pageCount}
            canPrev={paged.canPrev}
            canNext={paged.canNext}
            onPrev={paged.prev}
            onNext={paged.next}
            onGoToPage={paged.goToPage}
          />
        )}
      </div>

      {editable && creatingSession &&
        createPortal(
          <CreateSessionModal
            saving={c.sessionsLoading}
            lockedCourseOfferingId={klass.id}
            onCreate={async (draft) => {
              const succeeded = await c.createSession(draft);
              if (succeeded) onRetry?.();
              return succeeded;
            }}
            onClose={() => setCreatingSession(false)}
          />,
          document.body
        )}

      {editable && editingSession &&
        createPortal(
          <CreateSessionModal
            saving={c.sessionsLoading}
            editingSession={editingSession}
            onCreate={c.createSession}
            onUpdate={async (sessionId, draft) => {
              const succeeded = await c.updateSession(sessionId, draft);
              if (succeeded) await onRetry?.();
              return succeeded;
            }}
            onUpdateFuture={async (sessionId, draft) => {
              const succeeded = await c.updateFutureSessions(sessionId, draft);
              if (succeeded) await onRetry?.();
              return succeeded;
            }}
            onClose={() => setEditingSession(null)}
          />,
          document.body
        )}
    </section>
  );
}
