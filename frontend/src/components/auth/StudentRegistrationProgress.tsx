interface Props {
  readonly currentStep: 1 | 2;
  readonly compact?: boolean;
}

const STEPS = [
  { number: 1, title: 'Account & classes' },
  { number: 2, title: 'Face enrolment' }
] as const;

function getStepStateLabel(complete: boolean, active: boolean): string {
  if (complete) return 'Complete';
  if (active) return 'Current step';
  return 'Next';
}

export default function StudentRegistrationProgress({ currentStep, compact = false }: Props) {
  return (
    <nav
      className={`registration-progress${compact ? ' registration-progress--compact' : ''}`}
      aria-label="Student registration progress"
    >
      <div className="registration-progress__meta">
        <span>Student registration</span>
        <strong>Step {currentStep} of {STEPS.length}</strong>
      </div>

      <div className="registration-progress__bar" aria-hidden="true">
        <span style={{ width: `${(currentStep / STEPS.length) * 100}%` }} />
      </div>

      <ol className="registration-steps">
        {STEPS.map((step) => {
          const complete = step.number < currentStep;
          const active = step.number === currentStep;
          const stateLabel = getStepStateLabel(complete, active);

          return (
            <li
              key={step.number}
              className={`registration-step${active ? ' registration-step--active' : ''}${
                complete ? ' registration-step--complete' : ''
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="registration-step__number" aria-hidden="true">
                {step.number}
              </span>
              <span className="registration-step__copy">
                <strong>{step.title}</strong>
                <small>{stateLabel}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
