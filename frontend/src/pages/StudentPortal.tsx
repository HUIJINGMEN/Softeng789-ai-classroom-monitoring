import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowRight,
  IconBarChart,
  IconClipboardCheck,
  IconGraduationCap,
  IconHome,
  IconMessageSquare
} from '../components/icons';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { useTheme } from '../hooks/useTheme';
import { apiMessage } from '../lib/apiClient';
import { sessionRoomLabel } from '../lib/classroomApi';
import { avatarTone, faceEnrollmentLabel, initials, statusClass } from '../lib/format';
import { listMyProgressReports } from '../lib/progressReportApi';
import { listPublishedFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { formatSessionDateLabel, formatSessionTimeRange, formatTimestampClock } from '../lib/sessionTime';
import { getStudent, mapStudentApiToUi } from '../lib/studentApi';
import {
  getMyAttendanceBenchmark,
  getMyAttendanceHistory,
  type StudentAttendanceBenchmark
} from '../lib/studentPortalApi';
import type {
  AttendanceStatus,
  AuthUser,
  FeedbackSummary,
  ProgressReport,
  Student,
  StudentAttendanceHistoryEntry
} from '../types';

interface Props {
  readonly user: AuthUser;
  readonly onLogout: () => void;
}

type StudentView = 'overview' | 'attendance' | 'feedback' | 'reports';

const VIEW_LABELS: Record<StudentView, string> = {
  overview: 'Overview',
  attendance: 'Attendance',
  feedback: 'Feedback',
  reports: 'Reports'
};

function reportCourse(report: ProgressReport) {
  return report.classLabel.split(' · ')[0]?.trim() || report.classLabel;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function attendanceCounts(rows: StudentAttendanceHistoryEntry[]) {
  const base: Record<AttendanceStatus, number> = { Present: 0, Late: 0, Absent: 0, Unknown: 0 };
  rows.forEach((row) => {
    base[row.status] += 1;
  });
  const attended = base.Present + base.Late;
  return {
    ...base,
    rate: rows.length > 0 ? Math.round((attended / rows.length) * 100) : 0,
    total: rows.length
  };
}

type ComparisonTone = 'ahead' | 'aligned' | 'behind' | 'unavailable';

function attendanceComparison(
  studentRate: number,
  studentMarks: number,
  classAverage: number | null | undefined
): { tone: ComparisonTone; title: string; message: string; difference: number | null } {
  if (studentMarks === 0 || classAverage === null || classAverage === undefined) {
    return {
      tone: 'unavailable',
      title: 'Class comparison is not available yet.',
      message: 'It will appear once both you and your class have attendance records.',
      difference: null
    };
  }

  const difference = studentRate - classAverage;
  if (difference >= 3) {
    return {
      tone: 'ahead',
      title: `You’re ${difference} points above your class average.`,
      message: 'Great consistency—keep building on this attendance pattern.',
      difference
    };
  }
  if (difference <= -3) {
    return {
      tone: 'behind',
      title: `You’re ${Math.abs(difference)} points below your class average.`,
      message: 'A few more attended sessions can help close the gap. Ask your teacher if you need support.',
      difference
    };
  }
  return {
    tone: 'aligned',
    title: 'You’re keeping pace with your class.',
    message: 'Your attendance is close to the class average. A little more consistency can move you ahead.',
    difference
  };
}

interface ParticipationComparisonCardProps {
  readonly studentRate: number;
  readonly studentMarks: number;
  readonly averageRate: number | null | undefined;
  readonly benchmarkMarks: number;
  readonly benchmarkStudents: number;
  readonly scopeLabel: string;
  readonly featured?: boolean;
  readonly onOpenAttendance?: () => void;
}

function ParticipationComparisonCard({
  studentRate,
  studentMarks,
  averageRate,
  benchmarkMarks,
  benchmarkStudents,
  scopeLabel,
  featured = false,
  onOpenAttendance
}: ParticipationComparisonCardProps) {
  const comparison = attendanceComparison(studentRate, studentMarks, averageRate);
  const titleId = featured ? 'student-overview-comparison-title' : 'student-attendance-comparison-title';

  return (
    <section
      className={`student-comparison student-comparison--${comparison.tone}${featured ? ' student-comparison--featured' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="student-comparison__copy">
        <div className="student-comparison__heading">
          <span className="student-comparison__icon" aria-hidden="true"><IconBarChart /></span>
          <div>
            <h2 id={titleId}>{featured ? 'Your participation' : 'Participation comparison'}</h2>
            <p>{scopeLabel} · Present and Late count as participation</p>
          </div>
        </div>
        <strong className="student-comparison__message">{comparison.title}</strong>
        <p className="student-comparison__guidance">{comparison.message}</p>
        {benchmarkMarks > 0 && (
          <span className="student-comparison__sample">
            Based on {benchmarkMarks} attendance mark{benchmarkMarks === 1 ? '' : 's'} across{' '}
            {benchmarkStudents} student{benchmarkStudents === 1 ? '' : 's'}.
          </span>
        )}
        {featured && onOpenAttendance && (
          <button type="button" className="student-comparison__action" onClick={onOpenAttendance}>
            View attendance details <IconArrowRight />
          </button>
        )}
      </div>

      <div className="student-comparison__visual" aria-label="Your participation compared with your class average">
        <div className="student-comparison__bar-row">
          <div className="student-comparison__bar-label">
            <span>You</span>
            <strong>{studentMarks > 0 ? `${studentRate}%` : '—'}</strong>
          </div>
          <div className="student-comparison__track" aria-hidden="true">
            <span
              className="student-comparison__fill student-comparison__fill--student"
              style={{ width: `${studentMarks > 0 ? studentRate : 0}%` }}
            />
          </div>
        </div>
        <div className="student-comparison__bar-row">
          <div className="student-comparison__bar-label">
            <span>Class average</span>
            <strong>{averageRate === null || averageRate === undefined ? '—' : `${averageRate}%`}</strong>
          </div>
          <div className="student-comparison__track" aria-hidden="true">
            <span
              className="student-comparison__fill student-comparison__fill--class"
              style={{ width: `${averageRate ?? 0}%` }}
            />
          </div>
        </div>
        <div className="student-comparison__difference">
          <span>Difference</span>
          <strong>
            {comparison.difference === null
              ? '—'
              : `${comparison.difference > 0 ? '+' : ''}${comparison.difference} pts`}
          </strong>
        </div>
      </div>
    </section>
  );
}

export default function StudentPortal({ user, onLogout }: Props) {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<StudentView>('overview');
  const [profile, setProfile] = useState<Student | null>(null);
  const [history, setHistory] = useState<StudentAttendanceHistoryEntry[]>([]);
  const [benchmark, setBenchmark] = useState<StudentAttendanceBenchmark | null>(null);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [publishedReports, setPublishedReports] = useState<FeedbackSummary[]>([]);
  const [publishedReportsError, setPublishedReportsError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('all');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    Promise.allSettled([
      getStudent(user.id),
      getMyAttendanceHistory(user.id),
      getMyAttendanceBenchmark(user.id),
      listMyProgressReports(user.id),
      listPublishedFeedbackSummaries(user.id)
    ]).then(([profileResult, historyResult, benchmarkResult, reportsResult, publishedResult]) => {
      if (cancelled) return;
      const nextErrors: string[] = [];

      if (profileResult.status === 'fulfilled') {
        setProfile(mapStudentApiToUi(profileResult.value));
      } else {
        nextErrors.push(`Profile: ${apiMessage(profileResult.reason)}`);
      }
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      } else {
        nextErrors.push(`Attendance: ${apiMessage(historyResult.reason)}`);
      }
      if (benchmarkResult.status === 'fulfilled') {
        setBenchmark(benchmarkResult.value);
      } else {
        setBenchmark(null);
        nextErrors.push(`Class comparison: ${apiMessage(benchmarkResult.reason)}`);
      }
      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value);
      } else {
        nextErrors.push(`Feedback: ${apiMessage(reportsResult.reason)}`);
      }
      if (publishedResult.status === 'fulfilled') {
        setPublishedReports(publishedResult.value);
        setPublishedReportsError('');
      } else {
        setPublishedReports([]);
        setPublishedReportsError(apiMessage(publishedResult.reason));
      }

      setErrors(nextErrors);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt, user.id, user.token]);

  const courses = useMemo(() => {
    const values = new Set(profile?.courses ?? (profile?.course ? [profile.course] : []));
    history.forEach((row) => values.add(row.course));
    reports.forEach((report) => values.add(reportCourse(report)));
    publishedReports.forEach((report) => values.add(report.classLabel.split(' · ')[0]?.trim() || report.classLabel));
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [history, profile, publishedReports, reports]);

  const filteredHistory = useMemo(
    () => history.filter((row) => courseFilter === 'all' || row.course === courseFilter),
    [courseFilter, history]
  );
  const filteredReports = useMemo(
    () => reports.filter((report) => courseFilter === 'all' || reportCourse(report) === courseFilter),
    [courseFilter, reports]
  );
  const filteredPublishedReports = useMemo(
    () => publishedReports.filter((report) => courseFilter === 'all' || report.classLabel.split(' · ')[0]?.trim() === courseFilter),
    [courseFilter, publishedReports]
  );
  const overall = useMemo(() => attendanceCounts(history), [history]);
  const visibleCounts = useMemo(() => attendanceCounts(filteredHistory), [filteredHistory]);
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
  const displayName = profile?.name ?? user.name;
  const firstName = displayName.split(' ')[0] || displayName;
  const tone = avatarTone(user.id, 0);

  const openView = (nextView: StudentView, course = 'all') => {
    setCourseFilter(course);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="student-portal">
      <a className="skip-link" href="#student-main">
        Skip to main content
      </a>

      <header className="student-portal__top">
        <div className="student-brand" aria-label="ClassroomIQ Student Portal">
          <span className="student-brand__mark" aria-hidden="true">CM</span>
          <span>
            <strong>ClassroomIQ</strong>
            <small>Student Portal</small>
          </span>
        </div>

        <nav className="student-nav" aria-label="Student portal">
          <button
            type="button"
            className={`student-nav__item${view === 'overview' ? ' student-nav__item--active' : ''}`}
            aria-current={view === 'overview' ? 'page' : undefined}
            onClick={() => openView('overview')}
          >
            <IconHome />
            <span>{VIEW_LABELS.overview}</span>
          </button>
          <button
            type="button"
            className={`student-nav__item${view === 'attendance' ? ' student-nav__item--active' : ''}`}
            aria-current={view === 'attendance' ? 'page' : undefined}
            onClick={() => openView('attendance')}
          >
            <IconClipboardCheck />
            <span>{VIEW_LABELS.attendance}</span>
          </button>
          <button
            type="button"
            className={`student-nav__item${view === 'feedback' ? ' student-nav__item--active' : ''}`}
            aria-current={view === 'feedback' ? 'page' : undefined}
            onClick={() => openView('feedback')}
          >
            <IconMessageSquare />
            <span>{VIEW_LABELS.feedback}</span>
            {reports.length > 0 && <span className="student-nav__count">{reports.length}</span>}
          </button>
          <button
            type="button"
            className={`student-nav__item${view === 'reports' ? ' student-nav__item--active' : ''}`}
            aria-current={view === 'reports' ? 'page' : undefined}
            onClick={() => openView('reports')}
          >
            <IconBarChart />
            <span>{VIEW_LABELS.reports}</span>
            {publishedReports.length > 0 && (
              <span className="student-nav__count">{publishedReports.length}</span>
            )}
          </button>
        </nav>

        <div className="student-account">
          <ThemeToggleButton
            theme={theme}
            onToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
          <div className={`person__avatar ${tone}`} aria-hidden="true">
            {initials(displayName)}
          </div>
          <div className="student-account__copy">
            <strong>{displayName}</strong>
            <span>{profile?.studentNumber ?? 'Student'}</span>
          </div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="student-portal__page" id="student-main" tabIndex={-1}>
        <div className="student-portal__inner">
          {errors.length > 0 && (
            <div className="notice notice--warn student-data-notice" role="status">
              <span className="notice__mark" aria-hidden="true" />
              <span className="student-data-notice__message">
                Some information could not be loaded. {errors.join(' ')}
              </span>
              <button
                type="button"
                className="btn btn--sm"
                disabled={loading}
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              >
                {loading ? 'Retrying…' : 'Try again'}
              </button>
            </div>
          )}

          {view === 'overview' && (
            <div className="student-view student-view--overview">
              <section className="student-welcome">
                <div>
                  <h1>Welcome back, {firstName}</h1>
                  <p>Your classes, attendance and teacher feedback are together here.</p>
                </div>
                <span className={statusClass(profile?.faceEnrollmentStatus ?? 'NOT_ENROLLED')}>
                  Face enrolment: {faceEnrollmentLabel(profile?.faceEnrollmentStatus ?? 'NOT_ENROLLED')}
                </span>
              </section>

              <ParticipationComparisonCard
                studentRate={overall.rate}
                studentMarks={overall.total}
                averageRate={benchmark?.overallAverageRate}
                benchmarkMarks={benchmark?.totalMarks ?? 0}
                benchmarkStudents={benchmark?.studentCount ?? 0}
                scopeLabel="Across your enrolled classes"
                featured
                onOpenAttendance={() => openView('attendance')}
              />

              <section className="student-summary" aria-label="Student summary">
                <div className="student-summary__item">
                  <span>Participation</span>
                  <strong>{loading || overall.total === 0 ? '—' : `${overall.rate}%`}</strong>
                  <small>
                    {overall.total} recorded session{overall.total === 1 ? '' : 's'}
                  </small>
                </div>
                <div className="student-summary__item">
                  <span>Classes</span>
                  <strong>{loading ? '—' : courses.length}</strong>
                  <small>Active enrolments</small>
                </div>
                <div className="student-summary__item">
                  <span>Feedback</span>
                  <strong>{loading ? '—' : reports.length}</strong>
                  <small>Teacher feedback</small>
                </div>
              </section>

              <div className="student-overview-grid">
                <section className="student-panel">
                  <div className="student-panel__head">
                    <div>
                      <h2>My classes</h2>
                      <p>Select a class to review its attendance.</p>
                    </div>
                    <IconGraduationCap />
                  </div>
                  <div className="student-course-list">
                    {courses.map((course) => {
                      const rows = history.filter((row) => row.course === course);
                      const courseCounts = attendanceCounts(rows);
                      return (
                        <button
                          type="button"
                          className="student-course-row"
                          key={course}
                          onClick={() => openView('attendance', course)}
                        >
                          <span className="student-course-row__code">{course}</span>
                          <span className="student-course-row__meta">
                            {courseCounts.total} session{courseCounts.total === 1 ? '' : 's'}
                          </span>
                          <span className="student-course-row__rate">
                            {courseCounts.total > 0 ? `${courseCounts.rate}%` : 'No records'}
                          </span>
                          <IconArrowRight />
                        </button>
                      );
                    })}
                    {!loading && courses.length === 0 && (
                      <div className="student-empty-inline">No active classes yet.</div>
                    )}
                    {loading && <div className="student-loading-line" aria-label="Loading classes" />}
                  </div>
                </section>

                <section className="student-panel">
                  <div className="student-panel__head">
                    <div>
                      <h2>Latest feedback</h2>
                      <p>Notes shared by your teachers.</p>
                    </div>
                    <IconMessageSquare />
                  </div>
                  <div className="student-feedback-preview">
                    {reports.slice(0, 2).map((report) => (
                      <article className="student-feedback-preview__item" key={report.id}>
                        <p>{report.comment}</p>
                        <span>{reportCourse(report)} · {report.teacherName}</span>
                      </article>
                    ))}
                    {!loading && reports.length === 0 && (
                      <div className="student-empty-inline">No teacher feedback has been shared yet.</div>
                    )}
                    {loading && <div className="student-loading-line" aria-label="Loading feedback" />}
                  </div>
                  {reports.length > 0 && (
                    <button type="button" className="student-text-action" onClick={() => openView('feedback')}>
                      View all feedback <IconArrowRight />
                    </button>
                  )}
                </section>
              </div>

              <section className="student-profile-strip" aria-label="Account details">
                <div>
                  <span>Student number</span>
                  <strong>{profile?.studentNumber ?? '—'}</strong>
                </div>
                <div>
                  <span>Programme</span>
                  <strong>{profile?.program ?? '—'}</strong>
                </div>
                <div>
                  <span>University email</span>
                  <strong>{profile?.email ?? user.email}</strong>
                </div>
              </section>
            </div>
          )}

          {view === 'attendance' && (
            <div className="student-view">
              <div className="student-page-head">
                <div>
                  <h1>Attendance</h1>
                  <p>Your recorded classroom sessions.</p>
                </div>
                <label className="student-course-filter">
                  <span>Class</span>
                  <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                    <option value="all">All classes</option>
                    {courses.map((course) => <option value={course} key={course}>{course}</option>)}
                  </select>
                </label>
              </div>

              <section className="student-attendance-summary" aria-label="Attendance totals">
                <div><span>Attendance rate</span><strong>{visibleCounts.total > 0 ? `${visibleCounts.rate}%` : '—'}</strong></div>
                <div><span>Present</span><strong className="student-number--ok">{visibleCounts.Present}</strong></div>
                <div><span>Late</span><strong className="student-number--warn">{visibleCounts.Late}</strong></div>
                <div><span>Absent</span><strong className="student-number--danger">{visibleCounts.Absent}</strong></div>
              </section>

              <ParticipationComparisonCard
                studentRate={visibleCounts.rate}
                studentMarks={visibleCounts.total}
                averageRate={visibleBenchmark?.averageRate}
                benchmarkMarks={visibleBenchmark?.totalMarks ?? 0}
                benchmarkStudents={visibleBenchmark?.studentCount ?? 0}
                scopeLabel={courseFilter === 'all' ? 'Across your enrolled classes' : courseFilter}
              />

              <section className="student-panel student-records-panel">
                <div className="student-records-head" aria-hidden="true">
                  <span>Class</span><span>Date &amp; time</span><span>Status</span><span>Check-in</span>
                </div>
                <div className="student-records-list">
                  {filteredHistory.map((row) => (
                    <article className="student-record-row" key={row.sessionId}>
                      <div className="student-record-row__class">
                        <strong>{row.course}</strong>
                        <span>{sessionRoomLabel(row)}</span>
                      </div>
                      <div className="student-record-row__date">
                        <strong>{formatSessionDateLabel(row.sessionDate)}</strong>
                        <span>{formatSessionTimeRange(row.startTime, row.endTime, row.sessionDate)}</span>
                      </div>
                      <div className="student-record-row__status"><span className={statusClass(row.status)}>{row.status}</span></div>
                      <div className="student-record-row__check-in">
                        <strong>{formatTimestampClock(row.checkInTime)}</strong>
                        <span>{row.checkOutTime ? `Out ${formatTimestampClock(row.checkOutTime)}` : 'No check-out'}</span>
                      </div>
                    </article>
                  ))}
                  {!loading && filteredHistory.length === 0 && (
                    <div className="student-empty-state">
                      <strong>No attendance recorded</strong>
                      <span>Sessions will appear here after your teacher records attendance.</span>
                    </div>
                  )}
                  {loading && <div className="student-loading-block" aria-label="Loading attendance" />}
                </div>
              </section>
            </div>
          )}

          {view === 'feedback' && (
            <div className="student-view">
              <div className="student-page-head">
                <div>
                  <h1>Teacher feedback</h1>
                  <p>Read-only progress notes shared with you.</p>
                </div>
                <label className="student-course-filter">
                  <span>Class</span>
                  <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                    <option value="all">All classes</option>
                    {courses.map((course) => <option value={course} key={course}>{course}</option>)}
                  </select>
                </label>
              </div>

              <section className="student-feedback-list" aria-live="polite">
                {filteredReports.map((report) => (
                  <article className="student-feedback-card" key={report.id}>
                    <div className="student-feedback-card__meta">
                      <span>{reportCourse(report)}</span>
                      <span>{dateLabel(report.createdAt)}</span>
                    </div>
                    <p>{report.comment}</p>
                    <div className="student-feedback-card__teacher">
                      <div className={`person__avatar ${avatarTone(report.teacherId, 1)}`} aria-hidden="true">
                        {initials(report.teacherName)}
                      </div>
                      <span>Shared by <strong>{report.teacherName}</strong></span>
                    </div>
                    {report.photoUrl && (
                      <a className="student-feedback-card__photo" href={report.photoUrl} target="_blank" rel="noreferrer">
                        <img src={report.photoUrl} alt={`Evidence attached to feedback from ${report.teacherName}`} />
                        <span>Open attachment</span>
                      </a>
                    )}
                  </article>
                ))}
                {!loading && filteredReports.length === 0 && (
                  <div className="student-empty-state student-empty-state--panel">
                    <strong>No feedback yet</strong>
                    <span>Your teacher's progress notes will appear here when they are shared.</span>
                  </div>
                )}
                {loading && <div className="student-loading-block" aria-label="Loading feedback" />}
              </section>
            </div>
          )}

          {view === 'reports' && (
            <div className="student-view">
              <div className="student-page-head">
                <div>
                  <h1>Progress reports</h1>
                  <p>Formal summaries reviewed and published by your teachers.</p>
                </div>
                <label className="student-course-filter">
                  <span>Class</span>
                  <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                    <option value="all">All classes</option>
                    {courses.map((course) => <option value={course} key={course}>{course}</option>)}
                  </select>
                </label>
              </div>

              {publishedReportsError ? (
                <div className="notice notice--warn student-report-notice" role="status">
                  <span className="notice__mark" aria-hidden="true" />
                  <span>Published reports are temporarily unavailable. Restart the updated backend, then try again.</span>
                  <button type="button" className="btn btn--sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
                </div>
              ) : (
                <section className="student-feedback-list" aria-live="polite">
                  {filteredPublishedReports.map((report) => (
                    <article className="student-feedback-card student-report-card" key={report.id}>
                      <div className="student-feedback-card__meta">
                        <span>{report.classLabel.split(' · ')[0]}</span>
                        <span>{report.dateFrom}–{report.dateTo}</span>
                      </div>
                      <div className="student-feedback-summary__section"><span>Progress summary</span><p>{report.summary}</p></div>
                      <div className="student-feedback-summary__section"><span>Strengths</span><p>{report.strengths}</p></div>
                      <div className="student-feedback-summary__section"><span>Next steps</span><p>{report.nextSteps}</p></div>
                      <div className="student-feedback-card__teacher">
                        <div className={`person__avatar ${avatarTone(report.createdByTeacherId, 1)}`} aria-hidden="true">
                          {initials(report.reviewedByTeacherName ?? report.createdByTeacherName)}
                        </div>
                        <span>Reviewed by <strong>{report.reviewedByTeacherName ?? report.createdByTeacherName}</strong></span>
                      </div>
                    </article>
                  ))}
                  {!loading && filteredPublishedReports.length === 0 && (
                    <div className="student-empty-state student-empty-state--panel">
                      <strong>No published reports yet</strong>
                      <span>Your feedback remains available in Feedback. Formal summaries appear here only when a teacher publishes them.</span>
                    </div>
                  )}
                  {loading && <div className="student-loading-block" aria-label="Loading reports" />}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
