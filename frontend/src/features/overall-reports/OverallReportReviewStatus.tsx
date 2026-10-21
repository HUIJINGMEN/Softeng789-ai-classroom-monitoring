interface Props {
  readonly reviewed: number;
  readonly total: number;
  readonly status: string;
}

/** Presentation only: approval and persistence stay in the shared review hook. */
export function OverallReportReviewStatus({ reviewed, total, status }: Props) {
  return (
    <div
      className="overall-report-review-status"
      data-complete={total > 0 && reviewed === total}
    >
      <div aria-live="polite">
        <strong>{reviewed} of {total} reviewed</strong>
        <span>{status}</span>
      </div>
      <progress
        aria-label="Summary review progress"
        value={reviewed}
        max={Math.max(total, 1)}
      />
    </div>
  );
}
