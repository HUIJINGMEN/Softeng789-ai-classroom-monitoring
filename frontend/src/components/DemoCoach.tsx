import type { DemoStep } from '../hooks/useConsole';

interface Props {
  step: number;
  steps: DemoStep[];
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}

export default function DemoCoach({ step, steps, onNext, onPrev, onExit }: Props) {
  if (step === 0) return null;
  const current = steps[step - 1];
  const isLast = step === steps.length;

  return (
    <div className="coach">
      <div className="coach__rail">
        <div className="coach__fill" style={{ width: `${(step / steps.length) * 100}%` }} />
      </div>
      <div className="coach__body">
        <div className="coach__meta">
          <span className="coach__eyebrow">Guided walkthrough</span>
          <span className="mono coach__counter">
            {step} / {steps.length}
          </span>
        </div>
        <div className="coach__title">{current.title}</div>
        <div className="coach__tip">{current.tip}</div>
        <div className="coach__actions">
          <button type="button" className="btn btn--primary" onClick={onNext}>
            {isLast ? 'Finish' : 'Next step'}
          </button>
          <button type="button" className="btn" disabled={step <= 1} onClick={onPrev}>
            Back
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn--quiet" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
