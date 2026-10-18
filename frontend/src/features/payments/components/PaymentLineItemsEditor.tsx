import { IconPlus, IconX } from '../../../components/icons';
import type { LineItemType } from '../types';
import { calculateDraftTotal, createDraftLine, type DraftLine } from '../paymentRequestDraft';
import InvoiceAmountInput from './InvoiceAmountInput';

interface Props {
  readonly lines: DraftLine[];
  readonly onChange: (lines: DraftLine[]) => void;
  readonly allowEmpty?: boolean;
  readonly invoiceTotal?: number;
}

export default function PaymentLineItemsEditor({ lines, onChange, allowEmpty = false, invoiceTotal }: Props) {
  const additionalItemsTotal = calculateDraftTotal(lines);
  const update = (id: string, patch: Partial<DraftLine>) => {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  return (
    <div className="payment-line-editor">
      <div className="payment-line-editor__heading">
        <div>
          <strong>Additional items</strong>
          <small>Optional fees, materials, scholarships or adjustments not tied to course access.</small>
        </div>
        <span>{lines.length} item{lines.length === 1 ? '' : 's'}</span>
      </div>
      {lines.map((line, index) => (
        <div className="payment-line-editor__row" key={line.id}>
          <label className="field">
            <span>Item {index + 1} <small>Required</small></span>
            <input
              required
              value={line.description}
              maxLength={180}
              onChange={(event) => update(line.id, { description: event.target.value })}
              placeholder="Description"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select
              required
              value={line.type}
              onChange={(event) => update(line.id, { type: event.target.value as LineItemType })}
            >
              <option value="CHARGE">Charge</option>
              <option value="CREDIT">Credit</option>
            </select>
          </label>
          <label className="field">
            <span>Amount (NZD) <small>Required</small></span>
            <InvoiceAmountInput value={line.amount} onChange={amount => update(line.id, {amount})} />
          </label>
          <button
            type="button"
            className="payment-line-editor__remove"
            disabled={!allowEmpty && lines.length === 1}
            onClick={() => onChange(lines.filter((candidate) => candidate.id !== line.id))}
            aria-label={`Remove item ${index + 1}`}
          >
            <IconX />
          </button>
        </div>
      ))}
      {(invoiceTotal ?? additionalItemsTotal) <= 0 && lines.some((line) => Number(line.amount) > 0) && (
        <p className="field-error">The complete invoice total must be greater than zero.</p>
      )}
      <button type="button" className="btn btn--quiet btn--sm" onClick={() => onChange([...lines, createDraftLine()])}>
        <IconPlus /> Add fee or adjustment
      </button>
    </div>
  );
}
