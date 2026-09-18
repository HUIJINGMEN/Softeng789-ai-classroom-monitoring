import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import AttendanceDonutChart from '../components/AttendanceDonutChart';
import BackButton from '../components/BackButton';
import CreateFeedbackModal from '../components/CreateFeedbackModal';
import CreateAccomplishmentModal from '../components/CreateAccomplishmentModal';
import {
  IconAward,
  IconBarChart,
  IconClipboardCheck,
  IconGraduationCap,
  IconMessageSquare,
  IconUser
} from '../components/icons';
import ReviewAccomplishmentCorrectionModal from '../components/ReviewAccomplishmentCorrectionModal';
import ExportShareModal from '../components/ExportShareModal';
import Modal from '../components/Modal';
import Pager from '../components/Pager';
import PersonAvatar from '../components/PersonAvatar';
import PrepareFeedbackReportModal, { type StudentReportSelection } from '../components/PrepareFeedbackReportModal';
import ShowMoreOrPager from '../components/ShowMoreOrPager';
import StudentReportPrint from '../components/StudentReportPrint';
import { useExpandablePage } from '../hooks/useExpandablePage';
import { apiMessage } from '../lib/apiClient';
import { sessionRoomLabel } from '../lib/classroomApi';
import { eventMatchesStudent, eventSessionLabel } from '../lib/eventDisplay';
import {
  attendanceStatusLabel,
  avatarTone,
  formatDateTime,
  formatRate,
  statusClass,
  studentRateLabel,
  studentRateLabelClass
} from '../lib/format';
import { createProgressReport, listProgressReportsForStudent } from '../lib/progressReportApi';
import {
  confirmAccomplishment,
  listAccomplishmentsForStudent,
  revokeAccomplishment
} from '../lib/accomplishmentApi';
import {
  accomplishmentCategoryLabel,
  accomplishmentStatusClass,
  accomplishmentStatusLabel,
  formatAccomplishmentPoints
} from '../lib/accomplishments';
import { listFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { studentCourses } from '../lib/studentCourses';
import { studentLevelLabel } from '../lib/studentLevels';
import { formatSessionDateLabel } from '../lib/sessionTime';
import { usePagination } from '../lib/table';
import { updateStudentAccountStatus } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { Accomplishment, FeedbackSummary, HealthClassOption, ProgressReport, Student } from '../types';

interface Props {
  readonly profile: Student;
  readonly console: Console;
  readonly isAdmin: boolean;
}

type MobileProfileSection = 'feedback' | 'attendance' | 'achievements' | 'more';

// Rendered with `key={profile.id}` by the caller, so React fully remounts this component (and
// resets all the useState below) whenever the admin looks at a different student — no manual
// "reset on profile change" effect needed here.
export default function StudentProfile({ profile, console: c, isAdmin }: Props) {
  const [mobileSection, setMobileSection] = useState<MobileProfileSection>('feedback');
  const mobileRecordRef = useRef<HTMLDivElement>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // Reactivating is a single click (same as everywhere else in the app — Staff, Classes), but
  // withdrawing a student loses them system access and drops every current class enrolment, so it
  // gets a confirmation step first rather than firing on the first click.
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const reactivateStudent = async () => {
    if (!profile.recordId) return;
    setUpdatingStatus(true);
    try {
      await updateStudentAccountStatus(profile.recordId, 'active');
      await c.refreshStudents();
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const withdrawStudent = async () => {
    if (!profile.recordId) return;
    setUpdatingStatus(true);
    try {
      await updateStudentAccountStatus(profile.recordId, 'withdrawn');
      await c.refreshStudents();
      setConfirmingWithdraw(false);
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const confirmed = c.events.filter(
    (event) =>
      eventMatchesStudent(event, profile) &&
      (event.status === 'Confirmed' || event.status === 'Corrected')
  );

  const profileCourses = studentCourses(profile);
  const coursesExpand = useExpandablePage(profileCourses, 3);

  // Most-recent-first regardless of whatever order c.sessions happens to be in — a newly
  // created session gets prepended to that array on creation, so it isn't reliably date-sorted.
  const attendanceHistory = c.sessions
    .filter((session) => profileCourses.includes(session.course))
    .sort((a, b) => b.date.localeCompare(a.date));
  const attendanceAllUnrecorded =
    attendanceHistory.length > 0 &&
    attendanceHistory.every((session) => c.attendanceStatusFor(profile.id, session.id) === 'Unknown');
  const attendanceExpand = useExpandablePage(attendanceHistory, 4);
  const eventsExpand = useExpandablePage(confirmed, 4);

  // Same session set profile.rate was computed from (useConsole.ts's studentsWithRate), so the
  // percentage in the donut's center always agrees with the present/late/absent/unrecorded ring
  // drawn around it.
  const attendanceBreakdown = useMemo(() => {
    const totals = attendanceHistory.reduce(
      (acc, session) => {
        const status = c.attendanceStatusFor(profile.id, session.id);
        if (status === 'Present') acc.present += 1;
        else if (status === 'Late') acc.late += 1;
        else if (status === 'Absent') acc.absent += 1;
        else acc.unknown += 1;
        return acc;
      },
      { present: 0, late: 0, absent: 0, unknown: 0 }
    );
    return { ...totals, total: attendanceHistory.length, rate: profile.rate };
  }, [attendanceHistory, c.attendanceStatusFor, profile.id, profile.rate]);
  const hasRecordedAttendance =
    attendanceBreakdown.present + attendanceBreakdown.late + attendanceBreakdown.absent > 0;

  const absences = attendanceHistory.filter(
    (session) => c.attendanceStatusFor(profile.id, session.id) === 'Absent'
  );
  const [absencesPage, setAbsencesPage] = useState(0);
  const pagedAbsences = usePagination(absences, absencesPage, setAbsencesPage, 4);

  // Reports come from two places — mobile-web Quick Capture (photo + comment) and this page's own
  // "+ Add feedback" (text only) — fetched here rather than through useConsole since nothing else
  // in the console needs a cross-student view of them.
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportsLoadError, setReportsLoadError] = useState(false);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [addingAccomplishment, setAddingAccomplishment] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
  const [reportClassOptions, setReportClassOptions] = useState<HealthClassOption[]>([]);
  const [preparingReport, setPreparingReport] = useState(false);
  const [shareSummaries, setShareSummaries] = useState<FeedbackSummary[] | null>(null);
  const [printReport, setPrintReport] = useState<StudentReportSelection | null>(null);
  const [accomplishments, setAccomplishments] = useState<Accomplishment[]>([]);
  const [loadingAccomplishments, setLoadingAccomplishments] = useState(true);
  const [accomplishmentsLoadError, setAccomplishmentsLoadError] = useState(false);
  const [accomplishmentBusyId, setAccomplishmentBusyId] = useState<string | null>(null);
  const [reviewingAccomplishment, setReviewingAccomplishment] = useState<Accomplishment | null>(null);

  const refreshReports = useCallback(() => {
    if (!profile.recordId) {
      setLoadingReports(false);
      return Promise.resolve();
    }
    setLoadingReports(true);
    setReportsLoadError(false);
    return listProgressReportsForStudent(profile.recordId)
      .then(setProgressReports)
      .catch((error) => {
        setReportsLoadError(true);
        c.showToast(apiMessage(error));
      })
      .finally(() => setLoadingReports(false));
  }, [profile.recordId, c.showToast]);

  const refreshSummaries = useCallback(() => {
    if (!profile.recordId) return Promise.resolve();
    return listFeedbackSummaries(profile.recordId)
      .then(setSummaries)
      .catch((error) => c.showToast(apiMessage(error)));
  }, [profile.recordId, c.showToast]);

  const refreshAccomplishments = useCallback(() => {
    if (!profile.recordId) {
      setLoadingAccomplishments(false);
      return Promise.resolve();
    }
    setLoadingAccomplishments(true);
    setAccomplishmentsLoadError(false);
    return listAccomplishmentsForStudent(profile.recordId)
      .then(setAccomplishments)
      .catch((error) => {
        setAccomplishmentsLoadError(true);
        c.showToast(apiMessage(error));
      })
      .finally(() => setLoadingAccomplishments(false));
  }, [profile.recordId, c.showToast]);

  useEffect(() => {
    void refreshReports();
    void refreshSummaries();
    void refreshAccomplishments();
  }, [refreshAccomplishments, refreshReports, refreshSummaries]);

  useEffect(() => {
    let cancelled = false;
    if (!profile.recordId) {
      setReportClassOptions([]);
      return () => { cancelled = true; };
    }
    listMyClassOptions()
      .then((options) => {
        if (!cancelled) {
          setReportClassOptions(options.filter((option) =>
            option.students.some((student) => student.id === profile.recordId)
          ));
        }
      })
      .catch((error) => {
        if (!cancelled) c.showToast(apiMessage(error));
      });
    return () => { cancelled = true; };
  }, [c.showToast, profile.recordId]);
  const reportsExpand = useExpandablePage(progressReports, 3);
  const achievementsNeedingReview = useMemo(
    () => accomplishments.filter((item) => item.latestCorrection?.status === 'PENDING').length,
    [accomplishments]
  );
  const orderedAccomplishments = useMemo(
    () => [...accomplishments].sort((left, right) => {
      const leftNeedsReview = left.latestCorrection?.status === 'PENDING';
      const rightNeedsReview = right.latestCorrection?.status === 'PENDING';
      if (leftNeedsReview !== rightNeedsReview) return leftNeedsReview ? -1 : 1;
      return right.achievementDate.localeCompare(left.achievementDate);
    }),
    [accomplishments]
  );
  const accomplishmentsExpand = useExpandablePage(orderedAccomplishments, 3);

  const addFeedback = async (payload: { courseOfferingId: string; comment: string }) => {
    if (!profile.recordId) return false;
    setSavingFeedback(true);
    try {
      await createProgressReport({
        studentId: profile.recordId,
        courseOfferingId: payload.courseOfferingId,
        comment: payload.comment
      });
      await refreshReports();
      return true;
    } catch (error) {
      c.showToast(apiMessage(error));
      return false;
    } finally {
      setSavingFeedback(false);
    }
  };

  const updateAccomplishmentStatus = async (item: Accomplishment, action: 'confirm' | 'revoke') => {
    setAccomplishmentBusyId(item.id);
    try {
      const updated = action === 'confirm'
        ? await confirmAccomplishment(item.id)
        : await revokeAccomplishment(item.id);
      setAccomplishments((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      c.updateAccomplishment(updated);
      c.showToast(action === 'confirm' ? 'Achievement shared with the student.' : 'Achievement removed from the student view.');
    } catch (error) {
      c.showToast(apiMessage(error));
    } finally {
      setAccomplishmentBusyId(null);
    }
  };

  const openMobileRecordSection = (section: MobileProfileSection) => {
    setMobileSection(section);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mobileRecordRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      mobileRecordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${section}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const handleMobileSectionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    section: MobileProfileSection
  ) => {
    const sections: MobileProfileSection[] = ['feedback', 'attendance', 'achievements', 'more'];
    const currentIndex = sections.indexOf(section);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % sections.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + sections.length) % sections.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = sections.length - 1;
    else return;

    event.preventDefault();
    const nextSection = sections[nextIndex];
    setMobileSection(nextSection);
    window.requestAnimationFrame(() => {
      mobileRecordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${nextSection}"]`)
        ?.focus();
    });
  };

  return (
    <div className="page__inner student-profile-page">
      <div className="student-profile-mobile-layout">
        <BackButton
          className="student-mobile-profile__back"
          label="All students"
          onClick={() => {
            c.setProfileId(null);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />

        <section className="student-mobile-profile__hero" aria-labelledby="student-mobile-profile-name">
          <div className="student-mobile-profile__identity">
            <PersonAvatar
              photoUrl={profile.registrationPhoto}
              name={profile.name}
              tone={avatarTone(profile.id, 0)}
              alt={`${profile.name} registration`}
              large
            />
            <div>
              <div className="student-mobile-profile__name-line">
                <h2 id="student-mobile-profile-name">{profile.name}</h2>
                {profile.accountStatus === 'withdrawn' && <span className="badge badge--neutral">Withdrawn</span>}
              </div>
              <p>{profile.id} · {studentLevelLabel(profile.level)}</p>
            </div>
          </div>
          <div className="student-mobile-profile__headline-stats">
            <div className="student-mobile-profile__rate">
              <strong>{hasRecordedAttendance ? formatRate(profile.rate) : '—'}</strong>
              {profile.rate === null || !hasRecordedAttendance ? (
                <span className="student-mobile-profile__rate-empty">
                  {hasRecordedAttendance ? 'Unavailable' : 'Not recorded'}
                </span>
              ) : (
                <span className={studentRateLabelClass(profile.rate)}>{studentRateLabel(profile.rate)}</span>
              )}
            </div>
            <div className="student-mobile-profile__support-stat">
              <strong>{profileCourses.length}</strong>
              <span>Classes</span>
            </div>
            <div className="student-mobile-profile__support-stat">
              <strong aria-label={loadingReports ? 'Loading feedback count' : undefined}>
                {loadingReports ? '—' : progressReports.length}
              </strong>
              <span>Feedback notes</span>
            </div>
          </div>
        </section>

        <section className="student-mobile-profile__actions" aria-label="Student actions">
          <button
            type="button"
            className="student-mobile-profile__primary-action"
            disabled={!profile.recordId}
            onClick={() => setAddingFeedback(true)}
          >
            <span aria-hidden="true"><IconMessageSquare /></span>
            <span>
              <strong>Add feedback</strong>
              <small>Write a note for this student’s report</small>
            </span>
          </button>
          <div className="student-mobile-profile__secondary-actions">
            <button
              type="button"
              disabled={!profile.recordId || reportClassOptions.length === 0}
              onClick={() => setAddingAccomplishment(true)}
            >
              <IconAward />
              <span>Add achievement</span>
            </button>
            <button type="button" onClick={() => setPreparingReport(true)}>
              <IconClipboardCheck />
              <span>Export &amp; share</span>
            </button>
          </div>
        </section>

        {achievementsNeedingReview > 0 && (
          <button
            type="button"
            className="student-mobile-profile__review-alert"
            onClick={() => openMobileRecordSection('achievements')}
          >
            <span className="student-mobile-profile__review-count">{achievementsNeedingReview}</span>
            <span>
              <strong>
                Achievement change{achievementsNeedingReview === 1 ? '' : 's'}{' '}
                {achievementsNeedingReview === 1 ? 'needs' : 'need'} review
              </strong>
              <small>Open the student’s request before sharing.</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        )}

        <section className="student-mobile-attendance" aria-labelledby="student-mobile-attendance-title">
          <div className="student-mobile-section-heading">
            <div>
              <span className="student-mobile-section-heading__icon" aria-hidden="true"><IconBarChart /></span>
              <div>
                <h3 id="student-mobile-attendance-title">Attendance at a glance</h3>
                <p>Across {attendanceBreakdown.total} session{attendanceBreakdown.total === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="student-mobile-attendance__coverage">
              <strong>{attendanceBreakdown.total - attendanceBreakdown.unknown}/{attendanceBreakdown.total}</strong>
              <span>recorded</span>
            </div>
          </div>
          <div className="student-mobile-attendance__distribution" aria-label="Attendance status totals">
            <div className="is-present"><span>Present</span><strong>{attendanceBreakdown.present}</strong></div>
            <div className="is-late"><span>Late</span><strong>{attendanceBreakdown.late}</strong></div>
            <div className="is-absent"><span>Absent</span><strong>{attendanceBreakdown.absent}</strong></div>
            <div className="is-unknown"><span>Not recorded</span><strong>{attendanceBreakdown.unknown}</strong></div>
          </div>
          {absences.length > 0 ? (
            <button
              type="button"
              className="student-mobile-attendance__absence-link"
              onClick={() => openMobileRecordSection('attendance')}
            >
              <span>
                <strong>{absences.length} absence{absences.length === 1 ? '' : 's'}</strong>
                <small>Latest: {absences[0]?.dateLabel} · {absences[0]?.course}</small>
              </span>
              <span aria-hidden="true">View history →</span>
            </button>
          ) : (
            <div className={`student-mobile-attendance__clear${hasRecordedAttendance ? '' : ' is-pending'}`}>
              {hasRecordedAttendance ? 'No absences recorded.' : 'Attendance has not been recorded yet.'}
            </div>
          )}
        </section>

        <div ref={mobileRecordRef} className="student-mobile-profile__record">
          <nav className="student-mobile-profile__tabs" aria-label="Student record sections" role="tablist">
            {([
              ['feedback', 'Feedback', loadingReports ? null : progressReports.length],
              ['attendance', 'Attendance', attendanceHistory.length],
              ['achievements', 'Achievements', loadingAccomplishments ? null : accomplishments.length],
              ['more', 'More', null]
            ] as const).map(([section, label, count]) => (
              <button
                key={section}
                type="button"
                id={`student-mobile-tab-${section}`}
                data-mobile-section={section}
                className={mobileSection === section ? 'is-active' : ''}
                role="tab"
                aria-selected={mobileSection === section}
                aria-controls="student-mobile-record-panel"
                tabIndex={mobileSection === section ? 0 : -1}
                onClick={() => setMobileSection(section)}
                onKeyDown={(event) => handleMobileSectionKeyDown(event, section)}
              >
                <span>{label}</span>
                {count !== null && <small>{count}</small>}
              </button>
            ))}
          </nav>

          <section
            id="student-mobile-record-panel"
            className="student-mobile-profile__panel"
            role="tabpanel"
            aria-labelledby={`student-mobile-tab-${mobileSection}`}
          >
            {mobileSection === 'feedback' && (
              <>
                <div className="student-mobile-panel-heading">
                  <div>
                    <h3>Teacher feedback</h3>
                    <p>Notes already added to this student’s record.</p>
                  </div>
                  {!loadingReports && !reportsLoadError && progressReports.length > 0 && (
                    <button type="button" className="btn btn--sm" disabled={!profile.recordId} onClick={() => setAddingFeedback(true)}>Add note</button>
                  )}
                </div>
                {loadingReports ? (
                  <div className="student-mobile-loading" role="status">
                    <span className="student-mobile-loading__label">Loading feedback…</span>
                    <span className="skeleton skeleton--w-80" />
                    <span className="skeleton skeleton--w-62" />
                    <span className="skeleton skeleton--w-48" />
                  </div>
                ) : reportsLoadError ? (
                  <div className="student-mobile-load-error" role="alert">
                    <strong>Feedback could not be loaded</strong>
                    <span>Check the connection, then try again.</span>
                    <button type="button" className="btn btn--sm" onClick={() => void refreshReports()}>Try again</button>
                  </div>
                ) : progressReports.length === 0 ? (
                  <div className="student-mobile-empty">
                    <span className="student-mobile-empty__icon" aria-hidden="true"><IconMessageSquare /></span>
                    <strong>No feedback yet</strong>
                    <span>Add the first note while the classroom context is still fresh.</span>
                    <button type="button" className="btn btn--primary btn--sm" disabled={!profile.recordId} onClick={() => setAddingFeedback(true)}>Add feedback</button>
                  </div>
                ) : (
                  <>
                    <div className="student-mobile-record-list">
                      {reportsExpand.visibleItems.map((report) => (
                        <article key={report.id} className={`student-mobile-feedback-row${report.photoUrl ? ' has-image' : ''}`}>
                          {report.photoUrl && (
                            <img
                              src={report.photoUrl}
                              alt={`Feedback evidence for ${profile.name}`}
                              width="52"
                              height="52"
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                          <div>
                            <p>{report.comment}</p>
                            <span>{report.classLabel} · {formatDateTime(report.createdAt)}</span>
                            <small>By {report.teacherName}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                    <ShowMoreOrPager
                      showingAll={reportsExpand.showingAll}
                      hasMore={reportsExpand.hasMore}
                      onShowAll={reportsExpand.showAll}
                      paged={reportsExpand.paged}
                      moreLabel={`Show all ${progressReports.length} notes →`}
                    />
                  </>
                )}
              </>
            )}

            {mobileSection === 'attendance' && (
              <>
                <div className="student-mobile-panel-heading">
                  <div>
                    <h3>Attendance history</h3>
                    <p>Most recent classroom sessions first.</p>
                  </div>
                </div>
                {attendanceHistory.length === 0 ? (
                  <div className="student-mobile-empty"><strong>No sessions yet</strong><span>Attendance will appear after the first class session.</span></div>
                ) : (
                  <>
                    <div className="student-mobile-record-list">
                      {attendanceExpand.visibleItems.map((session) => {
                        const status = c.attendanceStatusFor(profile.id, session.id);
                        return (
                          <article key={session.id} className="student-mobile-history-row">
                            <div>
                              <strong>{session.dateLabel}</strong>
                              <span>{session.course} · {sessionRoomLabel(session)}</span>
                            </div>
                            <span className={statusClass(status)}>{attendanceStatusLabel(status)}</span>
                          </article>
                        );
                      })}
                    </div>
                    <ShowMoreOrPager
                      showingAll={attendanceExpand.showingAll}
                      hasMore={attendanceExpand.hasMore}
                      onShowAll={attendanceExpand.showAll}
                      paged={attendanceExpand.paged}
                      moreLabel="View full attendance history →"
                    />
                  </>
                )}
              </>
            )}

            {mobileSection === 'achievements' && (
              <>
                <div className="student-mobile-panel-heading">
                  <div>
                    <h3>Achievements</h3>
                    <p>Completed work shared with this student.</p>
                  </div>
                  <button type="button" className="btn btn--sm" disabled={!profile.recordId || reportClassOptions.length === 0} onClick={() => setAddingAccomplishment(true)}>Add</button>
                </div>
                {loadingAccomplishments ? (
                  <div className="student-mobile-loading" role="status">
                    <span className="student-mobile-loading__label">Loading achievements…</span>
                    <span className="skeleton skeleton--w-71" />
                    <span className="skeleton skeleton--w-56" />
                    <span className="skeleton skeleton--w-48" />
                  </div>
                ) : accomplishmentsLoadError ? (
                  <div className="student-mobile-load-error" role="alert">
                    <strong>Achievements could not be loaded</strong>
                    <span>Check the connection, then try again.</span>
                    <button type="button" className="btn btn--sm" onClick={() => void refreshAccomplishments()}>Try again</button>
                  </div>
                ) : accomplishments.length === 0 ? (
                  <div className="student-mobile-empty"><span className="student-mobile-empty__icon" aria-hidden="true"><IconAward /></span><strong>No achievements yet</strong><span>Record a milestone, project or award.</span></div>
                ) : (
                  <>
                    <div className="student-mobile-record-list">
                      {accomplishmentsExpand.visibleItems.map((item) => {
                        const needsReview = item.latestCorrection?.status === 'PENDING';
                        const pointsLabel = formatAccomplishmentPoints(item.points);
                        return (
                          <article key={item.id} className={`student-mobile-achievement-row${needsReview ? ' is-attention' : ''}`}>
                            <div className="student-mobile-achievement-row__top">
                              <strong>{item.title}</strong>
                              <span className={needsReview ? 'badge badge--warn' : accomplishmentStatusClass(item.status)}>
                                {needsReview ? 'Review needed' : accomplishmentStatusLabel(item.status)}
                              </span>
                            </div>
                            <p>{accomplishmentCategoryLabel(item.category)} · {item.classLabel}</p>
                            <div className="student-mobile-achievement-row__meta">
                              <time dateTime={item.achievementDate}>{formatSessionDateLabel(item.achievementDate)}</time>
                              {pointsLabel && <b>{pointsLabel}</b>}
                            </div>
                            {needsReview && item.latestCorrection && (
                              <div className="student-mobile-achievement-row__request">
                                <span>Student requested a change</span>
                                <p>{item.latestCorrection.message}</p>
                              </div>
                            )}
                            <div className="student-mobile-achievement-row__actions">
                              {needsReview && <button type="button" className="btn btn--primary btn--sm" onClick={() => setReviewingAccomplishment(item)}>Review change</button>}
                              {item.status === 'DRAFT' && <button type="button" className="btn btn--primary btn--sm" disabled={accomplishmentBusyId === item.id} onClick={() => void updateAccomplishmentStatus(item, 'confirm')}>Share with student</button>}
                              {item.status === 'CONFIRMED' && !needsReview && <button type="button" className="btn btn--quiet btn--sm" disabled={accomplishmentBusyId === item.id} onClick={() => void updateAccomplishmentStatus(item, 'revoke')}>Remove from student view</button>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <ShowMoreOrPager
                      showingAll={accomplishmentsExpand.showingAll}
                      hasMore={accomplishmentsExpand.hasMore}
                      onShowAll={accomplishmentsExpand.showAll}
                      paged={accomplishmentsExpand.paged}
                      moreLabel={`Show all ${accomplishments.length} achievements →`}
                    />
                  </>
                )}
              </>
            )}

            {mobileSection === 'more' && (
              <div className="student-mobile-more-sections">
                <section>
                  <div className="student-mobile-more-sections__heading"><IconGraduationCap /><h3>Enrolled classes</h3><span>{profileCourses.length}</span></div>
                  {profileCourses.length === 0 ? <p className="student-mobile-more-sections__empty">No current classes.</p> : profileCourses.map((course) => <div key={course} className="student-mobile-more-sections__row"><strong>{course}</strong></div>)}
                </section>
                <section>
                  <div className="student-mobile-more-sections__heading"><IconUser /><h3>Student details</h3></div>
                  <dl className="student-mobile-details">
                    <div><dt>Programme</dt><dd>{profile.program || 'Not provided'}</dd></div>
                    <div><dt>Level</dt><dd>{studentLevelLabel(profile.level)}</dd></div>
                    <div><dt>Email</dt><dd>{profile.email || 'Not provided'}</dd></div>
                    <div><dt>Seat</dt><dd>{profile.seat || 'Not assigned'}</dd></div>
                  </dl>
                </section>
                <section>
                  <div className="student-mobile-more-sections__heading"><IconClipboardCheck /><h3>Confirmed observations</h3><span>{confirmed.length}</span></div>
                  {confirmed.length === 0 ? (
                    <p className="student-mobile-more-sections__empty">No confirmed observations.</p>
                  ) : (
                    <>
                      {eventsExpand.visibleItems.map((event) => (
                        <article key={event.id} className="student-mobile-history-row">
                          <div><strong>{event.type}</strong><span>{eventSessionLabel(event, c.sessions)} · {event.start}</span></div>
                          <span className={statusClass(event.status)}>{event.status}</span>
                        </article>
                      ))}
                      <ShowMoreOrPager
                        showingAll={eventsExpand.showingAll}
                        hasMore={eventsExpand.hasMore}
                        onShowAll={eventsExpand.showAll}
                        paged={eventsExpand.paged}
                        moreLabel={`View all ${confirmed.length} observations →`}
                      />
                    </>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="profile-action-bar student-profile-desktop-only">
        <BackButton label="Back to students" onClick={() => {
          c.setProfileId(null);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }} />
        {/* Grouped together rather than "+ Add feedback" living down in the Progress Reports
            card — writing a note and then exporting the report are the same workflow, so the two
            actions that drive it belong next to each other. */}
        <div className="profile-action-bar__actions">
          <button
            type="button"
            className="btn btn--with-icon"
            disabled={!profile.recordId}
            onClick={() => setAddingFeedback(true)}
          >
            <IconMessageSquare /> Add feedback
          </button>
          <button
            type="button"
            className="btn btn--with-icon"
            disabled={!profile.recordId || reportClassOptions.length === 0}
            onClick={() => setAddingAccomplishment(true)}
          >
            <IconAward /> Add achievement
          </button>
          <button type="button" className="btn btn--with-icon" onClick={() => setPreparingReport(true)}>
            <IconClipboardCheck /> Export &amp; share
          </button>
        </div>
      </div>

      <section className="card dashboard-enter stagger-0 student-profile-desktop-only">
        <div className="card__body profile-hero">
          <PersonAvatar
            photoUrl={profile.registrationPhoto}
            name={profile.name}
            tone={avatarTone(profile.id, 0)}
            alt={`${profile.name} registration`}
            large
          />
          <div className="profile-hero__main">
            <div className="profile-hero__name row-inline">
              {profile.name}
              {profile.accountStatus === 'withdrawn' && (
                <span className="badge badge--neutral">Withdrawn</span>
              )}
            </div>
            {/* Programme/email live in the "Student information" card below — repeating them
                here too was pure duplication once that card existed. */}
            <div className="cell-sub profile-hero__sub">{profile.id}</div>
          </div>
          <div className="profile-hero__stats">
            <div>
              <div className="stat__label">Classes</div>
              <div className="profile-hero__metric">{profileCourses.length}</div>
            </div>
            <div>
              <div className="stat__label">Attendance</div>
              <div className="profile-hero__metric">{formatRate(profile.rate)}</div>
            </div>
            <div>
              <div className="stat__label">Reports</div>
              <div className="profile-hero__metric">{progressReports.length}</div>
            </div>
          </div>
          {isAdmin && profile.recordId && (
            <button
              type="button"
              className="btn"
              disabled={updatingStatus}
              onClick={() =>
                profile.accountStatus === 'active'
                  ? setConfirmingWithdraw(true)
                  : void reactivateStudent()
              }
            >
              {profile.accountStatus === 'active' ? 'Withdraw student' : 'Reactivate student'}
            </button>
          )}
        </div>
      </section>

      <div className="profile-attendance-grid student-profile-desktop-only">
        <section className="card profile-attendance-card dashboard-enter stagger-1">
          <div className="card__head profile-attendance-card__head">
            <div>
              <div className="card__title">Attendance summary</div>
              <div className="card__sub">Attendance across this student’s enrolled classes.</div>
            </div>
          </div>
          <div className="card__body profile-attendance-card__body">
            <AttendanceDonutChart
              attendance={attendanceBreakdown}
              emptyTitle="No attendance recorded yet."
              emptyHint="A breakdown will appear once this student has attended a classroom session."
            />
          </div>
        </section>

        <section className="card profile-absence-card dashboard-enter stagger-1" aria-label="Absence history">
          <div className="card__head profile-absence-card__head">
            <div>
              <div className="card__title">Absences</div>
              <div className="card__sub">Most recent missed sessions</div>
            </div>
            <span className="badge badge--neutral">{absences.length} total</span>
          </div>
          <div className="card__body profile-absence-card__body">
            {absences.length === 0 ? (
              <div className="profile-absence-card__empty">No absences recorded.</div>
            ) : (
              <>
                <div className="profile-absence-list">
                  {pagedAbsences.rows.map((session) => (
                    <article key={session.id} className="profile-absence-row">
                      <div>
                        <div className="cell-strong cell-strong--compact">{session.dateLabel}</div>
                        <div className="cell-sub">
                          {session.course} · {sessionRoomLabel(session)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {pagedAbsences.pageCount > 1 && (
                  <Pager
                    label={pagedAbsences.label}
                    page={pagedAbsences.page}
                    pageCount={pagedAbsences.pageCount}
                    canPrev={pagedAbsences.canPrev}
                    canNext={pagedAbsences.canNext}
                    onPrev={pagedAbsences.prev}
                    onNext={pagedAbsences.next}
                    onGoToPage={pagedAbsences.goToPage}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {confirmingWithdraw && (
        <Modal
          onClose={() => setConfirmingWithdraw(false)}
          size="confirm"
          role="alertdialog"
          titleId="confirm-withdraw-title"
          title="Withdraw this student?"
          subtitle="The student will lose system access and all active class enrolments will be marked as withdrawn. Historical records will be retained."
          footer={
            <>
              <button
                type="button"
                className="btn"
                disabled={updatingStatus}
                onClick={() => setConfirmingWithdraw(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={updatingStatus}
                onClick={() => void withdrawStudent()}
              >
                {updatingStatus ? 'Withdrawing…' : 'Withdraw student'}
              </button>
            </>
          }
        />
      )}

      {addingFeedback && profile.recordId && (
        <CreateFeedbackModal
          target="student"
          studentRecordId={profile.recordId}
          studentName={profile.name}
          saving={savingFeedback}
          onCreate={addFeedback}
          onClose={() => setAddingFeedback(false)}
        />
      )}

      {addingAccomplishment && profile.recordId && (
        <CreateAccomplishmentModal
          courseOptions={reportClassOptions.map((option) => ({ id: option.courseOfferingId, label: option.label }))}
          students={[profile]}
          initialStudentIds={[profile.recordId]}
          onClose={() => setAddingAccomplishment(false)}
          onCreated={async () => { await Promise.all([refreshAccomplishments(), c.refreshAccomplishments()]); }}
          showToast={c.showToast}
        />
      )}

      {reviewingAccomplishment && (
        <ReviewAccomplishmentCorrectionModal
          accomplishment={reviewingAccomplishment}
          onClose={() => setReviewingAccomplishment(null)}
          onReviewed={(updated) => {
            setAccomplishments((current) => current.map((item) => item.id === updated.id ? updated : item));
            c.updateAccomplishment(updated);
          }}
          showToast={c.showToast}
        />
      )}

      {shareSummaries && (
        <ExportShareModal summaries={shareSummaries} onClose={() => setShareSummaries(null)} onUpdated={refreshSummaries} showToast={c.showToast} />
      )}

      {preparingReport && (
        <PrepareFeedbackReportModal
          reports={progressReports}
          summaries={summaries}
          availableCourses={reportClassOptions.map((option) => ({
            id: option.courseOfferingId,
            label: option.label
          }))}
          dateFrom={c.dateFrom}
          dateTo={c.dateTo}
          onClose={() => setPreparingReport(false)}
          onUpdated={refreshSummaries}
          onContinue={(selection) => {
            setPrintReport(selection);
            setPreparingReport(false);
            setShareSummaries(selection.summaries);
          }}
          showToast={c.showToast}
        />
      )}

      <div className="grid-profile student-profile-desktop-only">
        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Student information</div>
              <div className="kv">
                <span className="kv__k">Student ID</span>
                <span className="kv__v">{profile.id}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Programme</span>
                <span className="kv__v">{profile.program || 'Not provided'}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Level</span>
                <span className="kv__v">{studentLevelLabel(profile.level)}</span>
              </div>
              <div className="kv">
                <span className="kv__k">University email</span>
                <span className="kv__v">{profile.email || 'Not provided'}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Assigned seat</span>
                <span className="kv__v">{profile.seat || 'Not assigned'}</span>
              </div>
            </div>
          </section>

          <section className="card dashboard-enter stagger-2">
            <div className="card__body">
              <div className="card__title card__title--spaced">Enrolled classes</div>
              <div className="card__sub">
                {profileCourses.length} enrolled class{profileCourses.length === 1 ? '' : 'es'}
              </div>
              {coursesExpand.visibleItems.map((course) => (
                <div key={course} className="kv">
                  <span className="kv__v">{course}</span>
                </div>
              ))}
              <ShowMoreOrPager
                showingAll={coursesExpand.showingAll}
                hasMore={coursesExpand.hasMore}
                onShowAll={coursesExpand.showAll}
                paged={coursesExpand.paged}
                moreLabel={`Show all ${profileCourses.length} classes →`}
              />
            </div>
          </section>
        </div>

        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Attendance history</div>
              {attendanceHistory.length === 0 ? (
                <div className="empty empty--compact">No attendance history yet.</div>
              ) : attendanceAllUnrecorded && !attendanceExpand.showingAll ? (
                <>
                  <div className="empty empty--compact">
                    No attendance has been recorded for this student yet.
                  </div>
                  <div className="cell-sub">
                    {attendanceHistory.length} classroom session
                    {attendanceHistory.length === 1 ? '' : 's'} found.
                  </div>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={attendanceExpand.showAll}
                  >
                    View session history →
                  </button>
                </>
              ) : (
                <>
                  {attendanceExpand.visibleItems.map((session) => {
                    const status = c.attendanceStatusFor(profile.id, session.id);
                    return (
                      <div key={session.id} className="kv kv--history">
                        <div>
                          <div className="cell-strong cell-strong--compact">{session.dateLabel}</div>
                          <div className="cell-sub">
                            {session.course} · {sessionRoomLabel(session)}
                          </div>
                        </div>
                        <span className={statusClass(status)}>{attendanceStatusLabel(status)}</span>
                      </div>
                    );
                  })}
                  <ShowMoreOrPager
                    showingAll={attendanceExpand.showingAll}
                    hasMore={attendanceExpand.hasMore}
                    onShowAll={attendanceExpand.showAll}
                    paged={attendanceExpand.paged}
                    moreLabel="View full attendance history →"
                  />
                </>
              )}
            </div>
          </section>

          <section className="card dashboard-enter stagger-2 feedback-source-card">
            <div className="card__body">
              <div className="card__title-line">
                <div className="card__title">Teacher feedback</div>
                <span className="cell-sub">
                  {progressReports.length} note{progressReports.length === 1 ? '' : 's'}
                </span>
              </div>
              {progressReports.length === 0 ? (
                <div className="empty empty--compact">
                  No feedback has been written for this student yet.
                </div>
              ) : (
                <>
                  {reportsExpand.visibleItems.map((report) => (
                    <div key={report.id} className="kv kv--history feedback-source-row">
                      {report.photoUrl && (
                        <img
                          src={report.photoUrl}
                          alt={`Feedback evidence for ${profile.name}`}
                          className="feedback-source-row__image"
                        />
                      )}
                      <div className="feedback-source-row__content">
                        <div className="cell-strong cell-strong--compact">{report.comment}</div>
                        <div className="cell-sub">
                          {report.teacherName} · {report.classLabel} · {formatDateTime(report.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <ShowMoreOrPager
                    showingAll={reportsExpand.showingAll}
                    hasMore={reportsExpand.hasMore}
                    onShowAll={reportsExpand.showAll}
                    paged={reportsExpand.paged}
                    moreLabel={`Show all ${progressReports.length} feedback notes →`}
                  />
                </>
              )}
            </div>
          </section>

          <section className="card dashboard-enter stagger-2 accomplishment-profile-card">
            <div className="card__body">
              <div className="achievement-profile-header">
                <div>
                  <div className="card__title">Achievements</div>
                  <div className="card__sub">Recognise work this student has completed. Shared achievements are visible to the student and can appear in reports.</div>
                </div>
                <div className="achievement-profile-summary" aria-label={`${accomplishments.length} achievements, ${achievementsNeedingReview} need review`}>
                  <span>
                    <strong>{accomplishments.length}</strong>
                    <small>Total</small>
                  </span>
                  <span className={achievementsNeedingReview > 0 ? 'is-attention' : ''}>
                    <strong>{achievementsNeedingReview}</strong>
                    <small>Need review</small>
                  </span>
                </div>
              </div>
              {accomplishments.length === 0 ? (
                <div className="empty empty--compact">No achievements have been recorded yet.</div>
              ) : (
                <>
                  {accomplishmentsExpand.visibleItems.map((item) => {
                    const needsReview = item.latestCorrection?.status === 'PENDING';
                    const pointsLabel = formatAccomplishmentPoints(item.points);
                    return (
                      <article key={item.id} className={`accomplishment-profile-row${needsReview ? ' accomplishment-profile-row--attention' : ''}`}>
                        <div className="accomplishment-profile-row__main">
                          <div className="accomplishment-profile-row__headline">
                            <strong>{item.title}</strong>
                            <span className={needsReview ? 'badge badge--warn' : accomplishmentStatusClass(item.status)}>
                              {needsReview ? 'Review needed' : accomplishmentStatusLabel(item.status)}
                            </span>
                          </div>
                          <div className="accomplishment-profile-row__meta">
                            <span>{accomplishmentCategoryLabel(item.category)}</span>
                            <span>{item.classLabel}</span>
                            <time dateTime={item.achievementDate}>{item.achievementDate}</time>
                            {pointsLabel && <b>{pointsLabel}</b>}
                          </div>
                          {!needsReview && item.acknowledgedAt && (
                            <span className="accomplishment-profile-row__student-state">Confirmed by student</span>
                          )}
                          {needsReview && item.latestCorrection && (
                            <div className="accomplishment-profile-row__request">
                              <strong>Student requested a change</strong>
                              <span>{item.latestCorrection.message}</span>
                            </div>
                          )}
                        </div>
                        <div className="accomplishment-profile-row__actions">
                          {needsReview && (
                            <button type="button" className="btn btn--primary btn--sm" onClick={() => setReviewingAccomplishment(item)}>Review change</button>
                          )}
                          {item.status === 'DRAFT' && (
                            <button type="button" className="btn btn--primary btn--sm" disabled={accomplishmentBusyId === item.id} onClick={() => void updateAccomplishmentStatus(item, 'confirm')}>Share with student</button>
                          )}
                          {item.status === 'CONFIRMED' && !needsReview && (
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              title="Remove this achievement from the student's view"
                              disabled={accomplishmentBusyId === item.id}
                              onClick={() => void updateAccomplishmentStatus(item, 'revoke')}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  <ShowMoreOrPager
                    showingAll={accomplishmentsExpand.showingAll}
                    hasMore={accomplishmentsExpand.hasMore}
                    onShowAll={accomplishmentsExpand.showAll}
                    paged={accomplishmentsExpand.paged}
                    moreLabel={`Show all ${accomplishments.length} achievements →`}
                  />
                </>
              )}
            </div>
          </section>

          <section className="card dashboard-enter stagger-3">
            <div className="card__body">
              <div className="card__title-line">
                <div className="card__title">Recent Confirmed Events</div>
                <span className="cell-sub">{confirmed.length}</span>
              </div>
              {confirmed.length === 0 ? (
                <div className="empty empty--compact">No confirmed events for this student.</div>
              ) : (
                <>
                  <div className="card__sub card__sub--events">
                    Teacher-confirmed or corrected observations only.
                  </div>
                  {eventsExpand.visibleItems.map((event) => (
                    <div key={event.id} className="kv kv--event">
                      <div>
                        <div className="cell-strong cell-strong--compact">{event.type}</div>
                        <div className="cell-sub">
                          {eventSessionLabel(event, c.sessions)} · {event.start} · {event.duration}
                        </div>
                      </div>
                      <span className={statusClass(event.status)}>{event.status}</span>
                    </div>
                  ))}
                  <ShowMoreOrPager
                    showingAll={eventsExpand.showingAll}
                    hasMore={eventsExpand.hasMore}
                    onShowAll={eventsExpand.showAll}
                    paged={eventsExpand.paged}
                    moreLabel={`View all ${confirmed.length} confirmed events →`}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <StudentReportPrint student={profile} report={printReport} accomplishments={accomplishments} console={c} />
    </div>
  );
}
