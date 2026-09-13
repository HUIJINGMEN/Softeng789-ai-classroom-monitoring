import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AttendanceCoveragePanel from '../components/AttendanceCoveragePanel';
import AttendanceDonutChart from '../components/AttendanceDonutChart';
import ClassReportsTab from '../components/ClassReportsTab';
import ClassesListToolbar from '../components/ClassesListToolbar';
import CourseTile from '../components/CourseTile';
import {
  IconArrowRight,
  IconBarChart,
  IconGraduationCap,
  IconUsers
} from '../components/icons';
import MiniAttendanceRing from '../components/MiniAttendanceRing';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import ReportInsightPanel from '../components/ReportInsightPanel';
import ReportSummaryPrint from '../components/ReportSummaryPrint';
import SearchField from '../components/SearchField';
import SelectMenu from '../components/SelectMenu';
import SortableHeader from '../components/SortableHeader';
import StudentReportDetail from '../components/StudentReportDetail';
import { apiMessage } from '../lib/apiClient';
import {
  listActiveClasses,
  listClasses,
  type ClassApiResponse,
  type ClassSummaryApiResponse
} from '../lib/classAdminApi';
import { generateReportInsight } from '../lib/feedbackSummaryApi';
import { avatarTone } from '../lib/format';
import {
  attendanceForSessions,
  completedSessionsInRange,
  confirmedEventsForSessions,
  eventTypeCounts,
  metricsForStudent
} from '../lib/reportMetrics';
import { studentCourseLabel, studentCourses } from '../lib/studentCourses';
import { subjectName } from '../lib/subjectNames';
import { compareNullableValues, usePagination, useSort } from '../lib/table';
import type { Console } from '../hooks/useConsole';
import type { ReportInsight } from '../types';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
}

type ReportLevel = 'overview' | 'classes' | 'students';
type ReportClass = ClassApiResponse | ClassSummaryApiResponse;
type ClassSortKey = 'course' | 'term' | 'teachers' | 'sessions' | 'attendance' | 'events';
type StudentSortKey = 'student' | 'classes' | 'sessions' | 'attendance' | 'events';

const ALL_TERMS = 'All';
const ALL_COURSES = 'All courses';
const PAGE_SIZE = 8;

export default function Reports({ console: c, isAdmin }: Props) {
  const [level, setLevel] = useState<ReportLevel>('overview');
  const [classes, setClasses] = useState<ReportClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classQuery, setClassQuery] = useState('');
  const [term, setTerm] = useState(ALL_TERMS);
  const [classPage, setClassPage] = useState(0);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentCourse, setStudentCourse] = useState(ALL_COURSES);
  const [studentPage, setStudentPage] = useState(0);
  const [insight, setInsight] = useState<ReportInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const insightRequestRef = useRef(0);
  const { sort: classSort, toggle: toggleClassSort } = useSort<ClassSortKey>('course');
  const { sort: studentSort, toggle: toggleStudentSort } = useSort<StudentSortKey>('attendance');
  const rangeValid = c.dateFrom <= c.dateTo;

  const loadClasses = useCallback(() => {
    setClassesLoading(true);
    setClassesError('');
    const request = isAdmin ? listClasses() : listActiveClasses();
    return request
      .then(setClasses)
      .catch((error) => {
        setClasses([]);
        setClassesError(apiMessage(error));
      })
      .finally(() => setClassesLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const loadInsight = useCallback(() => {
    if (!rangeValid) return Promise.resolve();
    const requestId = ++insightRequestRef.current;
    setInsightLoading(true);
    setInsightError('');
    return generateReportInsight({ scope: 'OVERALL', dateFrom: c.dateFrom, dateTo: c.dateTo })
      .then((result) => {
        if (requestId === insightRequestRef.current) setInsight(result);
      })
      .catch((error) => {
        if (requestId !== insightRequestRef.current) return;
        setInsight(null);
        setInsightError(apiMessage(error));
      })
      .finally(() => {
        if (requestId === insightRequestRef.current) setInsightLoading(false);
      });
  }, [c.dateFrom, c.dateTo, rangeValid]);

  useEffect(() => {
    insightRequestRef.current += 1;
    setInsight(null);
    setInsightLoading(false);
    setInsightError('');
  }, [c.dateFrom, c.dateTo]);

  const completedSessions = useMemo(
    () => completedSessionsInRange(c.sessions, c.dateFrom, c.dateTo),
    [c.dateFrom, c.dateTo, c.sessions]
  );
  const attendance = useMemo(
    () => attendanceForSessions(completedSessions, c.countsForSession),
    [c.countsForSession, completedSessions]
  );
  const confirmedEvents = useMemo(
    () => confirmedEventsForSessions(c.events, completedSessions),
    [c.events, completedSessions]
  );
  const eventCounts = useMemo(() => eventTypeCounts(confirmedEvents), [confirmedEvents]);

  const classRows = useMemo(
    () =>
      classes.map((klass) => {
        const sessions = completedSessions.filter((session) => session.courseOfferingId === klass.id);
        const classAttendance = attendanceForSessions(sessions, c.countsForSession);
        const events = confirmedEventsForSessions(c.events, sessions);
        return { klass, sessions, attendance: classAttendance, confirmedEventCount: events.length };
      }),
    [c.countsForSession, c.events, classes, completedSessions]
  );
  const termOptions = useMemo(
    () => Array.from(new Set(classes.map((klass) => klass.academicTerm))).sort(),
    [classes]
  );
  const filteredClassRows = useMemo(() => {
    const query = classQuery.trim().toLowerCase();
    return classRows.filter(({ klass }) => {
      if (term !== ALL_TERMS && klass.academicTerm !== term) return false;
      if (!query) return true;
      return (
        klass.courseCode.toLowerCase().includes(query) ||
        klass.academicTerm.toLowerCase().includes(query) ||
        klass.offeringCode.toLowerCase().includes(query) ||
        klass.teachers.some((teacher) => teacher.name.toLowerCase().includes(query))
      );
    });
  }, [classQuery, classRows, term]);
  const sortedClassRows = useMemo(
    () =>
      [...filteredClassRows].sort((left, right) => {
        const valueFor = (entry: (typeof filteredClassRows)[number]) => {
          if (classSort.key === 'course') return entry.klass.courseCode;
          if (classSort.key === 'term') return entry.klass.academicTerm;
          if (classSort.key === 'teachers') return entry.klass.teachers.map((teacher) => teacher.name).join(', ');
          if (classSort.key === 'sessions') return entry.sessions.length;
          if (classSort.key === 'attendance') return entry.attendance.rate;
          return entry.confirmedEventCount;
        };
        return compareNullableValues(valueFor(left), valueFor(right), classSort.dir);
      }),
    [classSort, filteredClassRows]
  );
  const pagedClasses = usePagination(sortedClassRows, classPage, setClassPage, PAGE_SIZE);

  const studentRows = useMemo(
    () =>
      c.students.map((student, index) => ({
        student,
        tone: avatarTone(student.id, index),
        metrics: metricsForStudent(student, completedSessions, confirmedEvents, c.attendanceStatusFor)
      })),
    [c.attendanceStatusFor, c.students, completedSessions, confirmedEvents]
  );
  const courseOptions = useMemo(
    () => Array.from(new Set(c.students.flatMap(studentCourses))).sort(),
    [c.students]
  );
  const filteredStudentRows = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    return studentRows.filter(({ student }) => {
      if (studentCourse !== ALL_COURSES && !studentCourses(student).includes(studentCourse)) return false;
      return !query || student.name.toLowerCase().includes(query) || student.id.toLowerCase().includes(query);
    });
  }, [studentCourse, studentQuery, studentRows]);
  const sortedStudentRows = useMemo(
    () =>
      [...filteredStudentRows].sort((left, right) => {
        const valueFor = (entry: (typeof filteredStudentRows)[number]) => {
          if (studentSort.key === 'student') return entry.student.name;
          if (studentSort.key === 'classes') return studentCourseLabel(entry.student);
          if (studentSort.key === 'sessions') return entry.metrics.sessionCount;
          if (studentSort.key === 'attendance') return entry.metrics.attendance.rate;
          return entry.metrics.confirmedEventCount;
        };
        return compareNullableValues(valueFor(left), valueFor(right), studentSort.dir);
      }),
    [filteredStudentRows, studentSort]
  );
  const pagedStudents = usePagination(sortedStudentRows, studentPage, setStudentPage, PAGE_SIZE);

  const selectedClass = classes.find((klass) => klass.id === selectedClassId) ?? null;
  const selectedStudent = c.students.find((student) => student.id === selectedStudentId) ?? null;
  const pendingAndRejected = useMemo(() => {
    const sessionIds = new Set(
      c.sessions
        .filter((session) => session.date >= c.dateFrom && session.date <= c.dateTo)
        .map((session) => session.id)
    );
    return c.events.reduce(
      (counts, event) => {
        if (!sessionIds.has(event.sessionId)) return counts;
        if (event.status === 'Pending Review') counts.pending += 1;
        else if (event.status === 'Rejected') counts.rejected += 1;
        return counts;
      },
      { pending: 0, rejected: 0 }
    );
  }, [c.dateFrom, c.dateTo, c.events, c.sessions]);

  const openStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
  };
  const changeLevel = (next: ReportLevel) => {
    setLevel(next);
    setSelectedClassId(null);
    setSelectedStudentId(null);
  };
  const overviewTitle = isAdmin ? 'Institution overview' : 'My classes overview';
  const maxEventCount = Math.max(1, ...Object.values(eventCounts));

  return (
    <div className="page__inner reports-workspace">
      <section className="card report-command dashboard-enter stagger-0">
        <nav className="report-level-tabs" aria-label="Report level">
          <button
            type="button"
            aria-current={level === 'overview' ? 'page' : undefined}
            className={level === 'overview' ? 'report-level-tab report-level-tab--active' : 'report-level-tab'}
            onClick={() => changeLevel('overview')}
          >
            <IconBarChart /><span>Overview<small>{isAdmin ? 'Institution' : 'My classes'}</small></span>
          </button>
          <button
            type="button"
            aria-current={level === 'classes' ? 'page' : undefined}
            className={level === 'classes' ? 'report-level-tab report-level-tab--active' : 'report-level-tab'}
            onClick={() => changeLevel('classes')}
          >
            <IconGraduationCap /><span>Classes<small>{classes.length} available</small></span>
          </button>
          <button
            type="button"
            aria-current={level === 'students' ? 'page' : undefined}
            className={level === 'students' ? 'report-level-tab report-level-tab--active' : 'report-level-tab'}
            onClick={() => changeLevel('students')}
          >
            <IconUsers /><span>Students<small>{c.students.length} available</small></span>
          </button>
        </nav>

        <div className="report-command__filters">
          <fieldset className="report-command__period">
            <legend>Reporting period</legend>
            <label className="field">
              From
              <input
                type="date"
                value={c.dateFrom}
                onChange={(event) => {
                  c.setDateFrom(event.target.value);
                  setClassPage(0);
                  setStudentPage(0);
                }}
              />
            </label>
            <label className="field">
              To
              <input
                type="date"
                value={c.dateTo}
                onChange={(event) => {
                  c.setDateTo(event.target.value);
                  setClassPage(0);
                  setStudentPage(0);
                }}
              />
            </label>
          </fieldset>
          <div className="report-command__scope">
            <span>{isAdmin ? 'Admin scope' : 'Teacher scope'}</span>
            <p>{isAdmin ? 'All classes and students' : 'Only classes assigned to you'}</p>
          </div>
          <div className="reports__export-action">
            {level === 'overview' && (
              <button type="button" className="btn btn--primary" disabled={!rangeValid} onClick={() => window.print()}>
                Export overview
              </button>
            )}
          </div>
        </div>
      </section>

      {!rangeValid && (
        <div className="notice notice--warn" role="alert">
          <span className="notice__mark" aria-hidden="true" />
          <span>The end date must be on or after the start date.</span>
        </div>
      )}

      {level === 'overview' && (
        <>
          <section className="card dashboard-enter stagger-1">
            <div className="card__head">
              <div>
                <div className="card__title">{overviewTitle}</div>
                <div className="card__sub">Attendance from completed sessions in the selected period.</div>
              </div>
              <span className="badge badge--neutral">{completedSessions.length} completed sessions</span>
            </div>
            <div className="card__body">
              <div className="profile-attendance-summary">
                <div className="profile-attendance-summary__chart">
                  <AttendanceDonutChart
                    attendance={attendance}
                    emptyTitle="No attendance recorded in this range."
                    emptyHint="Choose a period containing completed sessions."
                    note={completedSessions.length > 0 ? `Based on ${completedSessions.length} completed session${completedSessions.length === 1 ? '' : 's'}` : undefined}
                  />
                </div>
                <AttendanceCoveragePanel attendance={attendance} />
              </div>
            </div>
          </section>

          <div className="reports__policy-note">
            Reports include only confirmed or corrected AI observations. {pendingAndRejected.pending} pending and {pendingAndRejected.rejected} rejected observations are excluded.
          </div>

          <div className="reports-overview-grid">
            <section className="card dashboard-enter stagger-2">
              <div className="card__body">
                <div className="card__title-line">
                  <div className="card__title">Confirmed event summary</div>
                  <span className="cell-sub">{confirmedEvents.length} total</span>
                </div>
                {Object.entries(eventCounts).map(([type, count]) => (
                  <div key={type} className="reports__event-row">
                    <div className="reports__event-head">
                      <span className="reports__event-type">{type}</span>
                      <span className="mono reports__event-count">{count}</span>
                    </div>
                    <div className="conf-track">
                      <div className="conf-fill reports__bar-fill" style={{ width: `${(count / maxEventCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {confirmedEvents.length === 0 && (
                  <div className="reports__empty">No confirmed or corrected events in this range.</div>
                )}
              </div>
            </section>

            <ReportInsightPanel
              insight={insight}
              loading={insightLoading}
              error={insightError}
              disabled={!rangeValid}
              onGenerate={() => void loadInsight()}
              onRetry={() => void loadInsight()}
            />
          </div>

          <ReportSummaryPrint
            title={overviewTitle}
            scopeLabel={isAdmin ? 'Institution report' : 'Teacher report'}
            dateFrom={c.dateFrom}
            dateTo={c.dateTo}
            attendance={attendance}
            completedSessionCount={completedSessions.length}
            confirmedEventCount={confirmedEvents.length}
            eventCounts={eventCounts}
            insight={insight}
            classRows={classRows.map(({ klass, sessions, attendance: classAttendance, confirmedEventCount }) => ({
              id: klass.id,
              label: klass.courseCode,
              detail: klass.academicTerm,
              completedSessions: sessions.length,
              attendanceRate: classAttendance.rate,
              confirmedEvents: confirmedEventCount
            }))}
          />
        </>
      )}

      {level === 'classes' && selectedClass && (
        <ClassReportsTab
          courseOfferingId={selectedClass.id}
          classLabel={`${selectedClass.courseCode} · ${selectedClass.academicTerm}`}
          console={c}
          showToolbar={false}
          detailHeader={{
            title: selectedClass.courseCode,
            subtitle: `${subjectName(selectedClass.courseCode) || selectedClass.offeringCode} · ${selectedClass.academicTerm}`,
            onBack: () => setSelectedClassId(null)
          }}
        />
      )}

      {level === 'classes' && !selectedClass && (
        <section className="card report-list-card dashboard-enter stagger-1">
          <div className="card__head">
            <div className="card__title-row">
              <span className="icon-inline icon-inline--title" aria-hidden="true"><IconGraduationCap /></span>
              <div>
                <div className="card__title">Class reports</div>
                <div className="card__sub">Open a class to review its attendance, confirmed events and AI feedback summary.</div>
              </div>
            </div>
            <span className="badge badge--neutral" aria-live="polite">
              {filteredClassRows.length} of {classes.length} classes
            </span>
          </div>

          <ClassesListToolbar
            query={classQuery}
            onQueryChange={(value) => { setClassQuery(value); setClassPage(0); }}
            term={term}
            onTermChange={(value) => { setTerm(value); setClassPage(0); }}
            termOptions={termOptions}
          />

          {classesError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" />
              <span>{classesError}</span><span className="spacer" />
              <button type="button" className="btn btn--sm" onClick={() => void loadClasses()}>Retry</button>
            </div>
          )}

          <table className="table table--compact">
            <SortableHeader
              columns={[
                { key: 'course', label: 'Class' },
                { key: 'term', label: 'Term', sortable: false },
                { key: 'teachers', label: 'Teachers', sortable: false },
                { key: 'sessions', label: 'Completed sessions' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'events', label: 'Confirmed events' }
              ]}
              sort={classSort}
              onSort={(key) => { toggleClassSort(key); setClassPage(0); }}
            />
            <tbody>
              {pagedClasses.rows.map(({ klass, sessions, attendance: classAttendance, confirmedEventCount }) => (
                <tr
                  key={klass.id}
                  className="table__row--clickable"
                  tabIndex={0}
                  onClick={() => setSelectedClassId(klass.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter') setSelectedClassId(klass.id); }}
                >
                  <td>
                    <div className="person">
                      <CourseTile courseCode={klass.courseCode} />
                      <div><div className="cell-strong">{klass.courseCode}</div><div className="cell-sub">{subjectName(klass.courseCode) || klass.offeringCode}</div></div>
                    </div>
                  </td>
                  <td>{klass.academicTerm}</td>
                  <td>{klass.teachers.map((teacher) => teacher.name).join(', ') || 'No teacher assigned'}</td>
                  <td className="mono">{sessions.length}</td>
                  <td><MiniAttendanceRing rate={classAttendance.rate} /></td>
                  <td className="mono">{confirmedEventCount}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); setSelectedClassId(klass.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {classesLoading && classes.length === 0 && (
                <tr><td colSpan={7}><div className="empty empty--inline" role="status">Loading class reports…</div></td></tr>
              )}
            </tbody>
          </table>
          {!classesLoading && filteredClassRows.length === 0 && !classesError && (
            <div className="empty">{classes.length === 0 ? 'No classes are available in this report scope.' : 'No classes match the current filters.'}</div>
          )}
          {sortedClassRows.length > 0 && (
            <Pager label={pagedClasses.label} page={pagedClasses.page} pageCount={pagedClasses.pageCount} canPrev={pagedClasses.canPrev} canNext={pagedClasses.canNext} onPrev={pagedClasses.prev} onNext={pagedClasses.next} onGoToPage={pagedClasses.goToPage} />
          )}
        </section>
      )}

      {level === 'students' && selectedStudent && (
        <StudentReportDetail student={selectedStudent} console={c} onBack={() => setSelectedStudentId(null)} />
      )}

      {level === 'students' && !selectedStudent && (
        <section className="card report-list-card dashboard-enter stagger-1">
          <div className="card__head">
            <div className="card__title-row">
              <span className="icon-inline icon-inline--title" aria-hidden="true"><IconUsers /></span>
              <div>
                <div className="card__title">Student reports</div>
                <div className="card__sub">Open a student to review the AI-written summary before export, email or portal delivery.</div>
              </div>
            </div>
            <span className="badge badge--neutral" aria-live="polite">
              {filteredStudentRows.length} of {c.students.length} students
            </span>
          </div>

          <div className="list-toolbar list-toolbar--students" role="search" aria-label="Filter student reports">
            <SearchField value={studentQuery} placeholder="Student name or ID" onChange={(value) => { setStudentQuery(value); setStudentPage(0); }} />
            <div className="field">
              <span>Course</span>
              <SelectMenu
                value={studentCourse}
                options={[{ value: ALL_COURSES, label: ALL_COURSES }, ...courseOptions.map((course) => ({ value: course, label: course }))]}
                ariaLabel="Filter student reports by course"
                onChange={(value) => { setStudentCourse(value); setStudentPage(0); }}
              />
            </div>
          </div>

          {c.studentsError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" /><span>{c.studentsError}</span><span className="spacer" />
              <button type="button" className="btn btn--sm" onClick={() => void c.refreshStudents()}>Retry</button>
            </div>
          )}

          <table className="table table--compact">
            <SortableHeader
              columns={[
                { key: 'student', label: 'Student' },
                { key: 'classes', label: 'Classes', sortable: false },
                { key: 'sessions', label: 'Recorded / sessions' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'events', label: 'Confirmed events' }
              ]}
              sort={studentSort}
              onSort={(key) => { toggleStudentSort(key); setStudentPage(0); }}
            />
            <tbody>
              {pagedStudents.rows.map(({ student, tone, metrics }) => (
                <tr
                  key={student.id}
                  className="table__row--clickable"
                  tabIndex={0}
                  onClick={() => openStudent(student.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter') openStudent(student.id); }}
                >
                  <td>
                    <div className="person">
                      <PersonAvatar photoUrl={student.registrationPhoto} name={student.name} tone={tone} alt={`${student.name} registration`} />
                      <div><div className="cell-strong">{student.name}</div><div className="cell-sub">{student.id}</div></div>
                    </div>
                  </td>
                  <td>{studentCourseLabel(student)}</td>
                  <td className="mono">{metrics.recorded} / {metrics.sessionCount}</td>
                  <td><MiniAttendanceRing rate={metrics.attendance.rate} tier="student" /></td>
                  <td className="mono">{metrics.confirmedEventCount}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); openStudent(student.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {c.studentsLoading && c.students.length === 0 && (
                <tr><td colSpan={6}><div className="empty empty--inline" role="status">Loading student reports…</div></td></tr>
              )}
            </tbody>
          </table>
          {!c.studentsLoading && filteredStudentRows.length === 0 && !c.studentsError && (
            <div className="empty">{c.students.length === 0 ? 'No students are available in this report scope.' : 'No students match the current filters.'}</div>
          )}
          {sortedStudentRows.length > 0 && (
            <Pager label={pagedStudents.label} page={pagedStudents.page} pageCount={pagedStudents.pageCount} canPrev={pagedStudents.canPrev} canNext={pagedStudents.canNext} onPrev={pagedStudents.prev} onNext={pagedStudents.next} onGoToPage={pagedStudents.goToPage} />
          )}
        </section>
      )}
    </div>
  );
}
