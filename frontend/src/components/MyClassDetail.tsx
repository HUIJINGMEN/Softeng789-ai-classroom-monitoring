import { useEffect, useMemo, useState } from 'react';
import ClassAttendanceTab from './ClassAttendanceTab';
import ClassDetailTabs, { type ClassDetailTabDef } from './ClassDetailTabs';
import ClassHeaderCard from './ClassHeaderCard';
import ClassOverviewTab from './ClassOverviewTab';
import ClassReportsTab from './ClassReportsTab';
import ClassSessionsCard from './ClassSessionsCard';
import MiniAttendanceRing from './MiniAttendanceRing';
import Pager from './Pager';
import PersonAvatar from './PersonAvatar';
import SearchField from './SearchField';
import { apiMessage } from '../lib/apiClient';
import {
  buildClassRow,
  lastRecordedSessionForStudent,
  withClassAttendanceRates
} from '../lib/classRows';
import { listClassStudents, type ClassSummaryApiResponse } from '../lib/classAdminApi';
import { avatarTone } from '../lib/format';
import { mapStudentApiToUi } from '../lib/studentApi';
import { studentLevelLabel } from '../lib/studentLevels';
import { usePagination } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { Student } from '../types';

type TabKey = 'overview' | 'students' | 'sessions' | 'attendance' | 'reports';

const TABS: ClassDetailTabDef<TabKey>[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'students', label: 'Students' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'attendance', label: 'Class Attendance' },
  { key: 'reports', label: 'Reports' }
];

interface Props {
  readonly klass: ClassSummaryApiResponse;
  readonly console: Console;
  readonly onBack: () => void;
}

/** Read-only counterpart to Admin's ClassDetail.tsx — a teacher can see their own class's roster,
 *  sessions, attendance and Feedback reports here, but there's no add/remove/transfer/assign
 *  anywhere on this page. Everything comes from c.students/c.sessions, which are already scoped
 *  server-side to this teacher's own classes, so only the class summary itself needs a fetch
 *  (done by the caller, MyClasses.tsx). */
export default function MyClassDetail({ klass, console: c, onBack }: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [roster, setRoster] = useState<Student[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState('');
  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterPage, setRosterPage] = useState(0);

  const refreshRoster = () => {
    setRosterLoading(true);
    listClassStudents(klass.id)
      .then((students) => {
        setRoster(students.map((student) => mapStudentApiToUi(student)));
        setRosterError('');
      })
      .catch((error) => setRosterError(apiMessage(error)))
      .finally(() => setRosterLoading(false));
  };

  useEffect(() => {
    setRoster([]);
    setRosterQuery('');
    setRosterPage(0);
    refreshRoster();
  }, [klass.id]);

  const row = useMemo(
    () => buildClassRow(klass.id, c.sessions, c.countsForSession),
    [klass.id, c.sessions, c.countsForSession]
  );

  // Students tab: lowest attendance (most in need of a teacher's attention) first, students with
  // no recorded rate yet at the very end since there's nothing actionable there.
  const rosterWithRates = useMemo(
    () => withClassAttendanceRates(roster, row.classSessions, c.attendanceStatusFor),
    [roster, row.classSessions, c.attendanceStatusFor]
  );

  const rosterByAttention = useMemo(
    () =>
      rosterWithRates
        .filter((student) => {
          const query = rosterQuery.trim().toLowerCase();
          return (
            !query ||
            student.name.toLowerCase().includes(query) ||
            student.id.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          if (a.rate === null && b.rate === null) return 0;
          if (a.rate === null) return 1;
          if (b.rate === null) return -1;
          return a.rate - b.rate;
        }),
    [rosterQuery, rosterWithRates]
  );

  const pagedRoster = usePagination(rosterByAttention, rosterPage, setRosterPage, 8);

  const openStudent = (studentId: string) => {
    c.setProfileId(studentId);
    c.setPage('students');
  };

  return (
    <div className="page__inner">
      <button type="button" className="btn page-action" onClick={onBack}>
        ← Back to all classes
      </button>

      <ClassHeaderCard
        klass={klass}
        attendanceRate={row.attendance.rate}
        completedSessionCount={row.completedSessionCount}
        nextSession={row.nextSession}
      />

      <ClassDetailTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <ClassOverviewTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          nextSession={row.nextSession}
          roster={rosterWithRates}
          onViewSessions={() => setTab('sessions')}
          onViewStudents={() => setTab('students')}
          onOpenStudent={openStudent}
        />
      )}

      {tab === 'students' && (
        <section className="card dashboard-enter stagger-1">
          <div className="card__body">
            <div className="card__title-line card__title--spaced">
              <div>
                <div className="card__title">Roster</div>
                <div className="card__sub">{roster.length} enrolled student{roster.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="class-roster-toolbar">
              <SearchField
                value={rosterQuery}
                onChange={(value) => {
                  setRosterQuery(value);
                  setRosterPage(0);
                }}
                label="Search roster"
                placeholder="Name or student number"
              />
              <span className="cell-sub">Sorted by attendance requiring attention</span>
            </div>
            {rosterError && (
              <div className="notice notice--warn">
                <span className="notice__mark" aria-hidden="true" />
                <span>{rosterError}</span>
                <span className="spacer" />
                <button type="button" className="btn btn--sm" onClick={refreshRoster}>
                  Retry
                </button>
              </div>
            )}
            {rosterLoading && roster.length === 0 ? (
              <div className="empty empty--compact" role="status">Loading roster…</div>
            ) : rosterByAttention.length === 0 && !rosterError ? (
              <div className="empty empty--compact">
                {roster.length === 0 ? 'No students enrolled in this class yet.' : 'No students match your search.'}
              </div>
            ) : (
              pagedRoster.rows.map((student) => {
                const lastSession = lastRecordedSessionForStudent(
                  student.id,
                  row.classSessions,
                  c.attendanceStatusFor
                );
                return (
                  <button
                    key={student.id}
                    type="button"
                    className="kv kv--history class-roster-row"
                    onClick={() => openStudent(student.id)}
                  >
                    <div className="person">
                      <PersonAvatar
                        photoUrl={student.registrationPhoto}
                        name={student.name}
                        tone={avatarTone(student.id, 0)}
                        alt={`${student.name} registration`}
                      />
                      <div className="person__details">
                        <div className="cell-strong cell-strong--compact">{student.name}</div>
                        <div className="cell-sub">{student.id}</div>
                      </div>
                    </div>
                    <div className="roster-row__meta">
                      <span className="tag">{studentLevelLabel(student.level)}</span>
                      <MiniAttendanceRing rate={student.rate} tier="student" />
                      <div className="cell-sub">
                        {lastSession ? `Last recorded ${lastSession.dateLabel}` : 'No attendance yet'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            {rosterByAttention.length > 0 && (
              <Pager
                label={pagedRoster.label}
                page={pagedRoster.page}
                pageCount={pagedRoster.pageCount}
                canPrev={pagedRoster.canPrev}
                canNext={pagedRoster.canNext}
                onPrev={pagedRoster.prev}
                onNext={pagedRoster.next}
                onGoToPage={pagedRoster.goToPage}
              />
            )}
          </div>
        </section>
      )}

      {tab === 'sessions' && (
        <ClassSessionsCard
          courseOfferingId={klass.id}
          sessions={row.classSessions}
          sessionsLoading={c.sessionsLoading}
          sessionsError={c.sessionsError}
          console={c}
          onRetry={() => void c.refreshSessions()}
        />
      )}

      {tab === 'attendance' && (
        <ClassAttendanceTab
          attendance={row.attendance}
          classSessions={row.classSessions}
          countsForSession={c.countsForSession}
        />
      )}

      {tab === 'reports' && (
        <ClassReportsTab
          courseOfferingId={klass.id}
          classLabel={`${klass.courseCode} · ${klass.academicTerm}`}
          console={c}
        />
      )}
    </div>
  );
}
