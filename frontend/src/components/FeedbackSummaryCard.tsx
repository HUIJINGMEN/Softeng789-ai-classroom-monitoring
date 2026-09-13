import { useEffect, useState } from 'react';
import { formatDateTime } from '../lib/format';
import { formatReportDateRange } from '../lib/sessionTime';
import type { FeedbackSummary } from '../types';

interface Props {
  readonly item: FeedbackSummary;
  readonly busy?: boolean;
  readonly onReview?: (payload: Pick<FeedbackSummary, 'summary' | 'strengths' | 'nextSteps'>) => void;
  readonly onShare?: () => void;
  readonly onOpenStudent?: () => void;
}

export default function FeedbackSummaryCard({ item, busy, onReview, onShare, onOpenStudent }: Props) {
  const [summary, setSummary] = useState(item.summary);
  const [strengths, setStrengths] = useState(item.strengths);
  const [nextSteps, setNextSteps] = useState(item.nextSteps);
  useEffect(() => { setSummary(item.summary); setStrengths(item.strengths); setNextSteps(item.nextSteps); }, [item]);
  const reviewed = item.status === 'REVIEWED';
  const title = onOpenStudent ? item.studentName : item.classLabel;
  const detail = onOpenStudent
    ? `${item.classLabel} · ${formatReportDateRange(item.dateFrom, item.dateTo)}`
    : formatReportDateRange(item.dateFrom, item.dateTo);

  return (
    <article className={`feedback-summary-card${reviewed ? ' feedback-summary-card--reviewed' : ''}`}>
      <div className="feedback-summary-card__head">
        <div>
          {onOpenStudent ? <button type="button" className="feedback-summary-card__student" onClick={onOpenStudent}>{title}</button> : <strong>{title}</strong>}
          <div className="cell-sub">{detail}</div>
        </div>
        <div className="row-inline">
          {item.provider === 'DEMO' && <span className="badge badge--neutral">Demo AI</span>}
          <span className={reviewed ? 'badge badge--success' : 'badge badge--warn'}>{reviewed ? 'Reviewed' : 'Needs review'}</span>
        </div>
      </div>
      {reviewed ? (
        <div className="feedback-summary-card__content">
          <div className="feedback-summary-card__summary"><span>Progress summary</span><p>{item.summary}</p></div>
          <div><span>Strengths</span><p>{item.strengths}</p></div>
          <div><span>Next steps</span><p>{item.nextSteps}</p></div>
        </div>
      ) : (
        <div className="feedback-summary-card__editor">
          <label className="field">Progress summary<textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
          <div className="grid-2">
            <label className="field">Strengths<textarea rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
            <label className="field">Next steps<textarea rows={3} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} /></label>
          </div>
        </div>
      )}
      <div className="feedback-summary-card__foot">
        <span className="cell-sub">
          {reviewed && `Reviewed by ${item.reviewedByTeacherName ?? item.createdByTeacherName} · `}
          Based on {item.sourceFeedbackCount} feedback note{item.sourceFeedbackCount === 1 ? '' : 's'} · Created {formatDateTime(item.createdAt)}
        </span>
        <span className="spacer" />
        {!reviewed && onReview && <button type="button" className="btn btn--primary btn--sm" disabled={busy || !summary.trim() || !strengths.trim() || !nextSteps.trim()} onClick={() => onReview({ summary: summary.trim(), strengths: strengths.trim(), nextSteps: nextSteps.trim() })}>{busy ? 'Saving…' : 'Review & approve'}</button>}
        {reviewed && onShare && <button type="button" className="btn btn--sm" onClick={onShare}>Export &amp; share</button>}
      </div>
    </article>
  );
}
