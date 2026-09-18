import { IconArrowRight, IconBarChart } from '../icons';

export type ComparisonTone = 'ahead' | 'aligned' | 'behind' | 'unavailable';

interface Comparison {
  readonly tone: ComparisonTone;
  readonly title: string;
  readonly message: string;
  readonly difference: number | null;
}

interface Props {
  readonly studentRate: number;
  readonly studentMarks: number;
  readonly averageRate: number | null | undefined;
  readonly benchmarkMarks: number;
  readonly benchmarkStudents: number;
  readonly scopeLabel: string;
  readonly featured?: boolean;
  readonly onOpenAttendance?: () => void;
}

function attendanceComparison(
  studentRate: number,
  studentMarks: number,
  classAverage: number | null | undefined
): Comparison {
  if (studentMarks === 0 || classAverage === null || classAverage === undefined) {
    return {
      tone: 'unavailable',
      title: 'Class comparison is not available yet.',
      message: 'It will appear once both you and your class have attendance records.',
      difference: null
    };
  }

  const difference = studentRate - classAverage;
  if (difference > 0) {
    return {
      tone: 'ahead',
      title: `You’re ${difference} points above your class average.`,
      message: 'Great consistency—keep building on this attendance pattern.',
      difference
    };
  }
  if (difference < 0) {
    return {
      tone: 'behind',
      title: `You’re ${Math.abs(difference)} points below your class average.`,
      message: 'A few more attended sessions can help close the gap. Ask your teacher if you need support.',
      difference
    };
  }
  return {
    tone: 'aligned',
    title: 'You’re right on your class average.',
    message: 'Nice and steady—keep this rhythm going.',
    difference
  };
}

function differenceLabel(difference: number | null) {
  if (difference === null) return '—';
  const prefix = difference > 0 ? '+' : '';
  return `${prefix}${difference} pts`;
}

function momentumLabel(tone: ComparisonTone) {
  if (tone === 'ahead') return 'Ahead of average';
  if (tone === 'aligned') return 'On average';
  if (tone === 'behind') return 'Below average';
  return 'Getting started';
}

export function MomentumFace({ tone }: { readonly tone: ComparisonTone }) {
  const face = {
    ahead: {
      eyes: 'M34 48c2.5 3 6.5 3 9 0M53 48c2.5 3 6.5 3 9 0',
      brows: '',
      mouth: 'M35 57c6.5 8 19.5 8 26 0',
      accent: 'M71 27v8M67 31h8M79 36v5M76.5 38.5h5'
    },
    aligned: {
      eyes: 'M34 48c2.5-3 6.5-3 9 0M53 48c2.5-3 6.5-3 9 0',
      brows: '',
      mouth: 'M38 58c5 5.5 15 5.5 20 0',
      accent: 'M73 29v6M70 32h6'
    },
    behind: {
      eyes: 'M37 50h.01M59 50h.01',
      brows: 'M33 43l8-4M55 39l8 4',
      mouth: 'M39 63c4.5-5 13.5-5 18 0',
      accent: 'M72 28v8M78 31l-4 6M81 40l-7 3'
    },
    unavailable: {
      eyes: 'M38 49h.01M58 49h.01',
      brows: '',
      mouth: 'M42 61h12',
      accent: 'M72 32h.01M78 32h.01M84 32h.01'
    }
  }[tone];
  const fillId = `student-momentum-face-fill-${tone}`;

  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={momentumLabel(tone)}>
      <defs>
        <radialGradient id={fillId} cx="34%" cy="28%" r="78%">
          <stop className="student-momentum__face-fill-highlight" offset="0" />
          <stop className="student-momentum__face-fill-mid" offset="0.64" />
          <stop className="student-momentum__face-fill-edge" offset="1" />
        </radialGradient>
      </defs>
      <rect className="student-momentum__face-frame" x="8" y="8" width="80" height="80" rx="24" />
      <ellipse className="student-momentum__face-shadow" cx="48" cy="74" rx="22" ry="5" />
      <circle className="student-momentum__face-orb" cx="48" cy="51" r="25" fill={`url(#${fillId})`} />
      <g className="student-momentum__face-cheeks">
        <circle cx="31.5" cy="57" r="4" />
        <circle cx="64.5" cy="57" r="4" />
      </g>
      {face.brows && <path className="student-momentum__face-brows" d={face.brows} />}
      <path className="student-momentum__face-eyes" d={face.eyes} />
      <path className="student-momentum__face-mouth" d={face.mouth} />
      <path className="student-momentum__face-accent" d={face.accent} />
    </svg>
  );
}

function ParticipationBars({
  studentRate,
  studentMarks,
  averageRate
}: {
  readonly studentRate: number;
  readonly studentMarks: number;
  readonly averageRate: number | null | undefined;
}) {
  const studentValue = studentMarks > 0 ? Math.min(100, Math.max(0, Math.round(studentRate))) : null;
  const averageValue = averageRate === null || averageRate === undefined
    ? null
    : Math.min(100, Math.max(0, Math.round(averageRate)));
  const chartLabel = `Your participation ${studentValue === null ? 'not available' : `${studentValue} percent`}; class average ${averageValue === null ? 'not available' : `${averageValue} percent`}.`;

  const bars = [
    { key: 'student', label: 'You', value: studentValue },
    { key: 'average', label: 'Average', value: averageValue }
  ] as const;

  return (
    <div className="student-momentum__bars" role="img" aria-label={chartLabel}>
      <span className="student-momentum__bars-title">Participation</span>
      <div className="student-momentum__bars-plot" aria-hidden="true">
        {bars.map((bar) => (
          <div className={`student-momentum__bar-column student-momentum__bar-column--${bar.key}`} key={bar.key}>
            <strong>{bar.value === null ? '—' : `${bar.value}%`}</strong>
            <span className="student-momentum__bar-scale">
              <span
                className="student-momentum__bar"
                style={{ height: `${bar.value === null ? 0 : Math.max(5, bar.value)}%` }}
              />
            </span>
            <small>{bar.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ParticipationComparisonCard({
  studentRate,
  studentMarks,
  averageRate,
  benchmarkMarks,
  benchmarkStudents,
  scopeLabel,
  featured = false,
  onOpenAttendance
}: Props) {
  const comparison = attendanceComparison(studentRate, studentMarks, averageRate);
  const titleId = featured ? 'student-overview-comparison-title' : 'student-attendance-comparison-title';

  if (featured) {
    return (
      <section
        className={`student-comparison student-comparison--${comparison.tone} student-comparison--featured`}
        aria-labelledby={titleId}
      >
        <div className="student-momentum__story">
          <div className={`student-momentum__expression student-momentum__expression--${comparison.tone}`}>
            <MomentumFace tone={comparison.tone} />
          </div>
          <div className="student-momentum__copy">
            <span className="student-momentum__status"><IconBarChart />{momentumLabel(comparison.tone)}</span>
            <h2 id={titleId}>{comparison.title}</h2>
            <p>{comparison.message}</p>
          </div>
          <ParticipationBars studentRate={studentRate} studentMarks={studentMarks} averageRate={averageRate} />
        </div>

        <div className="student-momentum__footer">
          {benchmarkMarks > 0 ? (
            <span>
              Based on {benchmarkMarks} attendance mark{benchmarkMarks === 1 ? '' : 's'} across{' '}
              {benchmarkStudents} student{benchmarkStudents === 1 ? '' : 's'}.
            </span>
          ) : (
            <span>Your comparison will become more useful as attendance is recorded.</span>
          )}
          {onOpenAttendance && (
            <button type="button" onClick={onOpenAttendance}>
              View attendance <IconArrowRight />
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`student-comparison student-comparison--${comparison.tone}${featured ? ' student-comparison--featured' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="student-comparison__copy">
        <div className="student-comparison__heading">
          <span className="student-comparison__icon" aria-hidden="true"><IconBarChart /></span>
          <div>
            <h2 id={titleId}>{featured ? 'Your attendance momentum' : 'Participation comparison'}</h2>
            <p>{scopeLabel} · Present and Late count as participation</p>
          </div>
        </div>
        <strong className="student-comparison__message">{comparison.title}</strong>
        <p className="student-comparison__guidance">{comparison.message}</p>
        {benchmarkMarks > 0 && (
          <span className="student-comparison__sample">
            Based on {benchmarkMarks} attendance mark{benchmarkMarks === 1 ? '' : 's'} across{' '}
            {benchmarkStudents} student{benchmarkStudents === 1 ? '' : 's'}.
          </span>
        )}
      </div>

      <div className="student-comparison__visual" aria-label="Your participation compared with your class average">
        <div className="student-comparison__bar-row">
          <div className="student-comparison__bar-label">
            <span>You</span>
            <strong>{studentMarks > 0 ? `${studentRate}%` : '—'}</strong>
          </div>
          <div className="student-comparison__track" aria-hidden="true">
            <span
              className="student-comparison__fill student-comparison__fill--student"
              style={{ width: `${studentMarks > 0 ? studentRate : 0}%` }}
            />
          </div>
        </div>
        <div className="student-comparison__bar-row">
          <div className="student-comparison__bar-label">
            <span>Class average</span>
            <strong>{averageRate === null || averageRate === undefined ? '—' : `${averageRate}%`}</strong>
          </div>
          <div className="student-comparison__track" aria-hidden="true">
            <span
              className="student-comparison__fill student-comparison__fill--class"
              style={{ width: `${averageRate ?? 0}%` }}
            />
          </div>
        </div>
        <div className="student-comparison__difference">
          <span>Difference</span>
          <strong>{differenceLabel(comparison.difference)}</strong>
        </div>
      </div>
    </section>
  );
}
