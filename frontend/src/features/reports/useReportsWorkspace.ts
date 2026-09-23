import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReportLevel } from '../../components/ReportLevelTabs';
import type { Console } from '../../hooks/useConsole';
import { apiMessage } from '../../lib/apiClient';
import {
  listActiveClasses,
  listClasses,
  type ClassApiResponse,
  type ClassSummaryApiResponse
} from '../../lib/classAdminApi';
import { generateReportInsight } from '../../lib/feedbackSummaryApi';
import { avatarTone } from '../../lib/format';
import {
  attendanceForSessions,
  completedSessionsInRange,
  confirmedEventsForSessions,
  eventTypeCounts,
  metricsForStudent
} from '../../lib/reportMetrics';
import { studentCourseLabel, studentCourses } from '../../lib/studentCourses';
import { compareNullableValues, usePagination, useSort } from '../../lib/table';
import type { ReportInsight } from '../../types';

export type ReportClass = ClassApiResponse | ClassSummaryApiResponse;
export type ClassSortKey = 'course' | 'teachers' | 'sessions' | 'attendance' | 'events';
export type StudentSortKey = 'student' | 'classes' | 'sessions' | 'attendance' | 'events';

export type ReportsConsoleData = Pick<
  Console,
  | 'attendanceStatusFor'
  | 'countsForSession'
  | 'dateFrom'
  | 'dateTo'
  | 'events'
  | 'refreshStudents'
  | 'sessions'
  | 'setDateFrom'
  | 'setDateTo'
  | 'students'
  | 'studentsError'
  | 'studentsLoading'
>;

interface UseReportsWorkspaceOptions {
  console: ReportsConsoleData;
  isAdmin: boolean;
  level: ReportLevel;
}

const ALL_TERMS = 'All';
const ALL_COURSES = 'All courses';
const PAGE_SIZE = 8;

/**
 * Owns the report workspace state and all range-dependent calculations. Mobile and desktop views
 * consume this same model so filtering, totals and role scope cannot drift between breakpoints.
 */
export function useReportsWorkspace({ console: c, isAdmin, level }: UseReportsWorkspaceOptions) {
  const [classes, setClasses] = useState<ReportClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classQuery, setClassQueryState] = useState('');
  const [term, setTermState] = useState(ALL_TERMS);
  const [classPage, setClassPage] = useState(0);
  const [studentQuery, setStudentQueryState] = useState('');
  const [studentCourse, setStudentCourseState] = useState(ALL_COURSES);
  const [studentPage, setStudentPage] = useState(0);
  const [insight, setInsight] = useState<ReportInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const classesRequestRef = useRef(0);
  const insightRequestRef = useRef(0);
  const { sort: classSort, toggle: toggleClassSort } = useSort<ClassSortKey>('course');
  const { sort: studentSort, toggle: toggleStudentSort } = useSort<StudentSortKey>('attendance');
  const rangeValid = c.dateFrom <= c.dateTo;

  const loadClasses = useCallback(async () => {
    const requestId = ++classesRequestRef.current;
    setClassesLoading(true);
    setClassesError('');
    try {
      const nextClasses = await (isAdmin ? listClasses() : listActiveClasses());
      if (requestId === classesRequestRef.current) setClasses(nextClasses);
    } catch (error) {
      if (requestId !== classesRequestRef.current) return;
      setClasses([]);
      setClassesError(apiMessage(error));
    } finally {
      if (requestId === classesRequestRef.current) setClassesLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadClasses();
    return () => {
      classesRequestRef.current += 1;
    };
  }, [loadClasses]);

  useEffect(() => {
    setSelectedClassId(null);
    setSelectedStudentId(null);
  }, [level]);

  const loadInsight = useCallback(async () => {
    if (!rangeValid) return;
    const requestId = ++insightRequestRef.current;
    setInsightLoading(true);
    setInsightError('');
    try {
      const result = await generateReportInsight({
        scope: 'OVERALL',
        dateFrom: c.dateFrom,
        dateTo: c.dateTo
      });
      if (requestId === insightRequestRef.current) setInsight(result);
    } catch (error) {
      if (requestId !== insightRequestRef.current) return;
      setInsight(null);
      setInsightError(apiMessage(error));
    } finally {
      if (requestId === insightRequestRef.current) setInsightLoading(false);
    }
  }, [c.dateFrom, c.dateTo, rangeValid]);

  useEffect(() => {
    insightRequestRef.current += 1;
    setInsight(null);
    setInsightLoading(false);
    setInsightError('');
    return () => {
      insightRequestRef.current += 1;
    };
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
        const sessions = completedSessions.filter(
          (session) => session.courseOfferingId === klass.id
        );
        return {
          klass,
          sessions,
          attendance: attendanceForSessions(sessions, c.countsForSession),
          confirmedEventCount: confirmedEventsForSessions(c.events, sessions).length
        };
      }),
    [c.countsForSession, c.events, classes, completedSessions]
  );
  const termOptions = useMemo(
    () =>
      Array.from(new Set(classes.map((klass) => klass.academicTerm))).sort((left, right) =>
        left.localeCompare(right)
      ),
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
          if (classSort.key === 'teachers') {
            return entry.klass.teachers.map((teacher) => teacher.name).join(', ');
          }
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
        metrics: metricsForStudent(
          student,
          completedSessions,
          confirmedEvents,
          c.attendanceStatusFor
        )
      })),
    [c.attendanceStatusFor, c.students, completedSessions, confirmedEvents]
  );
  const courseOptions = useMemo(
    () =>
      Array.from(new Set(c.students.flatMap(studentCourses))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [c.students]
  );
  const filteredStudentRows = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    return studentRows.filter(({ student }) => {
      if (studentCourse !== ALL_COURSES && !studentCourses(student).includes(studentCourse)) {
        return false;
      }
      return (
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query)
      );
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

  const setClassQuery = (value: string) => {
    setClassQueryState(value);
    setClassPage(0);
  };
  const setTerm = (value: string) => {
    setTermState(value);
    setClassPage(0);
  };
  const setStudentQuery = (value: string) => {
    setStudentQueryState(value);
    setStudentPage(0);
  };
  const setStudentCourse = (value: string) => {
    setStudentCourseState(value);
    setStudentPage(0);
  };
  const updateDateFrom = (value: string) => {
    c.setDateFrom(value);
    setClassPage(0);
    setStudentPage(0);
  };
  const updateDateTo = (value: string) => {
    c.setDateTo(value);
    setClassPage(0);
    setStudentPage(0);
  };
  const openClass = (classId: string) => {
    setSelectedClassId(classId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const closeClass = () => {
    setSelectedClassId(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const openStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const closeStudent = () => {
    setSelectedStudentId(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const recordedAttendanceCount = attendance.present + attendance.late + attendance.absent;
  const attendingAttendanceCount = attendance.present + attendance.late;

  return {
    allCoursesLabel: ALL_COURSES,
    classes,
    classesLoading,
    classesError,
    loadClasses,
    selectedClass,
    selectedStudent,
    classQuery,
    setClassQuery,
    term,
    setTerm,
    termOptions,
    classSort,
    toggleClassSort: (key: ClassSortKey) => {
      toggleClassSort(key);
      setClassPage(0);
    },
    filteredClassRows,
    sortedClassRows,
    pagedClasses,
    studentQuery,
    setStudentQuery,
    studentCourse,
    setStudentCourse,
    courseOptions,
    studentSort,
    toggleStudentSort: (key: StudentSortKey) => {
      toggleStudentSort(key);
      setStudentPage(0);
    },
    filteredStudentRows,
    sortedStudentRows,
    pagedStudents,
    rangeValid,
    completedSessions,
    attendance,
    confirmedEvents,
    eventCounts,
    classRows,
    pendingAndRejected,
    insight,
    insightLoading,
    insightError,
    loadInsight,
    openClass,
    closeClass,
    openStudent,
    closeStudent,
    updateDateFrom,
    updateDateTo,
    clearClassFilters: () => {
      setClassQuery('');
      setTerm(ALL_TERMS);
    },
    clearStudentFilters: () => {
      setStudentQuery('');
      setStudentCourse(ALL_COURSES);
    },
    overviewTitle: isAdmin ? 'Institution overview' : 'My classes overview',
    attendanceScopeDescription: isAdmin
      ? 'Across all completed sessions in the institution scope.'
      : 'Across completed sessions in classes assigned to you.',
    recordedAttendanceCount,
    attendingAttendanceCount
  };
}

export type ReportsWorkspace = ReturnType<typeof useReportsWorkspace>;
