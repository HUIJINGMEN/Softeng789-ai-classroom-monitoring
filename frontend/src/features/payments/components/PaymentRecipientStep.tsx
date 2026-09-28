import usePaymentRecipientSearch from '../hooks/usePaymentRecipientSearch';
import { absoluteApiUrl } from '../../../lib/apiClient';
import { avatarTone } from '../../../lib/format';
import PersonAvatar from '../../../components/PersonAvatar';
import SearchField from '../../../components/SearchField';
import SelectionControl from '../../../components/SelectionControl';
import { IconX } from '../../../components/icons';
import {
  selectedStudentLabel,
  type PaymentRecipient,
  type SelectedStudents
} from '../paymentRequestDraft';

interface Props {
  readonly selected: SelectedStudents;
  readonly onSelected: (next: SelectedStudents) => void;
}

export default function PaymentRecipientStep({ selected, onSelected }: Props) {
  const { query, setQuery, results, loading, error } = usePaymentRecipientSearch();

  const toggle = (item: PaymentRecipient) => {
    const next = new Map(selected);
    if (next.has(item.student.id)) next.delete(item.student.id);
    else next.set(item.student.id, item);
    onSelected(next);
  };
  const selectedPreview = [...selected.values()].slice(0, 3);

  return (
    <section className="payment-create-step">
      <div className="payment-create-step__intro">
        <div>
          <h3>Choose students</h3>
          <p>Search the directory. Only selected students receive this request.</p>
        </div>
        <span className={selected.size > 0 ? 'has-selection' : ''}>
          {selected.size} selected
        </span>
      </div>
      <SearchField
        value={query}
        onChange={setQuery}
        label="Find students"
        placeholder="Name, student number or course"
      />
      {selected.size > 0 && (
        <div className="payment-recipient-chips" aria-label="Selected students">
          {selectedPreview.map((item) => (
            <button type="button" key={item.student.id} onClick={() => toggle(item)}>
              {selectedStudentLabel(item)} <IconX />
            </button>
          ))}
          {selected.size > selectedPreview.length && (
            <span>+{selected.size - selectedPreview.length} more selected</span>
          )}
          <button type="button" className="is-clear" onClick={() => onSelected(new Map())}>
            Clear
          </button>
        </div>
      )}
      <div className="payment-picker-directory">
        <div className="payment-picker-directory__head">
          <span>Student directory</span>
          <span>{loading ? 'Searching…' : `${results.length} shown`}</span>
        </div>
        <div className="payment-picker-list" aria-busy={loading}>
          {results.map((item, index) => {
            const checked = selected.has(item.student.id);
            const name = selectedStudentLabel(item);
            const photoUrl = item.student.registrationPhotoUrl
              ? absoluteApiUrl(item.student.registrationPhotoUrl, item.student.updatedAt)
              : null;
            return (
              <label key={item.student.id} className={checked ? 'is-selected' : ''}>
                <PersonAvatar
                  photoUrl={photoUrl}
                  name={name}
                  tone={avatarTone(item.student.id, index)}
                  alt=""
                />
                <span className="payment-picker-identity">
                  <strong>{name}</strong>
                  <small>{item.student.studentNumber} · {item.student.course}</small>
                </span>
                <SelectionControl
                  checked={checked}
                  label={`${checked ? 'Remove' : 'Select'} ${name}`}
                  onChange={() => toggle(item)}
                />
              </label>
            );
          })}
          {loading && <p className="payment-picker-message">Searching…</p>}
          {!loading && !error && results.length === 0 && (
            <p className="payment-picker-message">No matching students.</p>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}
