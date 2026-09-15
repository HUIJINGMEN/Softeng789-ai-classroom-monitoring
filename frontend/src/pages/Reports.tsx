import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AttendanceCoveragePanel from '../components/AttendanceCoveragePanel';
import AttendanceDistributionSummary from '../components/AttendanceDistributionSummary';
import ClassReportsTab from '../components/ClassReportsTab';
import ClassesListToolbar from '../components/ClassesListToolbar';
import ConfirmedEventSummary from '../components/ConfirmedEventSummary';
import CourseTile from '../components/CourseTile';
import DirectoryState from '../components/DirectoryState';
import {
  IconArrowRight,
  IconGraduationCap,
  IconSearch,
  IconUsers
} from '../components/icons';
import type { ReportLevel } from '../components/ReportLevelTabs';
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
  readonly level: ReportLevel;
}

type ReportClass = ClassApiResponse | ClassSummaryApiResponse;
type ClassSortKey = 'course' | 'teachers' | 'sessions' | 'attendance' | 'events';
type StudentSortKey = 'student' | 'classes' | 'sessions' | 'attendance' | 'events';

const ALL_TERMS = 'All';
const ALL_COURSES = 'All courses';
const PAGE_SIZE = 8;

export default function Reports({ console: c, isAdmin, level }: Props) {
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

  useEffect(() => {
    setSelectedClassId(null);
    setSelectedStudentId(null);
  }, [level]);

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
    () => Array.from(new Set(classes.map((klass) => klass.academicTerm))).sort((left, right) => left.localeCompare(right)),
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
    () => Array.from(new Set(c.students.flatMap(studentCourses))).sort((left, right) => left.localeCompare(right)),
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
  const overviewTitle = isAdmin ? 'Institution overview' : 'My classes overview';
  const attendanceScopeDescription = isAdmin
    ? 'Across all completed sessions in the institution scope.'
    : 'Across completed sessions in classes assigned to you.';
  const recordedAttendanceCount = attendance.present + attendance.late + attendance.absent;
  const attendingAttendanceCount = attendance.present + attendance.late;

  return (
    <div className="page__inner reports-workspace">
      <section className="report-command dashboard-enter stagger-0">
        <div className="report-command__filters">
          <fieldset className="report-command__period">
            <legend>Reporting period</legend>
            <label className="field">
              <span>From</span>
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
              <span>To</span>
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
          {level === 'overview' ? (
            <div className="reports__export-action">
              <button type="button" className="btn btn--primary" disabled={!rangeValid} onClick={() => window.print()}>
                Export overview
              </button>
            </div>
          ) : (
            <div className="report-command__next-step">
              {level === 'classes'
                ? 'Open a class to prepare its report.'
                : 'Open a student to review and share.'}
            </div>
          )}
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
          <section className="card reports-attendance-card dashboard-enter stagger-1">
            <div className="card__head">
              <div>
                <div className="card__title">Attendance snapshot</div>
                <div className="card__sub">{attendanceScopeDescription}</div>
              </div>
              <span className="reports-overview__scope">{completedSessions.length} completed sessions</span>
            </div>
            <div className="card__body">
              <div className="reports-attendance-overview">
                <div className="reports-attendance-overview__distribution">
                  <AttendanceDistributionSummary
                    attendance={attendance}
                    emptyTitle="No attendance recorded in this range."
                    emptyHint="Choose a period containing completed sessions."
                    rateDescription={
                      recordedAttendanceCount > 0
                        ? `${attendingAttendanceCount} of ${recordedAttendanceCount} recorded marks were present or late.`
                        : 'Attendance rate will appear once statuses are recorded.'
                    }
                  />
                </div>
                <AttendanceCoveragePanel attendance={attendance} />
              </div>
            </div>
            <div className="reports__policy-note">
              Reports include only confirmed or corrected AI observations. {pendingAndRejected.pending} pending and {pendingAndRejected.rejected} rejected observations are excluded.
            </div>
          </section>

          <div className="reports-overview-grid">
            <ReportInsightPanel
              insight={insight}
              loading={insightLoading}
              error={insightError}
              disabled={!rangeValid}
              onGenerate={() => void loadInsight()}
              onRetry={() => void loadInsight()}
            />

            <ConfirmedEventSummary
              counts={eventCounts}
              total={confirmedEvents.length}
              subtitle="Reviewed observations included in this reporting period."
              emptyMessage="No confirmed or corrected events in this range."
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
            <span className="report-list-card__count" aria-live="polite">
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

          {(classesLoading || pagedClasses.rows.length > 0) && <div className="report-list-table-wrap" tabIndex={0} role="region" aria-label="Class reports table">
            <table className="table table--compact report-list-table">
              <SortableHeader
              columns={[
                { key: 'course', label: 'Class' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'sessions', label: 'Completed sessions' },
                { key: 'events', label: 'Confirmed events' },
                { key: 'teachers', label: 'Teachers', sortable: false }
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedClassId(klass.id);
                    }
                  }}
                >
                  <td>
                    <div className="person">
                      <CourseTile courseCode={klass.courseCode} />
                      <div><div className="cell-strong">{klass.courseCode}</div><div className="cell-sub">{subjectName(klass.courseCode) || klass.offeringCode}</div></div>
                    </div>
                  </td>
                  <td><MiniAttendanceRing rate={classAttendance.rate} /></td>
                  <td className="mono">{sessions.length}</td>
                  <td className="mono">{confirmedEventCount}</td>
                  <td>{klass.teachers.map((teacher) => teacher.name).join(', ') || 'No teacher assigned'}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); setSelectedClassId(klass.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {classesLoading && classes.length === 0 && (
                <tr><td colSpan={6}><output className="empty empty--inline">Loading class reports…</output></td></tr>
              )}
              </tbody>
            </table>
          </div>}
          {!classesLoading && filteredClassRows.length === 0 && !classesError && (
            <DirectoryState
              icon={classes.length === 0 ? <IconGraduationCap /> : <IconSearch />}
              title={classes.length === 0 ? 'No class reports available' : 'No matching class reports'}
              description={classes.length === 0 ? 'Classes in your reporting scope will appear here.' : 'Try a different course, teacher or reporting term.'}
              action={classes.length > 0 ? (
                <button type="button" className="btn btn--sm" onClick={() => { setClassQuery(''); setTerm(ALL_TERMS); }}>Clear filters</button>
              ) : undefined}
            />
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
            <span className="report-list-card__count" aria-live="polite">
              {filteredStudentRows.length} of {c.students.length} students
            </span>
          </div>

          <div className="list-toolbar list-toolbar--students report-list-toolbar" role="search" aria-label="Filter student reports">
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

          {(c.studentsLoading || pagedStudents.rows.length > 0) && <div className="report-list-table-wrap" tabIndex={0} role="region" aria-label="Student reports table">
            <table className="table table--compact report-list-table">
              <SortableHeader
              columns={[
                { key: 'student', label: 'Student' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'classes', label: 'Classes', sortable: false },
                { key: 'sessions', label: 'Recorded / sessions' },
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openStudent(student.id);
                    }
                  }}
                >
                  <td>
                    <div className="person">
                      <PersonAvatar photoUrl={student.registrationPhoto} name={student.name} tone={tone} alt={`${student.name} registration`} />
                      <div><div className="cell-strong">{student.name}</div><div className="cell-sub">{student.id}</div></div>
                    </div>
                  </td>
                  <td><MiniAttendanceRing rate={metrics.attendance.rate} tier="student" /></td>
                  <td>{studentCourseLabel(student)}</td>
                  <td className="mono">{metrics.recorded} / {metrics.sessionCount}</td>
                  <td className="mono">{metrics.confirmedEventCount}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); openStudent(student.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {c.studentsLoading && c.students.length === 0 && (
                <tr><td colSpan={6}><output className="empty empty--inline">Loading student reports…</output></td></tr>
              )}
              </tbody>
            </table>
          </div>}
          {!c.studentsLoading && filteredStudentRows.length === 0 && !c.studentsError && (
            <DirectoryState
              icon={c.students.length === 0 ? <IconUsers /> : <IconSearch />}
              title={c.students.length === 0 ? 'No student reports available' : 'No matching student reports'}
              description={c.students.length === 0 ? 'Students in your reporting scope will appear here.' : 'Try a different name, student ID or course.'}
              action={c.students.length > 0 ? (
                <button type="button" className="btn btn--sm" onClick={() => { setStudentQuery(''); setStudentCourse(ALL_COURSES); }}>Clear filters</button>
              ) : undefined}
            />
          )}
          {sortedStudentRows.length > 0 && (
            <Pager label={pagedStudents.label} page={pagedStudents.page} pageCount={pagedStudents.pageCount} canPrev={pagedStudents.canPrev} canNext={pagedStudents.canNext} onPrev={pagedStudents.prev} onNext={pagedStudents.next} onGoToPage={pagedStudents.goToPage} />
          )}
        </section>
      )}
    </div>
  );
}
