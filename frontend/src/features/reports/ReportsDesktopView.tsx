import AttendanceCoveragePanel from '../../components/AttendanceCoveragePanel';
import AttendanceDistributionSummary from '../../components/AttendanceDistributionSummary';
import ClassReportsTab from '../../components/ClassReportsTab';
import ClassesListToolbar from '../../components/ClassesListToolbar';
import ConfirmedEventSummary from '../../components/ConfirmedEventSummary';
import CourseTile from '../../components/CourseTile';
import DirectoryState from '../../components/DirectoryState';
import {
  IconArrowRight,
  IconGraduationCap,
  IconSearch,
  IconUsers
} from '../../components/icons';
import type { ReportLevel } from '../../components/ReportLevelTabs';
import MiniAttendanceRing from '../../components/MiniAttendanceRing';
import Pager from '../../components/Pager';
import PersonAvatar from '../../components/PersonAvatar';
import ReportInsightPanel from '../../components/ReportInsightPanel';
import ReportSummaryPrint from '../../components/ReportSummaryPrint';
import SearchField from '../../components/SearchField';
import SelectMenu from '../../components/SelectMenu';
import SortableHeader from '../../components/SortableHeader';
import StudentReportDetail from '../../components/StudentReportDetail';
import type { Console } from '../../hooks/useConsole';
import { studentCourseLabel } from '../../lib/studentCourses';
import { subjectName } from '../../lib/subjectNames';
import type { ReportsWorkspace } from './useReportsWorkspace';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
  readonly level: ReportLevel;
  readonly workspace: ReportsWorkspace;
}

interface ReportCommandProps {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly isAdmin: boolean;
  readonly level: ReportLevel;
  readonly rangeValid: boolean;
  readonly onDateFromChange: (value: string) => void;
  readonly onDateToChange: (value: string) => void;
}

function ReportCommand({
  dateFrom,
  dateTo,
  isAdmin,
  level,
  rangeValid,
  onDateFromChange,
  onDateToChange
}: ReportCommandProps) {
  let nextStep = 'Open a student to review and share.';
  if (level === 'classes') nextStep = 'Open a class to prepare its report.';

  return (
    <section className="report-command dashboard-enter stagger-0">
      <div className="report-command__filters">
        <fieldset className="report-command__period">
          <legend>Reporting period</legend>
          <label className="field">
            <span>From</span>
            <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
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
          <div className="report-command__next-step">{nextStep}</div>
        )}
      </div>
    </section>
  );
}

export default function ReportsDesktopView({ console: c, isAdmin, level, workspace }: Props) {
  const {
    allCoursesLabel,
    attendance,
    attendanceScopeDescription,
    attendingAttendanceCount,
    classes,
    classesError,
    classesLoading,
    classQuery,
    classRows,
    classSort,
    clearClassFilters,
    clearStudentFilters,
    closeClass,
    closeStudent,
    completedSessions,
    confirmedEvents,
    courseOptions,
    eventCounts,
    filteredClassRows,
    filteredStudentRows,
    insight,
    insightError,
    insightLoading,
    loadClasses,
    loadInsight,
    openClass,
    openStudent,
    overviewTitle,
    pagedClasses,
    pagedStudents,
    pendingAndRejected,
    rangeValid,
    recordedAttendanceCount,
    selectedClass,
    selectedStudent,
    setClassQuery,
    setStudentCourse,
    setStudentQuery,
    setTerm,
    sortedClassRows,
    sortedStudentRows,
    studentCourse,
    studentQuery,
    studentSort,
    term,
    termOptions,
    toggleClassSort,
    toggleStudentSort,
    updateDateFrom,
    updateDateTo
  } = workspace;

  return (
    <div className="page__inner reports-workspace">
      <ReportCommand
        dateFrom={c.dateFrom}
        dateTo={c.dateTo}
        isAdmin={isAdmin}
        level={level}
        rangeValid={rangeValid}
        onDateFromChange={updateDateFrom}
        onDateToChange={updateDateTo}
      />

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
            onBack: closeClass
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
            onQueryChange={setClassQuery}
            term={term}
            onTermChange={setTerm}
            termOptions={termOptions}
          />

          {classesError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" />
              <span>{classesError}</span><span className="spacer" />
              <button type="button" className="btn btn--sm" onClick={() => void loadClasses()}>Retry</button>
            </div>
          )}

          {(classesLoading || pagedClasses.rows.length > 0) && <section className="report-list-table-wrap" aria-label="Class reports table">
            <table className="table table--compact report-list-table report-list-table--classes">
              <SortableHeader
              columns={[
                { key: 'course', label: 'Class' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'sessions', label: 'Completed sessions' },
                { key: 'events', label: 'Confirmed events' },
                { key: 'teachers', label: 'Teachers', sortable: false }
              ]}
              sort={classSort}
              onSort={toggleClassSort}
              />
              <tbody>
              {pagedClasses.rows.map(({ klass, sessions, attendance: classAttendance, confirmedEventCount }) => (
                <tr
                  key={klass.id}
                  className="table__row--clickable"
                  tabIndex={0}
                  onClick={() => openClass(klass.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openClass(klass.id);
                    }
                  }}
                >
                  <td data-label="Class">
                    <div className="person">
                      <CourseTile courseCode={klass.courseCode} />
                      <div><div className="cell-strong">{klass.courseCode}</div><div className="cell-sub">{subjectName(klass.courseCode) || klass.offeringCode}</div></div>
                    </div>
                  </td>
                  <td data-label="Attendance"><MiniAttendanceRing rate={classAttendance.rate} /></td>
                  <td className="mono" data-label="Sessions">{sessions.length}</td>
                  <td className="mono" data-label="Events">{confirmedEventCount}</td>
                  <td data-label="Teachers">{klass.teachers.map((teacher) => teacher.name).join(', ') || 'No teacher assigned'}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); openClass(klass.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {classesLoading && classes.length === 0 && (
                <tr><td colSpan={6}><output className="empty empty--inline">Loading class reports…</output></td></tr>
              )}
              </tbody>
            </table>
          </section>}
          {!classesLoading && filteredClassRows.length === 0 && !classesError && (
            <DirectoryState
              icon={classes.length === 0 ? <IconGraduationCap /> : <IconSearch />}
              title={classes.length === 0 ? 'No class reports available' : 'No matching class reports'}
              description={classes.length === 0 ? 'Classes in your reporting scope will appear here.' : 'Try a different course, teacher or reporting term.'}
              action={classes.length > 0 ? (
                <button type="button" className="btn btn--sm" onClick={clearClassFilters}>Clear filters</button>
              ) : undefined}
            />
          )}
          {sortedClassRows.length > 0 && (
            <Pager label={pagedClasses.label} page={pagedClasses.page} pageCount={pagedClasses.pageCount} canPrev={pagedClasses.canPrev} canNext={pagedClasses.canNext} onPrev={pagedClasses.prev} onNext={pagedClasses.next} onGoToPage={pagedClasses.goToPage} />
          )}
        </section>
      )}

      {level === 'students' && selectedStudent && (
        <StudentReportDetail
          student={selectedStudent}
          console={c}
          onBack={closeStudent}
        />
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
            <SearchField value={studentQuery} placeholder="Student name or ID" onChange={setStudentQuery} />
            <div className="field">
              <span>Course</span>
              <SelectMenu
                value={studentCourse}
                options={[{ value: allCoursesLabel, label: allCoursesLabel }, ...courseOptions.map((course) => ({ value: course, label: course }))]}
                ariaLabel="Filter student reports by course"
                onChange={setStudentCourse}
              />
            </div>
          </div>

          {c.studentsError && (
            <div className="notice notice--warn">
              <span className="notice__mark" aria-hidden="true" /><span>{c.studentsError}</span><span className="spacer" />
              <button type="button" className="btn btn--sm" onClick={() => void c.refreshStudents()}>Retry</button>
            </div>
          )}

          {(c.studentsLoading || pagedStudents.rows.length > 0) && <section className="report-list-table-wrap" aria-label="Student reports table">
            <table className="table table--compact report-list-table report-list-table--students">
              <SortableHeader
              columns={[
                { key: 'student', label: 'Student' },
                { key: 'attendance', label: 'Attendance', priority: true },
                { key: 'classes', label: 'Classes', sortable: false },
                { key: 'sessions', label: 'Recorded / sessions' },
                { key: 'events', label: 'Confirmed events' }
              ]}
              sort={studentSort}
              onSort={toggleStudentSort}
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
                  <td data-label="Student">
                    <div className="person">
                      <PersonAvatar photoUrl={student.registrationPhoto} name={student.name} tone={tone} alt={`${student.name} registration`} />
                      <div><div className="cell-strong">{student.name}</div><div className="cell-sub">{student.id}</div></div>
                    </div>
                  </td>
                  <td data-label="Attendance"><MiniAttendanceRing rate={metrics.attendance.rate} tier="student" /></td>
                  <td data-label="Classes">{studentCourseLabel(student)}</td>
                  <td className="mono" data-label="Records">{metrics.recorded} / {metrics.sessionCount}</td>
                  <td className="mono" data-label="Events">{metrics.confirmedEventCount}</td>
                  <td className="table__action-cell"><button type="button" className="btn btn--sm btn--with-icon" onClick={(event) => { event.stopPropagation(); openStudent(student.id); }}>Open report <IconArrowRight /></button></td>
                </tr>
              ))}
              {c.studentsLoading && c.students.length === 0 && (
                <tr><td colSpan={6}><output className="empty empty--inline">Loading student reports…</output></td></tr>
              )}
              </tbody>
            </table>
          </section>}
          {!c.studentsLoading && filteredStudentRows.length === 0 && !c.studentsError && (
            <DirectoryState
              icon={c.students.length === 0 ? <IconUsers /> : <IconSearch />}
              title={c.students.length === 0 ? 'No student reports available' : 'No matching student reports'}
              description={c.students.length === 0 ? 'Students in your reporting scope will appear here.' : 'Try a different name, student ID or course.'}
              action={c.students.length > 0 ? (
                <button type="button" className="btn btn--sm" onClick={clearStudentFilters}>Clear filters</button>
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
