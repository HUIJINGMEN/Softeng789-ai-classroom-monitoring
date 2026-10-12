import { useMemo, useState } from 'react';
import {
  updateClassBillingPlan,
  type ClassApiResponse,
  type ClassBillingPlan
} from '../../../lib/classAdminApi';
import { apiMessage } from '../../../lib/apiClient';
import { IconWallet } from '../../../components/icons';
import { formatMoney, formatPaymentDate } from '../format';
import type { Session } from '../../../types';
import {
  BILLING_MODES,
  BILLING_SUMMARY_TITLES,
  classBillingSummaryFacts,
  classScheduleSummary,
  createClassBillingDraft,
  isClassBillingDraftValid,
  toClassBillingPlanUpdate,
  type ClassBillingDraft
} from '../classBillingPlanModel';

interface Props {
  readonly klass: ClassApiResponse;
  readonly sessions: readonly Session[];
  readonly onChanged: () => void;
  readonly onIssuePayment: () => void;
}

export default function ClassBillingSetup({ klass, sessions, onChanged, onIssuePayment }: Props) {
  const plan = klass.billingPlan;
  const initialDraft = createClassBillingDraft(plan);
  const [displayPlan, setDisplayPlan] = useState<ClassBillingPlan>(plan);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClassBillingDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const schedule = useMemo(() => classScheduleSummary(sessions), [sessions]);

  const resetDraft = (nextPlan: ClassBillingPlan) => {
    setDraft(createClassBillingDraft(nextPlan));
    setDirty(false);
    setError('');
  };

  const startEditing = () => {
    resetDraft(displayPlan);
    setSaved(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    resetDraft(displayPlan);
    setSaved(false);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await updateClassBillingPlan(klass.id, toClassBillingPlanUpdate(draft));
      setDisplayPlan(updated.billingPlan);
      setSaved(true);
      setDirty(false);
      setEditing(false);
      onChanged();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const valid = isClassBillingDraftValid(draft);

  const change = <K extends keyof ClassBillingDraft>(key: K, value: ClassBillingDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const selectedMode = BILLING_MODES.find((option) => option.mode === displayPlan.purchaseMode) ?? BILLING_MODES[0];
  const priceLabel = displayPlan.defaultPrice === null
    ? 'Set per invoice'
    : formatMoney(displayPlan.defaultPrice, displayPlan.currency);
  const priceDetail = displayPlan.defaultPrice === null
    ? 'No default price'
    : displayPlan.purchaseMode === 'COURSE_ENROLMENT'
      ? 'For the complete course.'
      : displayPlan.purchaseMode === 'LESSON_PACKAGE'
        ? 'For the default lesson package.'
        : displayPlan.purchaseMode === 'MEMBERSHIP'
          ? 'For each billing period.'
          : 'For one scheduled lesson.';

  const summaryFacts = classBillingSummaryFacts(displayPlan, schedule);

  if (!editing) {
    return (
      <section className="class-billing-setup class-billing-setup--summary">
        <header className="class-billing-setup__head">
          <div>
            <h2>Billing</h2>
            <p>Set how this class is sold. Student invoices are reviewed and sent from the invoice workspace.</p>
          </div>
          <div className="class-billing-setup__actions">
            <button type="button" className="btn" onClick={startEditing}>Edit billing setup</button>
            <button type="button" className="btn btn--primary" onClick={onIssuePayment}>Prepare student invoice</button>
          </div>
        </header>

        <div className="class-billing-summary">
          <div className="class-billing-summary__identity">
            <div className="class-billing-summary__icon" aria-hidden="true"><IconWallet /></div>
            <div className="class-billing-summary__intro">
              <h3>{BILLING_SUMMARY_TITLES[displayPlan.purchaseMode]}</h3>
              <p>{selectedMode.description}</p>
            </div>
            <div className="class-billing-summary__identity-foot">
              <span>Changes apply to future invoice drafts only.</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Default price</dt>
              <dd>{priceLabel}</dd>
              <small>{priceDetail}</small>
            </div>
            {summaryFacts.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
                <small>{item.detail}</small>
              </div>
            ))}
          </dl>
        </div>

        {saved && <output className="notice notice--success">Billing setup saved. New invoice drafts will use these terms.</output>}
      </section>
    );
  }

  return (
    <section className="class-billing-setup class-billing-setup--editing">
      <header className="class-billing-setup__head">
        <div>
          <h2>Billing setup</h2>
          <p>Choose how students pay for this class. Only settings for that choice are shown.</p>
        </div>
      </header>

      <fieldset className="class-billing-mode">
        <legend>How do students pay for this class?</legend>
        <div>
          {BILLING_MODES.map((option) => (
            <label key={option.mode} className={draft.mode === option.mode ? 'is-selected' : ''}>
              <input
                type="radio"
                name={`billing-mode-${klass.id}`}
                value={option.mode}
                checked={draft.mode === option.mode}
                onChange={() => change('mode', option.mode)}
              />
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="class-billing-defaults">
        <header>
          <h3>Set the defaults</h3>
          <p>{BILLING_MODES.find((option) => option.mode === draft.mode)?.title}. You can still adjust these details on an individual invoice draft.</p>
        </header>
        <div className="class-billing-config">
          <label className="field">
            <span>Default price (NZD) <small>Optional</small></span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={draft.price}
              onChange={(event) => change('price', event.target.value)}
              placeholder="Set when preparing an invoice"
            />
          </label>

          {draft.mode === 'COURSE_ENROLMENT' && (
            <div className="class-billing-schedule">
              <span>Coverage from timetable</span>
              <strong>{schedule.count > 0 ? `${schedule.count} scheduled lesson${schedule.count === 1 ? '' : 's'}` : 'No lessons scheduled yet'}</strong>
              <small>{schedule.from && schedule.to ? `${formatPaymentDate(schedule.from)} – ${formatPaymentDate(schedule.to)}` : 'Dates will update automatically when the timetable is built.'}</small>
            </div>
          )}

          {draft.mode === 'LESSON_PACKAGE' && (
            <>
              <label className="field">
                <span>Default lessons <small>Required</small></span>
                <input type="number" min="1" max="500" value={draft.sessionCount} onChange={(event) => change('sessionCount', event.target.value)} />
              </label>
              <label className="field">
                <span>Default validity <small>Optional</small></span>
                <div className="field-with-suffix">
                  <input type="number" min="1" max="3650" value={draft.validityDays} onChange={(event) => change('validityDays', event.target.value)} placeholder="Use timetable dates" />
                  <span>days</span>
                </div>
              </label>
              <fieldset className="class-billing-rule class-billing-rule--wide">
                <legend>If the student is absent</legend>
                <div>
                  <label className={draft.absencePolicy === 'CONSUME_UNEXCUSED' ? 'is-selected' : ''}>
                    <input type="radio" name={`absence-${klass.id}`} checked={draft.absencePolicy === 'CONSUME_UNEXCUSED'} onChange={() => change('absencePolicy', 'CONSUME_UNEXCUSED')} />
                    <span><strong>Deduct one lesson</strong><small>An admin can waive it for approved leave.</small></span>
                  </label>
                  <label className={draft.absencePolicy === 'ATTENDANCE_ONLY' ? 'is-selected' : ''}>
                    <input type="radio" name={`absence-${klass.id}`} checked={draft.absencePolicy === 'ATTENDANCE_ONLY'} onChange={() => change('absencePolicy', 'ATTENDANCE_ONLY')} />
                    <span><strong>Keep the lesson</strong><small>Only attendance reduces the balance.</small></span>
                  </label>
                </div>
              </fieldset>
            </>
          )}

          {draft.mode === 'MEMBERSHIP' && (
            <>
              <label className="field">
                <span>Membership period <small>Required</small></span>
                <select value={draft.membershipInterval} onChange={(event) => change('membershipInterval', event.target.value as ClassBillingDraft['membershipInterval'])}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="TERM">Per term</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </label>
              <label className="field">
                <span>Lessons per period <small>Optional</small></span>
                <input type="number" min="1" max="500" value={draft.sessionsPerPeriod} onChange={(event) => change('sessionsPerPeriod', event.target.value)} placeholder="Unlimited" />
              </label>
            </>
          )}

          {draft.mode === 'PAY_PER_LESSON' && (
            <fieldset className="class-billing-rule class-billing-rule--wide">
              <legend>Default charging basis</legend>
              <div>
                <label className={draft.payTrigger === 'BOOKING' ? 'is-selected' : ''}>
                  <input type="radio" name={`pay-trigger-${klass.id}`} checked={draft.payTrigger === 'BOOKING'} onChange={() => change('payTrigger', 'BOOKING')} />
                  <span><strong>Use booking</strong><small>Reference the student's booked lesson.</small></span>
                </label>
                <label className={draft.payTrigger === 'ATTENDANCE' ? 'is-selected' : ''}>
                  <input type="radio" name={`pay-trigger-${klass.id}`} checked={draft.payTrigger === 'ATTENDANCE'} onChange={() => change('payTrigger', 'ATTENDANCE')} />
                  <span><strong>Use attendance</strong><small>Reference the lesson recorded as attended.</small></span>
                </label>
              </div>
            </fieldset>
          )}
        </div>
      </section>

      {(error || saved) && (
        <output className={`notice ${error ? 'notice--warn' : 'notice--success'}`}>
          {error || 'Billing setup saved. Future invoice drafts will use this purchase type.'}
        </output>
      )}

      <footer className="class-billing-setup__foot">
        <span>Changes apply to future purchases. Existing student purchases keep their original terms.</span>
        <button type="button" className="btn" onClick={cancelEditing}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={saving || !valid || !dirty} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </footer>
    </section>
  );
}
