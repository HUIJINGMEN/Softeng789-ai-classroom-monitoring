import type { LineItemType } from '../api';
import { formatMoney } from '../format';
import { formatIsoDateInAuckland } from '../../../lib/sessionTime';
import { IconPlus, IconX } from '../../../components/icons';
import { calculateDraftTotal, createDraftLine, type DraftLine } from '../paymentRequestDraft';

interface Props {
  readonly title: string;
  readonly dueDate: string;
  readonly note: string;
  readonly lines: DraftLine[];
  readonly onTitle: (value: string) => void;
  readonly onDueDate: (value: string) => void;
  readonly onNote: (value: string) => void;
  readonly onLines: (value: DraftLine[]) => void;
}

export default function PaymentDetailsStep({
  title,
  dueDate,
  note,
  lines,
  onTitle,
  onDueDate,
  onNote,
  onLines
}: Props) {
  const total = calculateDraftTotal(lines);
  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    onLines(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  return (
    <section className="payment-create-step">
      <div className="payment-create-step__intro">
        <div>
          <h3>Build the request</h3>
          <p>Add a clear title, due date and the items that make up this payment.</p>
        </div>
        <span className={total > 0 ? 'has-selection' : ''}>{formatMoney(total)}</span>
      </div>
      <div className="payment-create-fields">
        <label className="field">
          <span>Request title</span>
          <input
            value={title}
            maxLength={160}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="e.g. 2026 Semester Two fees"
          />
        </label>
        <label className="field">
          <span>Due date</span>
          <input
            type="date"
            value={dueDate}
            min={formatIsoDateInAuckland(new Date())}
            onChange={(event) => onDueDate(event.target.value)}
          />
        </label>
      </div>
      <div className="payment-line-editor">
        <div className="payment-line-editor__heading">
          <div>
            <strong>Statement items</strong>
            <small>Use a credit for scholarships or adjustments.</small>
          </div>
          <span>{lines.length} item{lines.length === 1 ? '' : 's'}</span>
        </div>
        {lines.map((line, index) => (
          <div className="payment-line-editor__row" key={line.id}>
            <label className="field">
              <span>Item {index + 1}</span>
              <input
                value={line.description}
                maxLength={180}
                onChange={(event) => updateLine(line.id, { description: event.target.value })}
                placeholder="Description"
              />
            </label>
            <label className="field">
              <span>Type</span>
              <select
                value={line.type}
                onChange={(event) => updateLine(line.id, { type: event.target.value as LineItemType })}
              >
                <option value="CHARGE">Charge</option>
                <option value="CREDIT">Credit</option>
              </select>
            </label>
            <label className="field">
              <span>Amount (NZD)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={line.amount}
                onChange={(event) => updateLine(line.id, { amount: event.target.value })}
                placeholder="0.00"
              />
            </label>
            <button
              type="button"
              className="payment-line-editor__remove"
              disabled={lines.length === 1}
              onClick={() => onLines(lines.filter((candidate) => candidate.id !== line.id))}
              aria-label={`Remove item ${index + 1}`}
            >
              <IconX />
            </button>
          </div>
        ))}
        {total <= 0 && lines.some((line) => Number(line.amount) > 0) && (
          <p className="field-error">Charges must be greater than credits.</p>
        )}
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => onLines([...lines, createDraftLine()])}>
          <IconPlus /> Add item
        </button>
      </div>
      <label className="field">
        <span>Note <small>Optional</small></span>
        <textarea
          value={note}
          maxLength={2000}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Add context students may need."
          rows={3}
        />
      </label>
    </section>
  );
}
