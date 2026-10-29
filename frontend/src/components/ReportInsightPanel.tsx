import type { ReportInsight } from '../types';

interface Props {
  readonly insight: ReportInsight | null;
  readonly loading: boolean;
  readonly error: string;
  readonly onRetry: () => void;
  readonly onGenerate: () => void;
  readonly disabled?: boolean;
}

export default function ReportInsightPanel({
  insight,
  loading,
  error,
  onRetry,
  onGenerate,
  disabled = false
}: Props) {
  const readyToGenerate = !loading && !error && !insight;
  const generateLabel = insight ? 'Regenerate' : 'Generate summary';

  return (
    <section
      className={
        readyToGenerate
          ? 'card dashboard-enter stagger-2 report-insight report-insight--ready'
          : 'card dashboard-enter stagger-2 report-insight'
      }
      aria-busy={loading}
    >
      <div className="card__head report-insight__head">
        <div>
          <div className="card__title">AI feedback summary</div>
          <div className="card__sub">
            Optional. Generate a concise view from teacher feedback in this report range.
          </div>
        </div>
        <div className="report-insight__actions">
          {insight?.provider === 'DEMO' && <span className="badge badge--neutral">Demo AI</span>}
          {readyToGenerate && <span className="report-insight__state">Not generated</span>}
          {!error && (
            <button
              type="button"
              className={insight ? 'btn btn--sm' : 'btn btn--sm btn--primary'}
              disabled={disabled || loading}
              onClick={onGenerate}
            >
              {loading ? 'Generating…' : generateLabel}
            </button>
          )}
        </div>
      </div>

      {!readyToGenerate && (
        <div className="card__body">
          <ReportInsightBody
            insight={insight}
            loading={loading}
            error={error}
            onRetry={onRetry}
            disabled={disabled}
          />
        </div>
      )}
    </section>
  );
}

function ReportInsightBody({ insight, loading, error, onRetry, disabled }: Omit<Props, 'onGenerate'>) {
  if (loading)
    return (
      <output className="report-insight__loading">
        <span />
        <span />
        <span />
      </output>
    );
  if (error)
    return (
      <div className="report-insight__empty">
        <p>{error}</p>
        <button type="button" className="btn btn--sm" disabled={disabled || loading} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  if (!insight) return null;
  return (
    <div className="report-insight__content">
      <div className="report-insight__lead">
        <span>Overview</span>
        <p>{insight.summary}</p>
      </div>
      <div className="report-insight__support">
        <div>
          <span>Strengths</span>
          <p>{insight.strengths}</p>
        </div>
        <div>
          <span>Next steps</span>
          <p>{insight.nextSteps}</p>
        </div>
      </div>
      <div className="report-insight__meta">
        Based on {insight.sourceFeedbackCount} teacher feedback note
        {insight.sourceFeedbackCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}
