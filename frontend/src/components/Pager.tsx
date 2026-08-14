interface Props {
  label: string;
  pageLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function Pager({ label, pageLabel, canPrev, canNext, onPrev, onNext }: Props) {
  return (
    <div className="pager">
      <div>{label}</div>
      <div className="spacer" />
      <div className="mono">{pageLabel}</div>
      <button type="button" className="btn btn--sm" disabled={!canPrev} onClick={onPrev}>
        Previous
      </button>
      <button type="button" className="btn btn--sm" disabled={!canNext} onClick={onNext}>
        Next
      </button>
    </div>
  );
}
