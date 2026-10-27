import type { AchievementEntryState } from './useAchievementEntry';

interface Props {
  readonly entry: AchievementEntryState;
}

export default function AchievementEntryFooter({ entry }: Props) {
  const {
    fixedRecipient,
    saving,
    detailsValid,
    save,
    step,
    onClose,
    nextStepLabel,
    setStep,
    selectedSummary,
    entries,
    saveDraftLabel,
    shareLabel
  } = entry;
  if (fixedRecipient)
    return (
      <>
        <button
          type="button"
          className="btn"
          disabled={saving || !detailsValid}
          onClick={() => void save(false)}
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving || !detailsValid}>
          {saving ? 'Sharing…' : 'Share with student'}
        </button>
      </>
    );
  if (step === 1)
    return (
      <>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!detailsValid}>
          {nextStepLabel}
        </button>
      </>
    );
  return (
    <>
      <button type="button" className="btn" disabled={saving} onClick={() => setStep(1)}>
        Back
      </button>
      <span className="accomplishment-modal__footer-count">{selectedSummary}</span>
      <button
        type="button"
        className="btn"
        disabled={saving || entries.length === 0}
        onClick={() => void save(false)}
      >
        {saving ? 'Saving…' : saveDraftLabel}
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={saving || entries.length === 0}
        onClick={() => void save(true)}
      >
        {saving ? 'Sharing…' : shareLabel}
      </button>
    </>
  );
}
