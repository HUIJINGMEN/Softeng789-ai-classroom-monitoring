import { IconGraduationCap, IconPlus } from '../../components/icons';
import Pager from '../../components/Pager';
import { formatDateTime } from '../../lib/format';
import type { ClassReportWorkspace } from './useClassReportWorkspace';

interface Props {
  readonly workspace: ClassReportWorkspace;
}

function ClassFeedbackContent({ workspace }: Props) {
  if (workspace.feedbackLoading && workspace.classFeedback.length === 0) {
    return <output className="class-feedback-card__status">Loading class feedback…</output>;
  }

  if (workspace.classFeedbackInRange.length === 0 && !workspace.feedbackError) {
    return (
      <div className="class-feedback-card__empty">
        <div>
          <strong>No feedback in this period</strong>
          <p>Add a class-wide note when there is something useful to include in the AI summary.</p>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--with-icon"
          onClick={() => workspace.setAddingFeedback(true)}
        >
          <IconPlus /> Add feedback
        </button>
      </div>
    );
  }

  return (
    <div className="report-feedback-list">
      {workspace.pagedClassFeedback.rows.map((item) => (
        <article key={item.id} className="report-feedback-row">
          <div>
            <strong>{item.teacherName}</strong>
            <span>{formatDateTime(item.createdAt)}</span>
          </div>
          <p>{item.comment}</p>
        </article>
      ))}
    </div>
  );
}

export default function ClassFeedbackPanel({ workspace }: Props) {
  return (
    <section className="card report-list-card class-feedback-card dashboard-enter stagger-2">
      <div className="card__head">
        <div className="card__title-row">
          <span className="icon-inline icon-inline--title" aria-hidden="true">
            <IconGraduationCap />
          </span>
          <div>
            <div className="card__title">Class feedback</div>
            <div className="card__sub">
              Original class-wide notes remain visible here and inform class and overall AI summaries.
            </div>
          </div>
        </div>
        <span className="report-list-card__count">
          {workspace.classFeedbackInRange.length} in range
        </span>
      </div>

      {workspace.feedbackError && (
        <div className="notice notice--warn" role="alert">
          <span className="notice__mark" aria-hidden="true" />
          <span>{workspace.feedbackError}</span>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => void workspace.loadClassFeedback()}
          >
            Retry
          </button>
        </div>
      )}

      <ClassFeedbackContent workspace={workspace} />

      {workspace.classFeedbackInRange.length > 0 && (
        <Pager
          label={workspace.pagedClassFeedback.label}
          page={workspace.pagedClassFeedback.page}
          pageCount={workspace.pagedClassFeedback.pageCount}
          canPrev={workspace.pagedClassFeedback.canPrev}
          canNext={workspace.pagedClassFeedback.canNext}
          onPrev={workspace.pagedClassFeedback.prev}
          onNext={workspace.pagedClassFeedback.next}
          onGoToPage={workspace.pagedClassFeedback.goToPage}
        />
      )}
    </section>
  );
}
