import SelectMenu from '../components/SelectMenu';
import type { DetectionSettings } from '../types';
import type { Console } from '../hooks/useConsole';

const SLIDERS: {
  key: 'headDown' | 'leaveSeat' | 'confidence';
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}[] = [
  {
    key: 'headDown',
    label: 'Head-down duration threshold',
    hint: 'Minimum continuous seconds before a head-down candidate event is created.',
    min: 10,
    max: 180,
    step: 5,
    format: (v) => `${v}s`
  },
  {
    key: 'leaveSeat',
    label: 'Leave-seat duration threshold',
    hint: 'Minimum seconds outside the assigned seat region.',
    min: 10,
    max: 300,
    step: 10,
    format: (v) => `${v}s`
  },
  {
    key: 'confidence',
    label: 'Detection confidence threshold',
    hint: 'Detections below this score are discarded before review.',
    min: 0.4,
    max: 0.95,
    step: 0.05,
    format: (v) => v.toFixed(2)
  }
];

const TOGGLES: { key: keyof DetectionSettings; label: string; hint: string }[] = [
  {
    key: 'requireConfirm',
    label: 'Require teacher confirmation',
    hint: 'No candidate event enters a report until a teacher confirms or corrects it.'
  },
  {
    key: 'saveEvidence',
    label: 'Save evidence images',
    hint: 'Store a single still frame per candidate event for review.'
  },
  {
    key: 'blurFaces',
    label: 'Blur faces in stored evidence',
    hint: 'Faces are obscured in saved stills; only posture remains visible.'
  },
  {
    key: 'notifyLive',
    label: 'Show notifications during live monitoring',
    hint: 'Display candidate events in the live panel as they are created.'
  }
];

const RETENTION_OPTIONS: { value: DetectionSettings['retention']; label: string }[] = [
  { value: '7 days', label: '7 days' },
  { value: '30 days', label: '30 days' },
  { value: '90 days', label: '90 days' },
  { value: '12 months', label: '12 months' }
];

const PRIVACY_OPTIONS: { value: DetectionSettings['privacy']; label: string }[] = [
  { value: 'Track ID only', label: 'Track ID only' },
  { value: 'Track ID + seat', label: 'Track ID + seat number' },
  { value: 'Student name', label: 'Student name (requires consent)' }
];

export default function Settings({ console: c }: { readonly console: Console }) {
  const update = <K extends keyof DetectionSettings>(key: K, value: DetectionSettings[K]) =>
    c.setSettings({ ...c.settings, [key]: value });

  return (
    <div className="page__inner page__inner--settings">
      <section className="card dashboard-enter stagger-0">
        <div className="card__body">
          <div className="card__title">Detection thresholds</div>
          <div className="card__sub card__sub--settings">
            Thresholds control when the system creates a candidate event for teacher review.
          </div>

          {SLIDERS.map((slider) => (
            <div key={slider.key} className="setting-row">
              <div className="setting-row__label">
                {slider.label}
                <div className="setting-row__hint">{slider.hint}</div>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={c.settings[slider.key]}
                onChange={(e) => update(slider.key, Number(e.target.value))}
              />
              <div className="setting-row__value">{slider.format(c.settings[slider.key])}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card dashboard-enter stagger-1">
        <div className="card__body">
          <div className="card__title card__title--settings">Review and evidence</div>
          {TOGGLES.map((toggle) => {
            const on = c.settings[toggle.key] as boolean;
            return (
              <div key={toggle.key} className="setting-row">
                <div className="setting-row__label">
                  {toggle.label}
                  <div className="setting-row__hint">{toggle.hint}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={toggle.label}
                  className={`switch${on ? ' switch--on' : ''}`}
                  onClick={() => update(toggle.key, !on as never)}
                >
                  <span className="switch__knob" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card dashboard-enter stagger-2">
        <div className="card__body">
          <div className="card__title card__title--settings">Data retention and privacy</div>

          <div className="setting-row">
            <div className="setting-row__label">
              Data-retention period
              <div className="setting-row__hint">
                Evidence images and event records are deleted automatically after this period.
              </div>
            </div>
            <SelectMenu
              className="setting-select setting-select--retention"
              value={c.settings.retention}
              options={RETENTION_OPTIONS}
              ariaLabel="Choose data retention period"
              align="right"
              onChange={(value) => update('retention', value)}
            />
          </div>

          <div className="setting-row">
            <div className="setting-row__label">
              Identity visibility in monitoring view
              <div className="setting-row__hint">
                Choose what the live view shows above each detected person.
              </div>
            </div>
            <SelectMenu
              className="setting-select setting-select--privacy"
              value={c.settings.privacy}
              options={PRIVACY_OPTIONS}
              ariaLabel="Choose identity visibility in monitoring view"
              align="right"
              onChange={(value) => update('privacy', value)}
            />
          </div>

          <div className="setting-row">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => c.showToast('Settings saved for this prototype session.')}
            >
              Save settings
            </button>
            <span className="setting-row__note">
              Changes are stored in the prototype session only.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
