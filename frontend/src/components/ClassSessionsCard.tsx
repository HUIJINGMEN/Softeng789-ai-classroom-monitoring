import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import CreateSessionModal from './CreateSessionModal';
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

interface Props {
  readonly courseOfferingId: string;
  readonly sessions: readonly Session[];
  readonly sessionsLoading: boolean;
  readonly sessionsError: string;
  readonly console: Console;
  readonly onRetry?: () => void;
}

export default function ClassSessionsCard({
  courseOfferingId,
  sessions,
  sessionsLoading,
  sessionsError,
  console: c,
  onRetry
}: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [creatingSession, setCreatingSession] = useState(false);
  const filteredSessions = useMemo(
    () => sessions.filter((session) => sessionMatchesSearch(session, query)),
    [sessions, query]
  );
  const paged = usePagination(filteredSessions, page, setPage);

  return (
    <section className="card dashboard-enter stagger-3">
      <div className="card__head">
        <div className="card__title-row">
          <div>
            <div className="card__title">Sessions</div>
            <div className="card__sub">{sessions.length} total</div>
          </div>
        </div>
        <div className="card__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm btn--with-icon"
            onClick={() => setCreatingSession(true)}
          >
            <IconPlus /> Create Session
          </button>
        </div>
      </div>

      <div className="card__body">
        {sessions.length > 0 && (
          <SearchField
            className="class-sessions__search"
            label="Search sessions"
            value={query}
            placeholder="Date, room, teacher, status or title"
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
          />
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

        {paged.rows.map((session) => {
          const counts = c.countsForSession(session.id);
          const rate = percentageOf(counts.present + counts.late, counts.total);
          return (
            <div key={session.id} className="kv">
              <div>
                <div className="cell-strong cell-strong--compact">
                  {session.dateLabel} · {sessionRoomLabel(session)}
                </div>
                <div className="cell-sub">{session.time}</div>
              </div>
              <div className="row-inline">
                {session.status === 'Completed' && counts.total > 0 && (
                  <span className="cell-sub mono">{formatRate(rate)}</span>
                )}
                <span className={statusClass(session.status)}>{session.status}</span>
                {session.recordId && (
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm btn--with-icon"
                    onClick={() => {
                      c.selectSession(session.id);
                      c.setPage('session-detail');
                    }}
                  >
                    Open <IconArrowRight />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sessionsLoading && sessions.length === 0 && (
          <div className="empty empty--compact">Loading sessions…</div>
        )}

        {!sessionsLoading && !sessionsError && sessions.length === 0 && (
          <div className="empty empty--compact">No sessions scheduled for this class yet.</div>
        )}

        {!sessionsLoading && !sessionsError && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="empty empty--compact">No sessions match your search.</div>
        )}

        {filteredSessions.length > 0 && (
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

      {creatingSession &&
        createPortal(
          <CreateSessionModal
            saving={c.sessionsLoading}
            lockedCourseOfferingId={courseOfferingId}
            onCreate={async (draft) => {
              const succeeded = await c.createSession(draft);
              if (succeeded) onRetry?.();
              return succeeded;
            }}
            onClose={() => setCreatingSession(false)}
          />,
          document.body
        )}
    </section>
  );
}
