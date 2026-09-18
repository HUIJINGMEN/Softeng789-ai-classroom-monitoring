import { useState } from 'react';
import Pager from '../Pager';
import SearchField from '../SearchField';
import { IconArrowRight, IconPlus } from '../icons';
import { sessionRoomLabel } from '../../lib/classroomApi';
import { statusClass } from '../../lib/format';
import type { Session } from '../../types';

interface Props {
  readonly sessions: readonly Session[];
  readonly totalCount: number;
  readonly selectedId: string;
  readonly query: string;
  readonly pageLabel: string;
  readonly page: number;
  readonly pageCount: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly onQueryChange: (value: string) => void;
  readonly onCreate: () => void;
  readonly onOpen: (session: Session) => void;
  readonly onEdit: (session: Session) => void;
  readonly onCancel: (session: Session) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToPage: (page: number) => void;
}

function isEditable(session: Session): boolean {
  return session.status === 'Scheduled' || session.status === 'Live';
}

function sessionStatusCode(session: Session): string {
  if (session.statusCode) return session.statusCode;
  if (session.status === 'Live') return 'ACTIVE';
  if (session.status === 'Completed') return 'COMPLETED';
  if (session.status === 'Cancelled') return 'CANCELLED';
  return 'SCHEDULED';
}

export default function MobileSessionDirectory(props: Props) {
  const [manageId, setManageId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  return (
    <section className="mobile-directory mobile-session-directory" aria-labelledby="mobile-sessions-title">
      <header className="mobile-directory__intro mobile-directory__intro--action">
        <div>
          <h2 id="mobile-sessions-title">Classroom sessions</h2>
          <p>Open a session to review attendance</p>
        </div>
        <button type="button" className="mobile-directory__primary" onClick={props.onCreate}>
          <IconPlus /><span>New</span>
        </button>
      </header>

      {props.totalCount > 0 && (
        <SearchField
          className="mobile-directory__search"
          value={props.query}
          onChange={props.onQueryChange}
          label="Search sessions"
          placeholder="Course, room or date"
        />
      )}

      <div className="mobile-record-list" aria-live="polite">
        {props.sessions.map((session) => {
          const editable = isEditable(session);
          const managing = manageId === session.id;
          return (
            <article key={session.id} className={`mobile-session-record${session.id === props.selectedId ? ' is-current' : ''}`}>
              <button type="button" className="mobile-session-record__main" onClick={() => props.onOpen(session)}>
                <span className="mobile-session-record__heading">
                  <strong>{session.course}</strong>
                  <span className={statusClass(session.status)}>{sessionStatusCode(session)}</span>
                </span>
                <span className="mobile-session-record__place">{sessionRoomLabel(session)}</span>
                <span className="mobile-session-record__time">
                  <span><small>Date</small><strong>{session.dateLabel}</strong></span>
                  <span><small>Time</small><strong>{session.time}</strong></span>
                </span>
                <span className="mobile-session-record__open">Open attendance <IconArrowRight /></span>
              </button>
              {editable && (
                <div className="mobile-session-record__manage">
                  <button type="button" aria-expanded={managing} onClick={() => setManageId(managing ? null : session.id)}>
                    {managing ? 'Close options' : 'Session options'}
                  </button>
                  {managing && cancelId !== session.id && (
                    <span>
                      <button type="button" onClick={() => props.onEdit(session)}>Edit details</button>
                      <button type="button" className="is-danger" onClick={() => setCancelId(session.id)}>Cancel session</button>
                    </span>
                  )}
                  {managing && cancelId === session.id && (
                    <span className="mobile-session-record__confirm">
                      <small>Cancel this session?</small>
                      <button type="button" onClick={() => setCancelId(null)}>Keep session</button>
                      <button type="button" className="is-danger" onClick={() => { props.onCancel(session); setCancelId(null); setManageId(null); }}>Yes, cancel</button>
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {props.sessions.length === 0 && (
          <div className="mobile-directory__state">
            <strong>{props.totalCount === 0 ? 'No classroom sessions yet' : 'No matching sessions'}</strong>
            <span>{props.totalCount === 0 ? 'Create a session to begin recording attendance.' : 'Try another course, room or date.'}</span>
            {props.totalCount === 0 && <button type="button" onClick={props.onCreate}>Create session</button>}
          </div>
        )}
      </div>

      {props.sessions.length > 0 && (
        <Pager
          label={props.pageLabel}
          page={props.page}
          pageCount={props.pageCount}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          onGoToPage={props.onGoToPage}
        />
      )}
    </section>
  );
}
