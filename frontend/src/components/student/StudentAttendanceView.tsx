import { useMemo, useState } from 'react';
import { sessionRoomLabel } from '../../lib/classroomApi';
import { statusClass } from '../../lib/format';
import { formatSessionDateLabel, formatSessionTimeRange, formatTimestampClock } from '../../lib/sessionTime';
import type { StudentAttendanceBenchmark } from '../../lib/studentPortalApi';
import { usePagination } from '../../lib/table';
import type { StudentAttendanceHistoryEntry } from '../../types';
import Pager from '../Pager';
import ParticipationComparisonCard from './ParticipationComparisonCard';
import StudentCourseFilter from './StudentCourseFilter';
import { attendanceCounts, attendanceStatusLabel } from './studentPortalMetrics';

interface Props {
  readonly history: StudentAttendanceHistoryEntry[];
  readonly benchmark: StudentAttendanceBenchmark | null;
  readonly courses: string[];
  readonly courseFilter: string;
  readonly loading: boolean;
  readonly onCourseChange: (course: string) => void;
}

export default function StudentAttendanceView({
  history,
  benchmark,
  courses,
  courseFilter,
  loading,
  onCourseChange
}: Props) {
  const [page, setPage] = useState(0);
  const rows = useMemo(
    () => history
      .filter((row) => courseFilter === 'all' || row.course === courseFilter)
      .sort((left, right) => {
        const dateOrder = right.sessionDate.localeCompare(left.sessionDate);
        return dateOrder || right.startTime.localeCompare(left.startTime);
      }),
    [courseFilter, history]
  );
  const counts = useMemo(() => attendanceCounts(rows), [rows]);
  const visibleBenchmark = useMemo(() => {
    if (!benchmark) return null;
    if (courseFilter === 'all') {
      return {
        averageRate: benchmark.overallAverageRate,
        totalMarks: benchmark.totalMarks,
        studentCount: benchmark.studentCount
      };
    }
    return benchmark.courses.find((course) => course.course === courseFilter) ?? null;
  }, [benchmark, courseFilter]);
  const paged = usePagination(rows, page, setPage, 6);

  const changeCourse = (course: string) => {
    setPage(0);
    onCourseChange(course);
  };

  return (
    <div className="student-view student-view--attendance">
      <div className="student-page-head">
        <div>
          <h1>Attendance</h1>
          <p>Your attendance record across classroom sessions.</p>
        </div>
        <StudentCourseFilter courses={courses} value={courseFilter} onChange={changeCourse} />
      </div>

      <section className="student-attendance-summary" aria-label="Attendance totals">
        <div>
          <span>Attendance rate</span>
          <strong>{counts.recorded > 0 ? `${counts.rate}%` : '—'}</strong>
          <small>{counts.recorded} recorded · {counts.Unknown} awaiting</small>
        </div>
        <div><span>Present</span><strong className="student-number--ok">{counts.Present}</strong></div>
        <div><span>Late</span><strong className="student-number--warn">{counts.Late}</strong></div>
        <div><span>Absent</span><strong className="student-number--danger">{counts.Absent}</strong></div>
      </section>

      <ParticipationComparisonCard
        studentRate={counts.rate}
        studentMarks={counts.recorded}
        averageRate={visibleBenchmark?.averageRate}
        benchmarkMarks={visibleBenchmark?.totalMarks ?? 0}
        benchmarkStudents={visibleBenchmark?.studentCount ?? 0}
        scopeLabel={courseFilter === 'all' ? 'Across your enrolled classes' : courseFilter}
      />

      <section className="student-panel student-records-panel">
        <div className="student-collection-head">
          <div>
            <h2>Session history</h2>
            <p>Most recent sessions appear first.</p>
          </div>
          <span>{rows.length} session{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="student-records-head" aria-hidden="true">
          <span>Class</span><span>Date &amp; time</span><span>Status</span><span>Check-in</span>
        </div>
        <div className="student-records-list">
          {paged.rows.map((row) => (
            <article className="student-record-row" key={row.sessionId}>
              <div className="student-record-row__class">
                <strong>{row.course}</strong>
                <span>{sessionRoomLabel(row)}</span>
              </div>
              <div className="student-record-row__date">
                <strong>{formatSessionDateLabel(row.sessionDate)}</strong>
                <span>{formatSessionTimeRange(row.startTime, row.endTime, row.sessionDate)}</span>
              </div>
              <div className="student-record-row__status">
                <span className={statusClass(row.status)}>{attendanceStatusLabel(row.status)}</span>
              </div>
              <div className="student-record-row__check-in">
                <strong>{formatTimestampClock(row.checkInTime)}</strong>
                <span>{row.checkOutTime ? `Out ${formatTimestampClock(row.checkOutTime)}` : 'No check-out'}</span>
              </div>
            </article>
          ))}
          {!loading && rows.length === 0 && (
            <div className="student-empty-state">
              <strong>No attendance recorded</strong>
              <span>Sessions will appear here after your teacher records attendance.</span>
            </div>
          )}
          {loading && <div className="student-loading-block" aria-label="Loading attendance" />}
        </div>
        {!loading && rows.length > 0 && (
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
    </div>
  );
}
