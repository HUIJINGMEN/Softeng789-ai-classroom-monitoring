import { useMemo, useState } from 'react';
import { sessionRoomLabel } from '../lib/classroomApi';
import { statusClass } from '../lib/format';
import { sessionMatchesSearch } from '../lib/sessionSearch';
import { usePagination } from '../lib/table';
import Pager from './Pager';
import DirectoryState from './DirectoryState';
import SearchField from './SearchField';
import { IconArrowRight, IconClipboardCheck, IconPlus, IconSearch } from './icons';
import type { Console } from '../hooks/useConsole';
import type { Session } from '../types';
import useMediaQuery from '../hooks/useMediaQuery';
import MobileSessionDirectory from './mobile/MobileSessionDirectory';

interface Props {
  console: Console;
  onCreate: () => void;
  onSelect: () => void;
  onEdit: (session: Session) => void;
}

// Scheduled and Live sessions can still be fixed up; Completed and Cancelled are historical
// record and stay locked (the backend enforces the same rule, this just keeps the buttons from
// promising an action that would fail).
function isEditable(session: Session): boolean {
  return session.status === 'Scheduled' || session.status === 'Live';
}

export default function SessionManagementPanel({ console: c, onCreate, onSelect, onEdit }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const filteredSessions = useMemo(
    () => c.sessions.filter((session) => sessionMatchesSearch(session, query)),
    [c.sessions, query]
  );
  const paged = usePagination(filteredSessions, page, setPage);

  const openSession = (session: Session) => {
    c.selectSession(session.id);
    c.setCourse(session.course);
    onSelect();
  };

  if (isMobile) {
    return (
      <MobileSessionDirectory
        sessions={paged.rows}
        totalCount={c.sessions.length}
        selectedId={c.sessionId}
        query={query}
        pageLabel={paged.label}
        page={paged.page}
        pageCount={paged.pageCount}
        canPrev={paged.canPrev}
        canNext={paged.canNext}
        onQueryChange={(value) => { setQuery(value); setPage(0); }}
        onCreate={onCreate}
        onOpen={openSession}
        onEdit={onEdit}
        onCancel={(session) => void c.cancelSession(session.id)}
        onPrev={paged.prev}
        onNext={paged.next}
        onGoToPage={paged.goToPage}
      />
    );
  }

  return (
    <section className="card session-list">
      <div className="card__head">
        <div>
          <div className="card__title">Classroom sessions</div>
          <div className="card__sub">Open a session to review or correct its attendance.</div>
        </div>
        <button type="button" className="btn btn--primary btn--with-icon" onClick={onCreate}>
          <IconPlus /> New session
        </button>
      </div>
      {c.sessions.length > 0 && (
        <SearchField
          className="card-list-search"
          label="Search sessions"
          value={query}
          placeholder="Course, room, teacher or date"
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
        />
      )}
      {filteredSessions.length > 0 && <div className="session-list__table-wrap">
        <table className="table table--compact session-management-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Room</th>
              <th>Teacher</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th className="table__action-cell">Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((session) => (
              <tr
                key={session.id}
                className={session.id === c.sessionId ? 'table__row--selected' : ''}
              >
                <td className="cell-strong" data-label="Course">
                  <span className="session-management-table__course">
                    <span>{session.course}</span>
                    {session.id === c.sessionId && <span className="badge badge--neutral">Current</span>}
                  </span>
                </td>
                <td data-label="Room">{sessionRoomLabel(session)}</td>
                <td data-label="Teacher">{session.teacherName ?? 'Unassigned Teacher'}</td>
                <td data-label="Date">{session.dateLabel}</td>
                <td className="mono" data-label="Time">{session.time}</td>
                <td data-label="Status">
                  <span className={statusClass(session.status)}>{sessionStatusCode(session)}</span>
                </td>
                <td className="table__action-cell" data-label="Actions">
                  {confirmingCancelId === session.id ? (
                    <span className="table__action-group">
                      <span className="cell-sub">Cancel this session?</span>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          void c.cancelSession(session.id);
                          setConfirmingCancelId(null);
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm"
                        onClick={() => setConfirmingCancelId(null)}
                      >
                        Back
                      </button>
                    </span>
                  ) : (
                    <span className="table__action-group">
                      {isEditable(session) && (
                        <>
                          <button type="button" className="btn btn--quiet btn--sm" onClick={() => onEdit(session)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            onClick={() => setConfirmingCancelId(session.id)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn--sm btn--with-icon session-management-table__open"
                        onClick={() => {
                          openSession(session);
                        }}
                      >
                        Open attendance <IconArrowRight />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>}
      {filteredSessions.length === 0 && (
        <DirectoryState
          icon={c.sessions.length === 0 ? <IconClipboardCheck /> : <IconSearch />}
          title={c.sessions.length === 0 ? 'No classroom sessions yet' : 'No matching sessions'}
          description={c.sessions.length === 0 ? 'Create a session to begin recording attendance.' : 'Try another course, room, teacher, date or status.'}
          action={c.sessions.length === 0 ? (
            <button type="button" className="btn btn--primary btn--with-icon" onClick={onCreate}><IconPlus /> Create session</button>
          ) : (
            <button type="button" className="btn btn--sm" onClick={() => setQuery('')}>Clear search</button>
          )}
        />
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
    </section>
  );
}

export function sessionStatusCode(session: { status: string; statusCode?: string }): string {
  if (session.statusCode) return session.statusCode;
  if (session.status === 'Live') return 'ACTIVE';
  if (session.status === 'Completed') return 'COMPLETED';
  if (session.status === 'Cancelled') return 'CANCELLED';
  return 'SCHEDULED';
}
