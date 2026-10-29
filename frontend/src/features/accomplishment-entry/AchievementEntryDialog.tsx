import Modal from '../../components/Modal';
import { IconAward } from '../../components/icons';
import AchievementDetails from './AchievementDetails';
import AchievementRecipients from './AchievementRecipients';
import AchievementEntryFooter from './AchievementEntryFooter';
import { useAchievementEntry, type AchievementEntryProps } from './useAchievementEntry';

export default function AchievementEntryDialog(props: AchievementEntryProps) {
  const entry = useAchievementEntry(props);
  const { saving, onClose, fixedRecipient, fixedRecipientName, step, recipientStepLabel, error } = entry;
  return (
    <Modal
      onClose={saving ? () => undefined : onClose}
      size="wide"
      className={`accomplishment-modal${fixedRecipient ? ' accomplishment-modal--single' : ''}`}
      titleId="create-accomplishment-title"
      title={
        <span className="accomplishment-modal__title">
          <span aria-hidden="true">
            <IconAward />
          </span>
          <span>Add an achievement</span>
        </span>
      }
      compactTitle
      closeButton
      subtitle={
        fixedRecipient
          ? `Record completed work for ${fixedRecipientName}.`
          : 'Record completed work, then choose the students who earned it.'
      }
      onSubmit={entry.handleSubmit}
      footer={<AchievementEntryFooter entry={entry} />}
    >
      {!fixedRecipient && (
        <div className="accomplishment-modal__steps" aria-label="Progress">
          <span className={step === 1 ? 'is-active' : 'is-complete'}>
            <b>1</b>
            <span>
              <small>Achievement details</small>
              <em>{step === 1 ? 'Current step' : 'Completed'}</em>
            </span>
          </span>
          <i aria-hidden="true" />
          <span className={step === 2 ? 'is-active' : ''}>
            <b>2</b>
            <span>
              <small>{recipientStepLabel}</small>
              <em>{step === 2 ? 'Current step' : 'Next'}</em>
            </span>
          </span>
        </div>
      )}

      {step === 1 ? <AchievementDetails entry={entry} /> : <AchievementRecipients entry={entry} />}

      {error && (
        <div className="form-error accomplishment-modal__error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
