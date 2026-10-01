import { IconWallet } from '../../../components/icons';
import {
  formatMoney,
  formatPaymentDate,
  formatPaymentDeduction,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';
import {
  isInvoicePayable,
  latestRejectedBankTransfer,
  pendingBankTransfer,
  successfulTransactions
} from '../studentPaymentModel';
import type { StudentInvoice } from '../types';

export function StudentInvoiceCard({ invoice, onPay, onBankTransfer, bankTransferAvailable }: {
  readonly invoice: StudentInvoice;
  readonly onPay: (invoice: StudentInvoice) => void;
  readonly onBankTransfer: (invoice: StudentInvoice) => void;
  readonly bankTransferAvailable: boolean;
}) {
  const canPay = isInvoicePayable(invoice);
  const pendingTransfer = pendingBankTransfer(invoice);
  const rejectedTransfer = latestRejectedBankTransfer(invoice);
  const displayedTotal = canPay ? invoice.balance : invoice.charges - invoice.credits;

  return (
    <article className="student-invoice-card">
      <div className="student-invoice-card__head">
        <div>
          <span className={paymentStatusClass(invoice.status)}>{PAYMENT_STATUS_LABELS[invoice.status]}</span>
          <h3>{invoice.title}</h3>
          <p>Due {formatPaymentDate(invoice.dueDate)}</p>
        </div>
        <div className="student-invoice-card__balance">
          <span>{canPay ? 'Balance' : 'Total'}</span>
          <strong>{formatMoney(displayedTotal, invoice.currency)}</strong>
        </div>
      </div>

      <div className="payment-ledger" role="table" aria-label={`${invoice.title} statement`}>
        <div className="payment-ledger__header" role="row">
          <span role="columnheader">Description</span>
          <span role="columnheader">Charge</span>
          <span role="columnheader">Reduction or payment</span>
        </div>
        {invoice.lineItems.map((item) => {
          const isCharge = item.type === 'CHARGE';
          return (
            <div className={`payment-ledger__row payment-ledger__row--${item.type.toLowerCase()}`} role="row" key={item.id}>
              <span className="payment-ledger__description" role="cell">
                <strong>{item.description}</strong>
                <small>{isCharge ? 'Charge added to this statement' : 'Fee reduction applied to this statement'}</small>
              </span>
              <span role="cell" className={isCharge ? 'has-value' : ''}>
                {isCharge ? formatMoney(item.amount, invoice.currency) : '—'}
              </span>
              <span role="cell" className={isCharge ? '' : 'has-value is-credit'}>
                {isCharge ? '—' : `−${formatMoney(item.amount, invoice.currency)}`}
              </span>
            </div>
          );
        })}
        {successfulTransactions(invoice).map((transaction) => (
          <div className="payment-ledger__row payment-ledger__row--payment" role="row" key={transaction.id}>
            <span className="payment-ledger__description" role="cell">
              <strong>Payment received</strong>
              <small>Recorded {formatPaymentDate(transaction.occurredAt.slice(0, 10))}</small>
            </span>
            <span role="cell">—</span>
            <span role="cell" className="has-value is-credit">−{formatMoney(transaction.amount, invoice.currency)}</span>
          </div>
        ))}
      </div>

      <div className="student-invoice-card__calculation">
        <p>Fee reductions and received payments are subtracted from the charges above.</p>
        <dl>
          <div><dt>Charges</dt><dd>{formatMoney(invoice.charges, invoice.currency)}</dd></div>
          <div><dt>Fee reductions</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.credits, invoice.currency)}</dd></div>
          <div><dt>Payments received</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.payments, invoice.currency)}</dd></div>
          <div className="student-invoice-card__total"><dt>Amount due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
        </dl>
      </div>

      {!pendingTransfer && canPay && rejectedTransfer && (
        <div className="bank-transfer-rejected" role="status">
          <strong>Previous receipt needs attention</strong>
          <span>{rejectedTransfer.reviewNote || 'The receipt could not be matched. Check the transfer details and submit a new receipt.'}</span>
        </div>
      )}

      {(invoice.note || canPay) && (
        <div className="student-invoice-card__foot">
          {invoice.note && <p>{invoice.note}</p>}
          {pendingTransfer ? (
            <div className="bank-transfer-pending"><strong>Receipt under review</strong><span>{formatMoney(pendingTransfer.amount, invoice.currency)} submitted</span></div>
          ) : canPay && (
            <div className="student-invoice-card__actions">
              {bankTransferAvailable && <button type="button" className="btn" onClick={() => onBankTransfer(invoice)}>Bank transfer</button>}
              <button type="button" className="btn btn--primary student-invoice-card__pay-button" aria-label={`Pay ${formatMoney(invoice.balance, invoice.currency)}`} onClick={() => onPay(invoice)}>Pay online</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function StudentInvoiceHistoryRow({ invoice }: { readonly invoice: StudentInvoice }) {
  return (
    <article className="payment-history-row">
      <span className={paymentStatusClass(invoice.status)}>{PAYMENT_STATUS_LABELS[invoice.status]}</span>
      <div className="payment-history-row__identity">
        <strong>{invoice.title}</strong>
        <span>Due {formatPaymentDate(invoice.dueDate)}</span>
      </div>
      <div className="payment-history-row__amount">
        <span>Statement total</span>
        <strong>{formatMoney(invoice.charges - invoice.credits, invoice.currency)}</strong>
      </div>
    </article>
  );
}

export function EmptyStudentPayments() {
  return (
    <div className="payment-empty">
      <IconWallet />
      <strong>You are all paid up</strong>
      <span>New charges will appear here when they are issued.</span>
    </div>
  );
}
