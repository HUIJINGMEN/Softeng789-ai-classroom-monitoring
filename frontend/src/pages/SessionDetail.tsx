import { useMemo, useState } from 'react';
import BackButton from '../components/BackButton';
import { IconClipboardCheck } from '../components/icons';
import Pager from '../components/Pager';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import { sessionDisplayName } from '../lib/eventDisplay';
import { sessionRoomLabel } from '../lib/classroomApi';
import {
  buildSessionDateOptions,
  firstSessionForScope,
  sessionsForCourse
} from '../features/session-attendance/sessionAttendanceModel';
import { attendanceStatusLabel, formatRate, statusClass } from '../lib/format';
import { recordedAttendanceCount } from '../lib/attendanceAnalytics';
import { formatTimestampClock } from '../lib/sessionTime';
import { sortRows, usePagination, useSort } from '../lib/table';
import type { AttendanceStatus } from '../types';
import type { Console } from '../hooks/useConsole';

type Key = 'sid' | 'name' | 'status' | 'in' | 'out';

const STATUS_ORDER: Record<AttendanceStatus, number> = {
  Present: 0,
  Late: 1,
  Absent: 2,
  Unknown: 3
};
const STATUS_OPTIONS: { value: 'All' | AttendanceStatus; label: string }[] = [
  { value: 'All', label: 'All statuses' },
  { value: 'Present', label: 'Present' },
  { value: 'Late', label: 'Late' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Unknown', label: 'Not recorded' }
];

export default function SessionDetail({ console: c }: { readonly console: Console }) {
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSort<Key>('name');
  const activeSession = c.activeSession;
  const navigableSessions = useMemo(
    () => c.sessionDetailOrigin?.classId
      ? c.sessions.filter((session) => session.courseOfferingId === c.sessionDetailOrigin?.classId)
      : c.sessions,
    [c.sessionDetailOrigin?.classId, c.sessions]
  );
  const sessionsInCourse = useMemo(
    () => sessionsForCourse(navigableSessions, c.course),
    [c.course, navigableSessions]
  );
  const sessionCourseOptions = useMemo(
    () => [
      'All courses',
      ...Array.from(new Set(navigableSessions.map((session) => session.course)))
        .sort((left, right) => left.localeCompare(right))
    ],
    [navigableSessions]
  );
  const dateOptions = useMemo(() => buildSessionDateOptions(sessionsInCourse), [sessionsInCourse]);
  const sessionOptions = useMemo(
    () => sessionsInCourse.filter(
      (session) => c.sessionDate === 'all' || session.date === c.sessionDate
    ),
    [c.sessionDate, sessionsInCourse]
  );

  const rows = useMemo(() => {
    const q = c.query.trim().toLowerCase();
    const built = activeSession.recordId
      ? c.attendanceRows
          .filter(
            (row) =>
              (c.course === 'All courses' || activeSession.course === c.course) &&
              (!q ||
                row.studentName.toLowerCase().includes(q) ||
                row.studentNumber.toLowerCase().includes(q))
          )
          .map((row) => ({
            sid: row.studentNumber,
            recordId: row.studentRecordId,
            name: row.studentName,
            status: row.status,
            in: formatTimestampClock(row.checkInTime),
            out: formatTimestampClock(row.checkOutTime)
          }))
      : [];

    const filtered = built.filter(
      (row) => c.statusFilter === 'All' || row.status === c.statusFilter
    );

    return sortRows(filtered, sort, (row, key) =>
      key === 'status' ? STATUS_ORDER[row.status] : row[key]
    );
  }, [activeSession.recordId, c, sort]);

  const paged = usePagination(rows, page, setPage);
  const visible = c.loading ? [] : paged.rows;
  const attended = c.counts.present + c.counts.late;

  const stats = [
    { label: 'Present', value: c.counts.present, helper: 'On time', tone: 'present' },
    { label: 'Late', value: c.counts.late, helper: 'Arrived after start', tone: 'late' },
    { label: 'Absent', value: c.counts.absent, helper: 'No check-in', tone: 'absent' },
    {
      label: 'Session attendance rate',
      value: formatRate(c.counts.rate),
      helper: `${attended} of ${recordedAttendanceCount(c.counts)} recorded marks attended · ${c.counts.unknown} not recorded`,
      tone: 'rate'
    }
  ];

  return (
    <div className="page__inner">
      <BackButton
        label={c.sessionDetailOrigin?.label ?? 'Back to attendance sessions'}
        onClick={c.closeSessionDetail}
        className="page-action"
      />

      <div className="toolbar-label">Switch session</div>
      <div className="toolbar session-switcher">
        <div className="field">
          <span>Course</span>
          {c.sessionDetailOrigin?.classId ? (
            <input value={activeSession.course} aria-label="Current class" disabled />
          ) : (
            <SelectMenu
              value={c.course}
              options={sessionCourseOptions.map((course) => ({ value: course, label: course }))}
              ariaLabel="Filter attendance by course"
              onChange={(course) =>
                c.softLoad(() => {
                  c.setCourse(course);
                  const next = firstSessionForScope(
                    navigableSessions,
                    course,
                    'all',
                    activeSession.date
                  );
                  if (next) c.selectSession(next.id);
                  setPage(0);
                })
              }
            />
          )}
        </div>

        <div className="field">
          <span>Date</span>
          <SelectMenu
            value={c.sessionDate}
            options={dateOptions.map((option) => ({ value: option.value, label: option.label }))}
            ariaLabel="Filter attendance by date"
            onChange={(value) =>
              c.softLoad(() => {
                c.setSessionDate(value);
                const scopedSessions = sessionsForCourse(navigableSessions, c.course);
                const first = value === 'all'
                  ? scopedSessions[0]
                  : scopedSessions.find((session) => session.date === value);
                if (first) {
                  if (value === 'all') c.setSessionId(first.id);
                  else c.selectSession(first.id);
                }
                setPage(0);
              })
            }
          />
        </div>

        <div className="field">
          <span>Classroom session</span>
          <SelectMenu
            value={c.sessionId}
            options={sessionOptions.map((session) => ({
              value: session.id,
              label: `${sessionDisplayName(session)} · ${session.time}`
            }))}
            ariaLabel="Choose classroom session"
            onChange={(sessionId) =>
              c.softLoad(() => {
                c.selectSession(sessionId);
                setPage(0);
              })
            }
          />
        </div>
      </div>

      <section className="card session-summary dashboard-enter stagger-0">
        <div className="session-summary__main">
          <div className="card__title-row">
            <span className="icon-inline icon-inline--title" aria-hidden="true">
              <IconClipboardCheck />
            </span>
            <div>
              <div className="card__title card__title--session">
                {activeSession.status === 'Live'
                  ? `Live attendance · ${activeSession.dateLabel}`
                  : `Attendance · ${activeSession.dateLabel}`}
              </div>
              <div className="session-summary__meta">
                <span>{activeSession.course}</span>
                <span>{sessionRoomLabel(activeSession)}</span>
                <span>{activeSession.teacherName ?? 'Unassigned Teacher'}</span>
                <span>{activeSession.time}</span>
              </div>
            </div>
          </div>
          <span className={statusClass(activeSession.status)}>{activeSession.status}</span>
        </div>
        <div className="session-summary__counts" aria-label="Selected session attendance summary">
          <span>Present {c.counts.present}</span>
          <span>Absent {c.counts.absent}</span>
          <span>Not recorded {c.counts.unknown}</span>
        </div>
      </section>

      <div className="stat-grid">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`stat attendance-stat attendance-stat--${stat.tone} dashboard-enter stagger-${index + 1}`}
          >
            <div className="attendance-stat__head">
              <span className="attendance-stat__marker" aria-hidden="true" />
              <div className="stat__label">{stat.label}</div>
            </div>
            <div className="stat__value stat__value--attendance">{stat.value}</div>
            <div className="stat__delta stat__delta--muted">{stat.helper}</div>
          </div>
        ))}
      </div>

      {(c.sessionsError || c.attendanceError) && (
        <div className="notice notice--warn">
          <span className="notice__mark" aria-hidden="true" />
          <span>{c.attendanceError || c.sessionsError}</span>
        </div>
      )}

      <section className="card session-records dashboard-enter stagger-6">
        <div className="toolbar-label">Filter records</div>
        <div className="toolbar toolbar--plain">
          <div className="field">
            <span>Status</span>
            <SelectMenu
              value={c.statusFilter}
              options={STATUS_OPTIONS}
              ariaLabel="Filter attendance by status"
              onChange={(status) =>
                c.softLoad(() => {
                  c.setStatusFilter(status);
                  setPage(0);
                })
              }
            />
          </div>

          <SearchField
            value={c.query}
            placeholder="Student name or ID"
            onChange={(value) => {
              c.setQuery(value);
              setPage(0);
            }}
          />
        </div>

        <table className="table session-attendance-table">
          <SortableHeader
            columns={[
              { key: 'sid', label: 'Student ID' },
              { key: 'name', label: 'Student name' },
              { key: 'status', label: 'Status' },
              { key: 'in', label: 'Check-in' },
              { key: 'out', label: 'Check-out' }
            ]}
            sort={sort}
            onSort={toggle}
          />
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.sid}
                className="table__row--clickable"
                tabIndex={0}
                onClick={() => {
                  c.setProfileId(row.recordId);
                  c.setPage('students');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    c.setProfileId(row.recordId);
                    c.setPage('students');
                  }
                }}
              >
                <td className="mono" data-label="Student ID">{row.sid}</td>
                <td className="cell-strong" data-label="Student">{row.name}</td>
                <td data-label="Status">
                  <span className={statusClass(row.status)}>{attendanceStatusLabel(row.status)}</span>
                </td>
                <td className="mono" data-label="Check-in">{row.in}</td>
                <td className="mono" data-label="Check-out">{row.out}</td>
                <td className="table__action-cell" data-label="Action">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      c.setCorrectRowId(row.recordId);
                    }}
                  >
                    Correct manually
                  </button>
                </td>
              </tr>
            ))}

            {c.loading &&
              ['62%', '80%', '48%', '71%', '56%', '66%'].map((width, i) => (
                <tr key={i}>
                  <td colSpan={6} className="table__skeleton-cell">
                    <div className={`skeleton skeleton--w-${width.replace('%', '')}`} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!c.loading && rows.length === 0 && (
          <div className="empty">
            {activeSession.recordId
              ? 'No attendance records match the current filters.'
              : 'Create or select a classroom session to load attendance records.'}
          </div>
        )}

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
      </section>
    </div>
  );
}
