import { useCallback, useEffect, useMemo, useState } from 'react';
import AttendanceDonutChart from '../components/AttendanceDonutChart';
import CreateFeedbackModal from '../components/CreateFeedbackModal';
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
import { attendanceStatusLabel, avatarTone, formatDateTime, formatRate, statusClass } from '../lib/format';
import { createProgressReport, listProgressReportsForStudent } from '../lib/progressReportApi';
import { listFeedbackSummaries } from '../lib/feedbackSummaryApi';
import { listMyClassOptions } from '../lib/healthIncidentApi';
import { studentCourses } from '../lib/studentCourses';
import { studentLevelLabel } from '../lib/studentLevels';
import { usePagination } from '../lib/table';
import { updateStudentAccountStatus } from '../lib/studentApi';
import type { Console } from '../hooks/useConsole';
import type { FeedbackSummary, HealthClassOption, ProgressReport, Student } from '../types';

interface Props {
  readonly profile: Student;
  readonly console: Console;
  readonly isAdmin: boolean;
}

// Rendered with `key={profile.id}` by the caller, so React fully remounts this component (and
// resets all the useState below) whenever the admin looks at a different student — no manual
// "reset on profile change" effect needed here.
export default function StudentProfile({ profile, console: c, isAdmin }: Props) {
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
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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

  const absences = attendanceHistory.filter(
    (session) => c.attendanceStatusFor(profile.id, session.id) === 'Absent'
  );
  const [absencesPage, setAbsencesPage] = useState(0);
  const pagedAbsences = usePagination(absences, absencesPage, setAbsencesPage, 5);

  // Reports come from two places — the companion mobile app (photo + comment) and this page's own
  // "+ Add feedback" (text only) — fetched here rather than through useConsole since nothing else
  // in the console needs a cross-student view of them.
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [summaries, setSummaries] = useState<FeedbackSummary[]>([]);
  const [reportClassOptions, setReportClassOptions] = useState<HealthClassOption[]>([]);
  const [preparingReport, setPreparingReport] = useState(false);
  const [shareSummaries, setShareSummaries] = useState<FeedbackSummary[] | null>(null);
  const [printReport, setPrintReport] = useState<StudentReportSelection | null>(null);

  const refreshReports = useCallback(() => {
    if (!profile.recordId) return Promise.resolve();
    return listProgressReportsForStudent(profile.recordId)
      .then(setProgressReports)
      .catch((error) => c.showToast(apiMessage(error)));
  }, [profile.recordId, c.showToast]);

  const refreshSummaries = useCallback(() => {
    if (!profile.recordId) return Promise.resolve();
    return listFeedbackSummaries(profile.recordId)
      .then(setSummaries)
      .catch((error) => c.showToast(apiMessage(error)));
  }, [profile.recordId, c.showToast]);

  useEffect(() => {
    void refreshReports();
    void refreshSummaries();
  }, [refreshReports, refreshSummaries]);

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

  return (
    <div className="page__inner">
      <div className="profile-action-bar">
        <button type="button" className="btn page-action" onClick={() => c.setProfileId(null)}>
          ← Back to all students
        </button>
        {/* Grouped together rather than "+ Add feedback" living down in the Progress Reports
            card — writing a note and then exporting the report are the same workflow, so the two
            actions that drive it belong next to each other. */}
        <div className="profile-action-bar__actions">
          <button
            type="button"
            className="btn"
            disabled={!profile.recordId}
            onClick={() => setAddingFeedback(true)}
          >
            + Add feedback
          </button>
          <button type="button" className="btn" onClick={() => setPreparingReport(true)}>
            Export &amp; share
          </button>
        </div>
      </div>

      <section className="card dashboard-enter stagger-0">
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

      <section className="card dashboard-enter stagger-1">
        <div className="card__body">
          <div className="card__title card__title--spaced">Attendance Summary</div>
          <div className="profile-attendance-summary profile-attendance-summary--student">
            <div className="profile-attendance-summary__chart">
              <AttendanceDonutChart
                attendance={attendanceBreakdown}
                emptyTitle="No attendance recorded yet."
                emptyHint="A breakdown will appear once this student has attended a classroom session."
              />
            </div>
            <section className="profile-attendance-summary__absences profile-absence-history" aria-label="Absence history">
              <div className="profile-absence-history__head">
                <div className="profile-absence-history__title">Absences</div>
                <span className="badge badge--neutral">{absences.length} total</span>
              </div>
              {absences.length === 0 ? (
                <div className="empty empty--compact">No absences recorded.</div>
              ) : (
                <>
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
            </section>
          </div>
        </div>
      </section>

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

      <div className="grid-profile">
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

      <StudentReportPrint student={profile} report={printReport} console={c} />
    </div>
  );
}
