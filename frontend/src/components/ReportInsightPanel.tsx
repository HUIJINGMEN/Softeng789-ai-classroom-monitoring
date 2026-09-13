import type { ReportInsight } from '../types';

interface Props {
  readonly insight: ReportInsight | null;
  readonly loading: boolean;
  readonly error: string;
  readonly onRetry: () => void;
  readonly onGenerate: () => void;
  readonly disabled?: boolean;
}

export default function ReportInsightPanel({ insight, loading, error, onRetry, onGenerate, disabled = false }: Props) {
  return (
    <section className="card dashboard-enter stagger-2 report-insight">
      <div className="card__body">
        <div className="card__title-line">
          <div>
            <div className="card__title">AI feedback summary</div>
            <div className="card__sub">Generate a concise view from teacher feedback in this report range.</div>
          </div>
          <div className="report-insight__actions">
            {insight?.provider === 'DEMO' && <span className="badge badge--neutral">Demo AI</span>}
            {insight && (
              <button type="button" className="btn btn--sm" disabled={disabled || loading} onClick={onGenerate}>
                Regenerate
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="report-insight__loading" role="status">
            <span />
            <span />
            <span />
          </div>
        ) : error ? (
          <div className="report-insight__empty">
            <p>{error}</p>
            <button type="button" className="btn btn--sm" disabled={disabled || loading} onClick={onRetry}>Try again</button>
          </div>
        ) : insight ? (
          <div className="report-insight__content">
            <div className="report-insight__lead">
              <span>Overview</span>
              <p>{insight.summary}</p>
            </div>
            <div className="report-insight__support">
              <div><span>Strengths</span><p>{insight.strengths}</p></div>
              <div><span>Next steps</span><p>{insight.nextSteps}</p></div>
            </div>
            <div className="report-insight__meta">
              Based on {insight.sourceFeedbackCount} teacher feedback note{insight.sourceFeedbackCount === 1 ? '' : 's'}
            </div>
          </div>
        ) : (
          <div className="report-insight__empty report-insight__empty--ready">
            <p>The summary is optional. Attendance and confirmed observations can still be exported without it.</p>
            <button type="button" className="btn btn--sm" disabled={disabled || loading} onClick={onGenerate}>
              Generate summary
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
