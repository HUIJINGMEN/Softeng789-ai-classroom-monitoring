import SelectMenu from '../components/SelectMenu';
import { eventMatchesStudent, sessionDisplayName } from '../lib/eventDisplay';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import type { Console } from '../hooks/useConsole';

export default function Reports({ console: c }: { console: Console }) {
  const inRange = (sessionId: string) => {
    const session = c.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) return false;
    return (
      session.date >= c.dateFrom &&
      session.date <= c.dateTo &&
      (c.course === 'All courses' || session.course === c.course)
    );
  };

  const reportable = c.events.filter(
    (event) =>
      (event.status === 'Confirmed' || event.status === 'Corrected') && inRange(event.sessionId)
  );

  const typeCounts = reportable.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});
  const maxType = Math.max(1, ...Object.values(typeCounts));

  const rangeSessions = c.sessions.filter(
    (session) =>
      session.date >= c.dateFrom &&
      session.date <= c.dateTo &&
      (c.course === 'All courses' || session.course === c.course)
  );

  const totals = rangeSessions.reduce(
    (acc, session) => {
      const counts = c.countsForSession(session.id);
      return {
        present: acc.present + counts.present,
        late: acc.late + counts.late,
        absent: acc.absent + counts.absent
      };
    },
    { present: 0, late: 0, absent: 0 }
  );
  const seats = totals.present + totals.late + totals.absent || 1;

  const pendingCount = c.events.filter(
    (event) => event.status === 'Pending Review' && inRange(event.sessionId)
  ).length;
  const rejectedCount = c.events.filter(
    (event) => event.status === 'Rejected' && inRange(event.sessionId)
  ).length;

  const summary: [string, string][] = [
    ['Sessions in range', String(rangeSessions.length)],
    ['Attendance marks recorded', String(seats)],
    ['Present', String(totals.present)],
    ['Late', String(totals.late)],
    ['Absent', String(totals.absent)],
    ['Overall attendance rate', `${Math.round(((totals.present + totals.late) / seats) * 100)}%`]
  ];

  return (
    <div className="page__inner">
      <div className="toolbar">
        <div className="field">
          <span>Course</span>
          <SelectMenu
            value={c.course}
            options={c.courseOptions.map((course) => ({ value: course, label: course }))}
            ariaLabel="Filter reports by course"
            onChange={c.setCourse}
          />
        </div>
        <label className="field">
          From
          <input type="date" value={c.dateFrom} onChange={(e) => c.setDateFrom(e.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={c.dateTo} onChange={(e) => c.setDateTo(e.target.value)} />
        </label>
        <div className="reports__export-action">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              c.showToast(
                `Report exported (simulated) — attendance + confirmed events, ${c.dateFrom} to ${c.dateTo}.`
              )
            }
          >
            Export report
          </button>
        </div>
      </div>

      <div className="reports__note">
        Only confirmed or corrected events are included in these summaries. {pendingCount} pending
        and {rejectedCount} rejected events are excluded.
      </div>

      <div className="grid-2">
        <section className="card dashboard-enter stagger-0">
          <div className="card__body">
            <div className="card__title reports__section-title">
              Attendance summary
            </div>
            {summary.map(([key, value]) => (
              <div key={key} className="kv">
                <span className="kv__k">{key}</span>
                <span className="kv__v mono">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card dashboard-enter stagger-1">
          <div className="card__body">
            <div className="card__title reports__section-title">
              Confirmed event summary
            </div>
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="reports__event-row">
                <div className="reports__event-head">
                  <span className="reports__event-type">{type}</span>
                  <span className="mono reports__event-count">
                    {count}
                  </span>
                </div>
                <div className="conf-track">
                  <div
                    className="conf-fill reports__bar-fill"
                    style={{ width: `${(count / maxType) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {reportable.length === 0 && (
              <div className="reports__empty">
                No confirmed or corrected events in this range yet. Review candidate events on the
                AI Events page.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card dashboard-enter stagger-2">
        <div className="card__head">
          <div className="card__title">Session-level report</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Date</th>
              <th>Present / enrolled</th>
              <th>Attendance rate</th>
              <th>Confirmed events</th>
            </tr>
          </thead>
          <tbody>
            {rangeSessions.map((session) => {
              const counts = c.countsForSession(session.id);
              return (
                <tr key={session.id}>
                  <td>
                    <div className="cell-strong">{session.title}</div>
                    <div className="cell-sub">{sessionDisplayName(session)}</div>
                  </td>
                  <td>{session.dateLabel}</td>
                  <td className="mono">
                    {counts.present + counts.late} / {counts.total}
                  </td>
                  <td className="mono">{counts.rate}%</td>
                  <td className="mono">
                    {reportable.filter((event) => event.sessionId === session.id).length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card dashboard-enter stagger-3">
        <div className="card__head">
          <div className="card__title">Student-level report</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Sessions attended</th>
              <th>Attendance rate</th>
              <th>Confirmed events</th>
            </tr>
          </thead>
          <tbody>
            {c.filteredStudents.map((student) => {
              const studentRangeSessions = rangeSessions.filter((session) =>
                studentCourses(student).includes(session.course)
              );
              const attended = studentRangeSessions.filter((session) => {
                const status = c.attendanceStatusFor(student.id, session.id);
                return status === 'Present' || status === 'Late';
              }).length;
              return (
                <tr key={student.id}>
                  <td>
                    <div className="cell-strong">{student.name}</div>
                    <div className="cell-sub">{student.id}</div>
                  </td>
                  <td>{studentCourseLabel(student)}</td>
                  <td className="mono">
                    {attended} / {studentRangeSessions.length}
                  </td>
                  <td className="mono">{student.rate === null ? 'Not calculated' : `${student.rate}%`}</td>
                  <td className="mono">
                    {reportable.filter((event) => eventMatchesStudent(event, student)).length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
