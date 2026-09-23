import { useRef, useState, type KeyboardEvent } from 'react';
import BackButton from '../../components/BackButton';
import {
  IconAward,
  IconBarChart,
  IconClipboardCheck,
  IconGraduationCap,
  IconMessageSquare,
  IconUser
} from '../../components/icons';
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
  statusClass,
  studentRateLabel,
  studentRateLabelClass
} from '../../lib/format';
import { formatSessionDateLabel } from '../../lib/sessionTime';
import { studentLevelLabel } from '../../lib/studentLevels';
import type { Accomplishment, AttendanceStatus, Session, Student } from '../../types';
import type { StudentProfileModel } from './studentProfileModel';
import type { StudentProfileRecords } from './useStudentProfileRecords';

type MobileProfileSection = 'feedback' | 'attendance' | 'achievements' | 'more';

interface Props {
  readonly student: Student;
  readonly sessions: Session[];
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
  readonly model: StudentProfileModel;
  readonly records: StudentProfileRecords;
  readonly onBack: () => void;
  readonly onAddFeedback: () => void;
  readonly onAddAccomplishment: () => void;
  readonly onPrepareReport: () => void;
  readonly onReviewAccomplishment: (accomplishment: Accomplishment) => void;
}

const SECTIONS: readonly MobileProfileSection[] = [
  'feedback',
  'attendance',
  'achievements',
  'more'
];

/** Responsive student profile presentation. Data loading and business rules stay in the feature
 * hook/model so this component owns only mobile navigation and rendering. */
export default function StudentProfileMobileView({
  student,
  sessions,
  attendanceStatusFor,
  model,
  records,
  onBack,
  onAddFeedback,
  onAddAccomplishment,
  onPrepareReport,
  onReviewAccomplishment
}: Props) {
  const [section, setSection] = useState<MobileProfileSection>('feedback');
  const recordRef = useRef<HTMLDivElement>(null);
  const reportsExpand = useExpandablePage(records.progressReports, 3);
  const attendanceExpand = useExpandablePage(model.attendanceHistory, 4);
  const accomplishmentsExpand = useExpandablePage(model.orderedAccomplishments, 3);
  const eventsExpand = useExpandablePage(model.confirmedEvents, 4);

  const openSection = (nextSection: MobileProfileSection) => {
    setSection(nextSection);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      recordRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      recordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${nextSection}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const handleSectionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentSection: MobileProfileSection
  ) => {
    const currentIndex = SECTIONS.indexOf(currentSection);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SECTIONS.length;
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = SECTIONS.length - 1;
    else return;

    event.preventDefault();
    const nextSection = SECTIONS[nextIndex];
    setSection(nextSection);
    window.requestAnimationFrame(() => {
      recordRef.current
        ?.querySelector<HTMLButtonElement>(`[data-mobile-section="${nextSection}"]`)
        ?.focus();
    });
  };

  return (
    <div className="student-profile-mobile-layout">
      <BackButton className="student-mobile-profile__back" label="All students" onClick={onBack} />

      <section className="student-mobile-profile__hero" aria-labelledby="student-mobile-profile-name">
        <div className="student-mobile-profile__identity">
          <PersonAvatar
            photoUrl={student.registrationPhoto}
            name={student.name}
            tone={avatarTone(student.id, 0)}
            alt={`${student.name} registration`}
            large
          />
          <div>
            <div className="student-mobile-profile__name-line">
              <h2 id="student-mobile-profile-name">{student.name}</h2>
              {student.accountStatus === 'withdrawn' && (
                <span className="badge badge--neutral">Withdrawn</span>
              )}
            </div>
            <p>{student.id} · {studentLevelLabel(student.level)}</p>
          </div>
        </div>
        <div className="student-mobile-profile__headline-stats">
          <div className="student-mobile-profile__rate">
            <strong>{model.hasRecordedAttendance ? formatRate(student.rate) : '—'}</strong>
            {student.rate === null || !model.hasRecordedAttendance ? (
              <span className="student-mobile-profile__rate-empty">
                {model.hasRecordedAttendance ? 'Unavailable' : 'Not recorded'}
              </span>
            ) : (
              <span className={studentRateLabelClass(student.rate)}>
                {studentRateLabel(student.rate)}
              </span>
            )}
          </div>
          <div className="student-mobile-profile__support-stat">
            <strong>{model.courses.length}</strong>
            <span>Classes</span>
          </div>
          <div className="student-mobile-profile__support-stat">
            <strong aria-label={records.loadingReports ? 'Loading feedback count' : undefined}>
              {records.loadingReports ? '—' : records.progressReports.length}
            </strong>
            <span>Feedback notes</span>
          </div>
        </div>
      </section>

      <section className="student-mobile-profile__actions" aria-label="Student actions">
        <button
          type="button"
          className="student-mobile-profile__primary-action"
          disabled={!student.recordId}
          onClick={onAddFeedback}
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
            disabled={!student.recordId || records.classOptions.length === 0}
            onClick={onAddAccomplishment}
          >
            <IconAward />
            <span>Add achievement</span>
          </button>
          <button type="button" onClick={onPrepareReport}>
            <IconClipboardCheck />
            <span>Export &amp; share</span>
          </button>
        </div>
      </section>

      {model.achievementsNeedingReview > 0 && (
        <button
          type="button"
          className="student-mobile-profile__review-alert"
          onClick={() => openSection('achievements')}
        >
          <span className="student-mobile-profile__review-count">
            {model.achievementsNeedingReview}
          </span>
          <span>
            <strong>
              Achievement change{model.achievementsNeedingReview === 1 ? '' : 's'}{' '}
              {model.achievementsNeedingReview === 1 ? 'needs' : 'need'} review
            </strong>
            <small>Open the student’s request before sharing.</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <section className="student-mobile-attendance" aria-labelledby="student-mobile-attendance-title">
        <div className="student-mobile-section-heading">
          <div>
            <span className="student-mobile-section-heading__icon" aria-hidden="true">
              <IconBarChart />
            </span>
            <div>
              <h3 id="student-mobile-attendance-title">Attendance at a glance</h3>
              <p>
                Across {model.attendanceBreakdown.total} session
                {model.attendanceBreakdown.total === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="student-mobile-attendance__coverage">
            <strong>
              {model.attendanceBreakdown.total - model.attendanceBreakdown.unknown}/
              {model.attendanceBreakdown.total}
            </strong>
            <span>recorded</span>
          </div>
        </div>
        <div className="student-mobile-attendance__distribution" aria-label="Attendance status totals">
          <div className="is-present"><span>Present</span><strong>{model.attendanceBreakdown.present}</strong></div>
          <div className="is-late"><span>Late</span><strong>{model.attendanceBreakdown.late}</strong></div>
          <div className="is-absent"><span>Absent</span><strong>{model.attendanceBreakdown.absent}</strong></div>
          <div className="is-unknown"><span>Not recorded</span><strong>{model.attendanceBreakdown.unknown}</strong></div>
        </div>
        {model.absences.length > 0 ? (
          <button
            type="button"
            className="student-mobile-attendance__absence-link"
            onClick={() => openSection('attendance')}
          >
            <span>
              <strong>
                {model.absences.length} absence{model.absences.length === 1 ? '' : 's'}
              </strong>
              <small>
                Latest: {model.absences[0]?.dateLabel} · {model.absences[0]?.course}
              </small>
            </span>
            <span aria-hidden="true">View history →</span>
          </button>
        ) : (
          <div className={`student-mobile-attendance__clear${model.hasRecordedAttendance ? '' : ' is-pending'}`}>
            {model.hasRecordedAttendance
              ? 'No absences recorded.'
              : 'Attendance has not been recorded yet.'}
          </div>
        )}
      </section>

      <div ref={recordRef} className="student-mobile-profile__record">
        <nav className="student-mobile-profile__tabs" aria-label="Student record sections" role="tablist">
          {([
            ['feedback', 'Feedback', records.loadingReports ? null : records.progressReports.length],
            ['attendance', 'Attendance', model.attendanceHistory.length],
            ['achievements', 'Achievements', records.loadingAccomplishments ? null : records.accomplishments.length],
            ['more', 'More', null]
          ] as const).map(([itemSection, label, count]) => (
            <button
              key={itemSection}
              type="button"
              id={`student-mobile-tab-${itemSection}`}
              data-mobile-section={itemSection}
              className={section === itemSection ? 'is-active' : ''}
              role="tab"
              aria-selected={section === itemSection}
              aria-controls="student-mobile-record-panel"
              tabIndex={section === itemSection ? 0 : -1}
              onClick={() => setSection(itemSection)}
              onKeyDown={(event) => handleSectionKeyDown(event, itemSection)}
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
          aria-labelledby={`student-mobile-tab-${section}`}
        >
          {section === 'feedback' && (
            <>
              <div className="student-mobile-panel-heading">
                <div>
                  <h3>Teacher feedback</h3>
                  <p>Notes already added to this student’s record.</p>
                </div>
                {!records.loadingReports && !records.reportsLoadError && records.progressReports.length > 0 && (
                  <button type="button" className="btn btn--sm" disabled={!student.recordId} onClick={onAddFeedback}>
                    Add note
                  </button>
                )}
              </div>
              {records.loadingReports ? (
                <div className="student-mobile-loading" role="status">
                  <span className="student-mobile-loading__label">Loading feedback…</span>
                  <span className="skeleton skeleton--w-80" />
                  <span className="skeleton skeleton--w-62" />
                  <span className="skeleton skeleton--w-48" />
                </div>
              ) : records.reportsLoadError ? (
                <div className="student-mobile-load-error" role="alert">
                  <strong>Feedback could not be loaded</strong>
                  <span>Check the connection, then try again.</span>
                  <button type="button" className="btn btn--sm" onClick={() => void records.refreshReports()}>
                    Try again
                  </button>
                </div>
              ) : records.progressReports.length === 0 ? (
                <div className="student-mobile-empty">
                  <span className="student-mobile-empty__icon" aria-hidden="true"><IconMessageSquare /></span>
                  <strong>No feedback yet</strong>
                  <span>Add the first note while the classroom context is still fresh.</span>
                  <button type="button" className="btn btn--primary btn--sm" disabled={!student.recordId} onClick={onAddFeedback}>
                    Add feedback
                  </button>
                </div>
              ) : (
                <>
                  <div className="student-mobile-record-list">
                    {reportsExpand.visibleItems.map((report) => (
                      <article key={report.id} className={`student-mobile-feedback-row${report.photoUrl ? ' has-image' : ''}`}>
                        {report.photoUrl && (
                          <img
                            src={report.photoUrl}
                            alt={`Feedback evidence for ${student.name}`}
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
                    moreLabel={`Show all ${records.progressReports.length} notes →`}
                  />
                </>
              )}
            </>
          )}

          {section === 'attendance' && (
            <>
              <div className="student-mobile-panel-heading">
                <div>
                  <h3>Attendance history</h3>
                  <p>Most recent classroom sessions first.</p>
                </div>
              </div>
              {model.attendanceHistory.length === 0 ? (
                <div className="student-mobile-empty">
                  <strong>No sessions yet</strong>
                  <span>Attendance will appear after the first class session.</span>
                </div>
              ) : (
                <>
                  <div className="student-mobile-record-list">
                    {attendanceExpand.visibleItems.map((item) => {
                      const status = attendanceStatusFor(student.id, item.id);
                      return (
                        <article key={item.id} className="student-mobile-history-row">
                          <div>
                            <strong>{item.dateLabel}</strong>
                            <span>{item.course} · {sessionRoomLabel(item)}</span>
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

          {section === 'achievements' && (
            <>
              <div className="student-mobile-panel-heading">
                <div>
                  <h3>Achievements</h3>
                  <p>Completed work shared with this student.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={!student.recordId || records.classOptions.length === 0}
                  onClick={onAddAccomplishment}
                >
                  Add
                </button>
              </div>
              {records.loadingAccomplishments ? (
                <div className="student-mobile-loading" role="status">
                  <span className="student-mobile-loading__label">Loading achievements…</span>
                  <span className="skeleton skeleton--w-71" />
                  <span className="skeleton skeleton--w-56" />
                  <span className="skeleton skeleton--w-48" />
                </div>
              ) : records.accomplishmentsLoadError ? (
                <div className="student-mobile-load-error" role="alert">
                  <strong>Achievements could not be loaded</strong>
                  <span>Check the connection, then try again.</span>
                  <button type="button" className="btn btn--sm" onClick={() => void records.refreshAccomplishments()}>
                    Try again
                  </button>
                </div>
              ) : records.accomplishments.length === 0 ? (
                <div className="student-mobile-empty">
                  <span className="student-mobile-empty__icon" aria-hidden="true"><IconAward /></span>
                  <strong>No achievements yet</strong>
                  <span>Record a milestone, project or award.</span>
                </div>
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
                            <time dateTime={item.achievementDate}>
                              {formatSessionDateLabel(item.achievementDate)}
                            </time>
                            {pointsLabel && <b>{pointsLabel}</b>}
                          </div>
                          {needsReview && item.latestCorrection && (
                            <div className="student-mobile-achievement-row__request">
                              <span>Student requested a change</span>
                              <p>{item.latestCorrection.message}</p>
                            </div>
                          )}
                          <div className="student-mobile-achievement-row__actions">
                            {needsReview && (
                              <button type="button" className="btn btn--primary btn--sm" onClick={() => onReviewAccomplishment(item)}>
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
                                disabled={records.accomplishmentBusyId === item.id}
                                onClick={() => void records.updateAccomplishmentStatus(item, 'revoke')}
                              >
                                Remove from student view
                              </button>
                            )}
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
                    moreLabel={`Show all ${records.accomplishments.length} achievements →`}
                  />
                </>
              )}
            </>
          )}

          {section === 'more' && (
            <div className="student-mobile-more-sections">
              <section>
                <div className="student-mobile-more-sections__heading">
                  <IconGraduationCap />
                  <h3>Enrolled classes</h3>
                  <span>{model.courses.length}</span>
                </div>
                {model.courses.length === 0 ? (
                  <p className="student-mobile-more-sections__empty">No current classes.</p>
                ) : model.courses.map((course) => (
                  <div key={course} className="student-mobile-more-sections__row">
                    <strong>{course}</strong>
                  </div>
                ))}
              </section>
              <section>
                <div className="student-mobile-more-sections__heading">
                  <IconUser />
                  <h3>Student details</h3>
                </div>
                <dl className="student-mobile-details">
                  <div><dt>Programme</dt><dd>{student.program || 'Not provided'}</dd></div>
                  <div><dt>Level</dt><dd>{studentLevelLabel(student.level)}</dd></div>
                  <div><dt>Email</dt><dd>{student.email || 'Not provided'}</dd></div>
                  <div><dt>Seat</dt><dd>{student.seat || 'Not assigned'}</dd></div>
                </dl>
              </section>
              <section>
                <div className="student-mobile-more-sections__heading">
                  <IconClipboardCheck />
                  <h3>Confirmed observations</h3>
                  <span>{model.confirmedEvents.length}</span>
                </div>
                {model.confirmedEvents.length === 0 ? (
                  <p className="student-mobile-more-sections__empty">No confirmed observations.</p>
                ) : (
                  <>
                    {eventsExpand.visibleItems.map((event) => (
                      <article key={event.id} className="student-mobile-history-row">
                        <div>
                          <strong>{event.type}</strong>
                          <span>{eventSessionLabel(event, sessions)} · {event.start}</span>
                        </div>
                        <span className={statusClass(event.status)}>{event.status}</span>
                      </article>
                    ))}
                    <ShowMoreOrPager
                      showingAll={eventsExpand.showingAll}
                      hasMore={eventsExpand.hasMore}
                      onShowAll={eventsExpand.showAll}
                      paged={eventsExpand.paged}
                      moreLabel={`View all ${model.confirmedEvents.length} observations →`}
                    />
                  </>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
