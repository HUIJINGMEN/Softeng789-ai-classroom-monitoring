import { formatMoney, formatPaymentDeduction, formatPaymentRecordedDate } from '../format';
import { invoiceOverpayment, statementPaymentEntries } from '../studentPaymentModel';
import type { StudentInvoice } from '../types';

/** The same reconcilable ledger is available on both open and historical desktop statements. */
export default function StudentInvoiceBreakdown({ invoice }: { readonly invoice: StudentInvoice }) {
  const overpayment = invoiceOverpayment(invoice);
  return <>
    <div className="payment-ledger" role="table" aria-label={`${invoice.title} statement`}>
      <div className="payment-ledger__header" role="row">
        <span role="columnheader">Description</span>
        <span role="columnheader">Charge or returned payment</span>
        <span role="columnheader">Reduction or payment</span>
      </div>
      {invoice.lineItems.map((item) => {
        const isCharge = item.type === 'CHARGE';
        return <div className={`payment-ledger__row payment-ledger__row--${item.type.toLowerCase()}`} role="row" key={item.id}>
          <span className="payment-ledger__description" role="cell">
            <strong>{item.description}</strong>
            <small>{isCharge ? 'Charge added to this statement' : 'Fee reduction applied to this statement'}</small>
          </span>
          <span role="cell" className={isCharge ? 'has-value' : ''}>{isCharge ? formatMoney(item.amount, invoice.currency) : '—'}</span>
          <span role="cell" className={isCharge ? '' : 'has-value is-credit'}>{isCharge ? '—' : `−${formatMoney(item.amount, invoice.currency)}`}</span>
        </div>;
      })}
      {statementPaymentEntries(invoice).map((entry) => <div className="payment-ledger__row payment-ledger__row--payment" role="row" key={entry.id}>
        <span className="payment-ledger__description" role="cell">
          <strong>{entry.label}</strong>
          <small>Recorded {formatPaymentRecordedDate(entry.occurredAt)}</small>
        </span>
        <span role="cell" className={entry.balanceChange > 0 ? 'has-value' : ''}>{entry.balanceChange > 0 ? formatMoney(entry.balanceChange, invoice.currency) : '—'}</span>
        <span role="cell" className={entry.balanceChange < 0 ? 'has-value is-credit' : ''}>{entry.balanceChange < 0 ? `−${formatMoney(-entry.balanceChange, invoice.currency)}` : '—'}</span>
      </div>)}
    </div>
    <div className="student-invoice-card__calculation">
      <p>Fee reductions and net payments are subtracted from charges. Refunds and reversed payments reduce net payments.</p>
      <dl>
        <div><dt>Charges</dt><dd>{formatMoney(invoice.charges, invoice.currency)}</dd></div>
        <div><dt>Fee reductions</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.credits, invoice.currency)}</dd></div>
        <div><dt>Net payments</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.payments, invoice.currency)}</dd></div>
        <div className="student-invoice-card__total"><dt>Amount due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
        {overpayment > 0 && <div><dt>Overpayment — contact the administrator</dt><dd>{formatMoney(overpayment, invoice.currency)}</dd></div>}
      </dl>
    </div>
  </>;
}
