import {
  IconAward,
  IconClipboardCheck,
  IconGraduationCap,
  IconMessageSquare,
  IconUser
} from '../../components/icons';
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
import { attendanceStatusLabel, formatDateTime, statusClass } from '../../lib/format';
import { formatSessionDateLabel } from '../../lib/sessionTime';
import { studentLevelLabel } from '../../lib/studentLevels';
import type { Accomplishment, AttendanceStatus, Session, Student } from '../../types';
import type { StudentProfileModel } from './studentProfileModel';
import type { StudentProfileRecords } from './useStudentProfileRecords';

interface FeedbackProps {
  readonly student: Student;
  readonly records: StudentProfileRecords;
  readonly onAddFeedback: () => void;
}

function FeedbackBody({ student, records, onAddFeedback }: FeedbackProps) {
  const reportsExpand = useExpandablePage(records.progressReports, 3);

  if (records.loadingReports) {
    return (
      <output className="student-mobile-loading">
        <span className="student-mobile-loading__label">Loading feedback…</span>
        <span className="skeleton skeleton--w-80" />
        <span className="skeleton skeleton--w-62" />
        <span className="skeleton skeleton--w-48" />
      </output>
    );
  }

  if (records.reportsLoadError) {
    return (
      <div className="student-mobile-load-error" role="alert">
        <strong>Feedback could not be loaded</strong>
        <span>Check the connection, then try again.</span>
        <button type="button" className="btn btn--sm" onClick={() => void records.refreshReports()}>
          Try again
        </button>
      </div>
    );
  }

  if (records.progressReports.length === 0) {
    return (
      <div className="student-mobile-empty">
        <span className="student-mobile-empty__icon" aria-hidden="true"><IconMessageSquare /></span>
        <strong>No feedback yet</strong>
        <span>Add the first note while the classroom context is still fresh.</span>
        <button type="button" className="btn btn--primary btn--sm" disabled={!student.recordId} onClick={onAddFeedback}>
          Add feedback
        </button>
      </div>
    );
  }

  return (
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
  );
}

export function MobileFeedbackSection(props: FeedbackProps) {
  const { student, records, onAddFeedback } = props;
  return (
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
      <FeedbackBody {...props} />
    </>
  );
}

interface AttendanceProps {
  readonly student: Student;
  readonly model: StudentProfileModel;
  readonly attendanceStatusFor: (studentId: string, sessionId: string) => AttendanceStatus;
}

export function MobileAttendanceSection({ student, model, attendanceStatusFor }: AttendanceProps) {
  const attendanceExpand = useExpandablePage(model.attendanceHistory, 4);
  return (
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
  );
}

interface AchievementsProps {
  readonly student: Student;
  readonly model: StudentProfileModel;
  readonly records: StudentProfileRecords;
  readonly onAddAccomplishment: () => void;
  readonly onReviewAccomplishment: (accomplishment: Accomplishment) => void;
}

function AchievementList({ model, records, onReviewAccomplishment }: Omit<AchievementsProps, 'student' | 'onAddAccomplishment'>) {
  const accomplishmentsExpand = useExpandablePage(model.orderedAccomplishments, 3);

  if (records.loadingAccomplishments) {
    return (
      <output className="student-mobile-loading">
        <span className="student-mobile-loading__label">Loading achievements…</span>
        <span className="skeleton skeleton--w-71" />
        <span className="skeleton skeleton--w-56" />
        <span className="skeleton skeleton--w-48" />
      </output>
    );
  }

  if (records.accomplishmentsLoadError) {
    return (
      <div className="student-mobile-load-error" role="alert">
        <strong>Achievements could not be loaded</strong>
        <span>Check the connection, then try again.</span>
        <button type="button" className="btn btn--sm" onClick={() => void records.refreshAccomplishments()}>
          Try again
        </button>
      </div>
    );
  }

  if (records.accomplishments.length === 0) {
    return (
      <div className="student-mobile-empty">
        <span className="student-mobile-empty__icon" aria-hidden="true"><IconAward /></span>
        <strong>No achievements yet</strong>
        <span>Record a milestone, project or award.</span>
      </div>
    );
  }

  return (
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
  );
}

export function MobileAchievementsSection(props: AchievementsProps) {
  const { student, records, onAddAccomplishment } = props;
  return (
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
      <AchievementList {...props} />
    </>
  );
}

interface MoreProps {
  readonly model: StudentProfileModel;
  readonly sessions: Session[];
  readonly student: Student;
}

export function MobileMoreSection({ model, sessions, student }: MoreProps) {
  const eventsExpand = useExpandablePage(model.confirmedEvents, 4);
  return (
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
          <div key={course} className="student-mobile-more-sections__row"><strong>{course}</strong></div>
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
  );
}
