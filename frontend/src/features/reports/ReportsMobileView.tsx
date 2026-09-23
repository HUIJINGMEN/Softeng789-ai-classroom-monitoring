import ClassReportsTab from '../../components/ClassReportsTab';
import ClassesListToolbar from '../../components/ClassesListToolbar';
import DirectoryState from '../../components/DirectoryState';
import { IconGraduationCap, IconSearch, IconUsers } from '../../components/icons';
import type { ReportLevel } from '../../components/ReportLevelTabs';
import Pager from '../../components/Pager';
import ReportSummaryPrint from '../../components/ReportSummaryPrint';
import SearchField from '../../components/SearchField';
import SelectMenu from '../../components/SelectMenu';
import StudentReportDetail from '../../components/StudentReportDetail';
import {
  MobileClassReportItem,
  MobileReportDirectory,
  MobileReportHeader,
  MobileReportOverview,
  MobileStudentReportItem
} from '../../components/mobile/MobileReportsWorkspace';
import type { Console } from '../../hooks/useConsole';
import { studentCourseLabel } from '../../lib/studentCourses';
import { subjectName } from '../../lib/subjectNames';
import type { ReportsWorkspace } from './useReportsWorkspace';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
  readonly level: ReportLevel;
  readonly onLevelChange: (level: ReportLevel) => void;
  readonly workspace: ReportsWorkspace;
}

export default function ReportsMobileView({
  console: c,
  isAdmin,
  level,
  onLevelChange,
  workspace
}: Props) {
  const {
    allCoursesLabel,
    attendance,
    classes,
    classesError,
    classesLoading,
    classQuery,
    classRows,
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
    term,
    termOptions,
    updateDateFrom,
    updateDateTo
  } = workspace;

  return (
      <div className="page__inner reports-workspace mobile-reports-workspace">
        {!selectedClass && !selectedStudent && (
          <MobileReportHeader
            level={level}
            classCount={classes.length}
            studentCount={c.students.length}
            dateFrom={c.dateFrom}
            dateTo={c.dateTo}
            scopeLabel={isAdmin ? 'Institution-wide' : 'My classes'}
            onLevelChange={onLevelChange}
            onDateFromChange={updateDateFrom}
            onDateToChange={updateDateTo}
          />
        )}

        {!rangeValid && (
          <div className="notice notice--warn" role="alert">
            <span className="notice__mark" aria-hidden="true" />
            <span>The end date must be on or after the start date.</span>
          </div>
        )}

        {level === 'overview' && (
          <>
            <MobileReportOverview
              attendance={attendance}
              completedSessionCount={completedSessions.length}
              confirmedEventCount={confirmedEvents.length}
              eventCounts={eventCounts}
              pendingCount={pendingAndRejected.pending}
              rejectedCount={pendingAndRejected.rejected}
              insight={insight}
              insightLoading={insightLoading}
              insightError={insightError}
              rangeValid={rangeValid}
              onGenerateInsight={() => void loadInsight()}
              onRetryInsight={() => void loadInsight()}
              onExport={() => window.print()}
            />
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
          <MobileReportDirectory
            title="Class reports"
            description="Choose a class to review and prepare its report."
            countLabel={`${filteredClassRows.length} class${filteredClassRows.length === 1 ? '' : 'es'}`}
            filters={(
              <ClassesListToolbar
                query={classQuery}
                onQueryChange={setClassQuery}
                term={term}
                onTermChange={setTerm}
                termOptions={termOptions}
                showShortcut={false}
              />
            )}
            footer={sortedClassRows.length > 0 ? (
              <Pager label={pagedClasses.label} page={pagedClasses.page} pageCount={pagedClasses.pageCount} canPrev={pagedClasses.canPrev} canNext={pagedClasses.canNext} onPrev={pagedClasses.prev} onNext={pagedClasses.next} onGoToPage={pagedClasses.goToPage} />
            ) : undefined}
          >
            {classesError && (
              <div className="mobile-report-inline-error">
                <span>{classesError}</span>
                <button type="button" className="btn btn--sm" onClick={() => void loadClasses()}>Retry</button>
              </div>
            )}
            {classesLoading && classes.length === 0 && <output className="mobile-report-loading">Loading class reports…</output>}
            {!classesLoading && filteredClassRows.length === 0 && !classesError && (
              <DirectoryState
                icon={classes.length === 0 ? <IconGraduationCap /> : <IconSearch />}
                title={classes.length === 0 ? 'No class reports available' : 'No matching class reports'}
                description={classes.length === 0 ? 'Classes in your reporting scope will appear here.' : 'Try another course, teacher or term.'}
                action={classes.length > 0 ? (
                  <button type="button" className="btn btn--sm" onClick={clearClassFilters}>Clear filters</button>
                ) : undefined}
              />
            )}
            {pagedClasses.rows.map(({ klass, sessions, attendance: classAttendance, confirmedEventCount }) => (
              <MobileClassReportItem
                key={klass.id}
                courseCode={klass.courseCode}
                subject={subjectName(klass.courseCode) || klass.offeringCode}
                academicTerm={klass.academicTerm}
                attendanceRate={classAttendance.rate}
                sessionCount={sessions.length}
                eventCount={confirmedEventCount}
                teacherNames={klass.teachers.map((teacher) => teacher.name).join(', ')}
                onOpen={() => openClass(klass.id)}
              />
            ))}
          </MobileReportDirectory>
        )}

        {level === 'students' && selectedStudent && (
          <StudentReportDetail
            student={selectedStudent}
            console={c}
            onBack={closeStudent}
          />
        )}

        {level === 'students' && !selectedStudent && (
          <MobileReportDirectory
            title="Student reports"
            description="Choose a student to review, export or share their report."
            countLabel={`${filteredStudentRows.length} student${filteredStudentRows.length === 1 ? '' : 's'}`}
            filters={(
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
            )}
            footer={sortedStudentRows.length > 0 ? (
              <Pager label={pagedStudents.label} page={pagedStudents.page} pageCount={pagedStudents.pageCount} canPrev={pagedStudents.canPrev} canNext={pagedStudents.canNext} onPrev={pagedStudents.prev} onNext={pagedStudents.next} onGoToPage={pagedStudents.goToPage} />
            ) : undefined}
          >
            {c.studentsError && (
              <div className="mobile-report-inline-error">
                <span>{c.studentsError}</span>
                <button type="button" className="btn btn--sm" onClick={() => void c.refreshStudents()}>Retry</button>
              </div>
            )}
            {c.studentsLoading && c.students.length === 0 && <output className="mobile-report-loading">Loading student reports…</output>}
            {!c.studentsLoading && filteredStudentRows.length === 0 && !c.studentsError && (
              <DirectoryState
                icon={c.students.length === 0 ? <IconUsers /> : <IconSearch />}
                title={c.students.length === 0 ? 'No student reports available' : 'No matching student reports'}
                description={c.students.length === 0 ? 'Students in your reporting scope will appear here.' : 'Try another name, student ID or course.'}
                action={c.students.length > 0 ? (
                  <button type="button" className="btn btn--sm" onClick={clearStudentFilters}>Clear filters</button>
                ) : undefined}
              />
            )}
            {pagedStudents.rows.map(({ student, tone, metrics }) => (
              <MobileStudentReportItem
                key={student.id}
                name={student.name}
                studentId={student.id}
                photoUrl={student.registrationPhoto}
                tone={tone}
                courseLabel={studentCourseLabel(student)}
                attendanceRate={metrics.attendance.rate}
                recordedCount={metrics.recorded}
                sessionCount={metrics.sessionCount}
                eventCount={metrics.confirmedEventCount}
                onOpen={() => openStudent(student.id)}
              />
            ))}
          </MobileReportDirectory>
        )}
      </div>

  );
}
