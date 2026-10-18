import { useId } from 'react';
import { positiveMoney } from '../money';

/** Shared input boundary for course purchases, adjustments and per-student batch plans. */
export default function InvoiceAmountInput({value, onChange}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const errorId = useId();
  const invalid = value.trim() !== '' && !positiveMoney(value);
  return <>
    <input required type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal"
      value={value} onChange={event => onChange(event.target.value)} placeholder="0.00"
      aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} />
    {invalid && <small id={errorId} className="field-error">Enter $0.01–$9,999,999,999.99, with at most 2 decimal places.</small>}
  </>;
}
