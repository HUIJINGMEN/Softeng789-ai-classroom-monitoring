import { useState } from 'react';
import AttendanceDonutChart from '../../components/AttendanceDonutChart';
import BackButton from '../../components/BackButton';
import { IconAward, IconClipboardCheck, IconMessageSquare } from '../../components/icons';
import Pager from '../../components/Pager';
import PersonAvatar from '../../components/PersonAvatar';
import ShowMoreOrPager from '../../components/ShowMoreOrPager';
import { useExpandablePage } from '../../hooks/useExpandablePage';
import {
  accomplishmentCategoryLabel,
  accomplishmentStatusClass,
  accomplishmentStatusLabel,
  formatAccomplishmentPoints
} from '../../lib/accomplishments';
import { sessionRoomLabel } from '../../lib/classroomApi';
import { eventSessionLabel } from '../../lib/eventDisplay';
import {
  attendanceStatusLabel,
  avatarTone,
  formatDateTime,
  formatRate,
  statusClass
} from '../../lib/format';
import { studentLevelLabel } from '../../lib/studentLevels';
import { usePagination } from '../../lib/table';
import type { Accomplishment, AttendanceStatus, Session, Student } from '../../types';
import type { StudentProfileModel } from './studentProfileModel';
import type { StudentProfileRecords } from './useStudentProfileRecords';

interface Props {
  readonly student: Student;
  readonly sessions: Session[];
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
  readonly model: StudentProfileModel;
  readonly records: StudentProfileRecords;
  readonly isAdmin: boolean;
  readonly updatingStatus: boolean;
  readonly onBack: () => void;
  readonly onAddFeedback: () => void;
  readonly onAddAccomplishment: () => void;
  readonly onPrepareReport: () => void;
  readonly onToggleStudentStatus: () => void;
  readonly onReviewAccomplishment: (accomplishment: Accomplishment) => void;
}

/** Desktop presentation for the student profile. It owns view-only pagination and expansion state;
 * mutations and shared business rules remain in the feature hook/model. */
export default function StudentProfileDesktopView({
  student,
  sessions,
  attendanceStatusFor,
  model,
  records,
  isAdmin,
  updatingStatus,
  onBack,
  onAddFeedback,
  onAddAccomplishment,
  onPrepareReport,
  onToggleStudentStatus,
  onReviewAccomplishment
}: Props) {
  const coursesExpand = useExpandablePage(model.courses, 3);
  const attendanceExpand = useExpandablePage(model.attendanceHistory, 4);
  const eventsExpand = useExpandablePage(model.confirmedEvents, 4);
  const reportsExpand = useExpandablePage(records.progressReports, 3);
  const accomplishmentsExpand = useExpandablePage(model.orderedAccomplishments, 3);
  const [absencesPage, setAbsencesPage] = useState(0);
  const pagedAbsences = usePagination(model.absences, absencesPage, setAbsencesPage, 4);

  return (
    <>
      <div className="profile-action-bar student-profile-desktop-only">
        <BackButton label="Back to students" onClick={onBack} />
        <div className="profile-action-bar__actions">
          <button
            type="button"
            className="btn btn--with-icon"
            disabled={!student.recordId}
            onClick={onAddFeedback}
          >
            <IconMessageSquare /> Add feedback
          </button>
          <button
            type="button"
            className="btn btn--with-icon"
            disabled={!student.recordId || records.classOptions.length === 0}
            onClick={onAddAccomplishment}
          >
            <IconAward /> Add achievement
          </button>
          <button type="button" className="btn btn--with-icon" onClick={onPrepareReport}>
            <IconClipboardCheck /> Export &amp; share
          </button>
        </div>
      </div>

      <section className="card dashboard-enter stagger-0 student-profile-desktop-only">
        <div className="card__body profile-hero">
          <PersonAvatar
            photoUrl={student.registrationPhoto}
            name={student.name}
            tone={avatarTone(student.id, 0)}
            alt={`${student.name} registration`}
            large
          />
          <div className="profile-hero__main">
            <div className="profile-hero__name row-inline">
              {student.name}
              {student.accountStatus === 'withdrawn' && (
                <span className="badge badge--neutral">Withdrawn</span>
              )}
            </div>
            <div className="cell-sub profile-hero__sub">{student.id}</div>
          </div>
          <div className="profile-hero__stats">
            <div>
              <div className="stat__label">Classes</div>
              <div className="profile-hero__metric">{model.courses.length}</div>
            </div>
            <div>
              <div className="stat__label">Attendance</div>
              <div className="profile-hero__metric">{formatRate(student.rate)}</div>
            </div>
            <div>
              <div className="stat__label">Reports</div>
              <div className="profile-hero__metric">{records.progressReports.length}</div>
            </div>
          </div>
          {isAdmin && student.recordId && (
            <button
              type="button"
              className="btn"
              disabled={updatingStatus}
              onClick={onToggleStudentStatus}
            >
              {student.accountStatus === 'active' ? 'Withdraw student' : 'Reactivate student'}
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
              attendance={model.attendanceBreakdown}
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
            <span className="badge badge--neutral">{model.absences.length} total</span>
          </div>
          <div className="card__body profile-absence-card__body">
            {model.absences.length === 0 ? (
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

      <div className="grid-profile student-profile-desktop-only">
        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Student information</div>
              <div className="kv">
                <span className="kv__k">Student ID</span>
                <span className="kv__v">{student.id}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Programme</span>
                <span className="kv__v">{student.program || 'Not provided'}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Level</span>
                <span className="kv__v">{studentLevelLabel(student.level)}</span>
              </div>
              <div className="kv">
                <span className="kv__k">University email</span>
                <span className="kv__v">{student.email || 'Not provided'}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Assigned seat</span>
                <span className="kv__v">{student.seat || 'Not assigned'}</span>
              </div>
            </div>
          </section>

          <section className="card dashboard-enter stagger-2">
            <div className="card__body">
              <div className="card__title card__title--spaced">Enrolled classes</div>
              <div className="card__sub">
                {model.courses.length} enrolled class{model.courses.length === 1 ? '' : 'es'}
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
                moreLabel={`Show all ${model.courses.length} classes →`}
              />
            </div>
          </section>
        </div>

        <div className="profile-column">
          <section className="card dashboard-enter stagger-1">
            <div className="card__body">
              <div className="card__title card__title--spaced">Attendance history</div>
              {model.attendanceHistory.length === 0 ? (
                <div className="empty empty--compact">No attendance history yet.</div>
              ) : model.attendanceAllUnrecorded && !attendanceExpand.showingAll ? (
                <>
                  <div className="empty empty--compact">
                    No attendance has been recorded for this student yet.
                  </div>
                  <div className="cell-sub">
                    {model.attendanceHistory.length} classroom session
                    {model.attendanceHistory.length === 1 ? '' : 's'} found.
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
                    const status = attendanceStatusFor(student.id, session.id);
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
                  {records.progressReports.length} note
                  {records.progressReports.length === 1 ? '' : 's'}
                </span>
              </div>
              {records.progressReports.length === 0 ? (
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
                          alt={`Feedback evidence for ${student.name}`}
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
                    moreLabel={`Show all ${records.progressReports.length} feedback notes →`}
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
                  <div className="card__sub">
                    Recognise work this student has completed. Shared achievements are visible to
                    the student and can appear in reports.
                  </div>
                </div>
                <div
                  className="achievement-profile-summary"
                  aria-label={`${records.accomplishments.length} achievements, ${model.achievementsNeedingReview} need review`}
                >
                  <span>
                    <strong>{records.accomplishments.length}</strong>
                    <small>Total</small>
                  </span>
                  <span className={model.achievementsNeedingReview > 0 ? 'is-attention' : ''}>
                    <strong>{model.achievementsNeedingReview}</strong>
                    <small>Need review</small>
                  </span>
                </div>
              </div>
              {records.accomplishments.length === 0 ? (
                <div className="empty empty--compact">No achievements have been recorded yet.</div>
              ) : (
                <>
                  {accomplishmentsExpand.visibleItems.map((item) => {
                    const needsReview = item.latestCorrection?.status === 'PENDING';
                    const pointsLabel = formatAccomplishmentPoints(item.points);
                    return (
                      <article
                        key={item.id}
                        className={`accomplishment-profile-row${needsReview ? ' accomplishment-profile-row--attention' : ''}`}
                      >
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
                            <span className="accomplishment-profile-row__student-state">
                              Confirmed by student
                            </span>
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
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => onReviewAccomplishment(item)}
                            >
                              Review change
                            </button>
                          )}
                          {item.status === 'DRAFT' && (
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={records.accomplishmentBusyId === item.id}
                              onClick={() => void records.updateAccomplishmentStatus(item, 'confirm')}
                            >
                              Share with student
                            </button>
                          )}
                          {item.status === 'CONFIRMED' && !needsReview && (
                            <button
                              type="button"
                              className="btn btn--quiet btn--sm"
                              title="Remove this achievement from the student's view"
                              disabled={records.accomplishmentBusyId === item.id}
                              onClick={() => void records.updateAccomplishmentStatus(item, 'revoke')}
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
                    moreLabel={`Show all ${records.accomplishments.length} achievements →`}
                  />
                </>
              )}
            </div>
          </section>

          <section className="card dashboard-enter stagger-3">
            <div className="card__body">
              <div className="card__title-line">
                <div className="card__title">Recent Confirmed Events</div>
                <span className="cell-sub">{model.confirmedEvents.length}</span>
              </div>
              {model.confirmedEvents.length === 0 ? (
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
                          {eventSessionLabel(event, sessions)} · {event.start} · {event.duration}
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
                    moreLabel={`View all ${model.confirmedEvents.length} confirmed events →`}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
