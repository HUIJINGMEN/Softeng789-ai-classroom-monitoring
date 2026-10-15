import type { ReportLevel } from '../components/ReportLevelTabs';
import ReportsDesktopView from '../features/reports/ReportsDesktopView';
import ReportsMobileView from '../features/reports/ReportsMobileView';
import { useReportsWorkspace } from '../features/reports/useReportsWorkspace';
import useMediaQuery from '../hooks/useMediaQuery';
import { OverallReportWorkspace } from '../features/overall-reports';
import { StudentReportWorkspace } from '../features/student-reports';
import type { Console } from '../hooks/useConsole';

interface Props {
  readonly console: Console;
  readonly isAdmin: boolean;
  readonly level: ReportLevel;
  readonly onLevelChange: (level: ReportLevel) => void;
}

/** Route-level coordinator. Data ownership lives in useReportsWorkspace and each breakpoint has a
 * focused presentation component, while both continue to consume the exact same derived model. */
export default function Reports({ console, isAdmin, level, onLevelChange }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const workspace = useReportsWorkspace({ console, isAdmin, level });
  const courses = workspace.classes.map(course => ({ id: course.id, label: `${course.courseCode} · ${course.academicTerm}` }));

  if (level === 'students' && !workspace.selectedStudent) return <StudentReportWorkspace
    students={console.students} courses={courses} dateFrom={console.dateFrom} dateTo={console.dateTo}
    loading={console.studentsLoading || workspace.classesLoading} error={console.studentsError || workspace.classesError}
    onDateFrom={workspace.updateDateFrom} onDateTo={workspace.updateDateTo}
    onRetry={() => { void console.refreshStudents(); void workspace.loadClasses(); }}
    onOpenRecords={id => { const student = console.students.find(item => item.recordId === id); if (student) workspace.openStudent(student.id); }}
    showToast={console.showToast}
  />;

  if (isAdmin && level === 'overview') return <OverallReportWorkspace
    dateFrom={console.dateFrom} dateTo={console.dateTo}
    courses={courses}
    coursesLoading={workspace.classesLoading} coursesError={workspace.classesError}
    onRetryCourses={() => void workspace.loadClasses()}
    onOpenCourse={id => { onLevelChange('classes'); workspace.openClass(id); }}
  />;

  if (isMobile) {
    return (
      <ReportsMobileView
        console={console}
        isAdmin={isAdmin}
        level={level}
        onLevelChange={onLevelChange}
        workspace={workspace}
      />
    );
  }

  return (
    <ReportsDesktopView
      console={console}
      isAdmin={isAdmin}
      level={level}
      workspace={workspace}
    />
  );
}
