import { IconWallet } from '../../../components/icons';
import {
  formatMoney,
  formatPaymentDate,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';
import {
  isInvoicePayable,
  invoiceOverpayment,
  latestRejectedManualPayment,
  pendingManualPayment
} from '../studentPaymentModel';
import type { StudentInvoice } from '../types';
import InvoiceCoursePurchasesSummary from './InvoiceCoursePurchasesSummary';
import StudentInvoiceBreakdown from './StudentInvoiceBreakdown';

export function StudentInvoiceCard({ invoice, onChoosePayment, onDownload }: {
  readonly invoice: StudentInvoice;
  readonly onChoosePayment: (invoice: StudentInvoice) => void;
  readonly onDownload?: (invoice: StudentInvoice) => void;
}) {
  const canPay = isInvoicePayable(invoice);
  const pendingPayment = pendingManualPayment(invoice);
  const rejectedPayment = latestRejectedManualPayment(invoice);
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

      <InvoiceCoursePurchasesSummary
        purchases={invoice.coursePurchases}
        legacyEntitlement={invoice.entitlement}
        legacySessionPackage={invoice.sessionPackage}
      />

      <StudentInvoiceBreakdown invoice={invoice} />

      {!pendingPayment && canPay && rejectedPayment && (
        <output className="manual-payment-rejected">
          <strong>{rejectedPayment.method === 'CASH' ? 'Previous cash payment needs attention' : 'Previous receipt needs attention'}</strong>
          <span>{rejectedPayment.reviewNote || (rejectedPayment.method === 'CASH' ? 'Check the payment details and submit again.' : 'The receipt could not be matched. Check the details and submit a new receipt.')}</span>
        </output>
      )}

      {(invoice.note || canPay) && (
        <div className="student-invoice-card__foot">
          {invoice.note && <p>{invoice.note}</p>}
          {pendingPayment ? (
            <div className="manual-payment-pending"><strong>{pendingPayment.method === 'CASH' ? 'Cash payment under review' : 'Transfer receipt under review'}</strong><span>{formatMoney(pendingPayment.amount, invoice.currency)} submitted</span></div>
          ) : canPay && (
            <div className="student-invoice-card__actions">
              {onDownload && <button type="button" className="btn" onClick={() => onDownload(invoice)}>Download PDF</button>}
              <button type="button" className="btn btn--primary student-invoice-card__pay-button" aria-label={`Choose payment method for ${formatMoney(invoice.balance, invoice.currency)}`} onClick={() => onChoosePayment(invoice)}>Choose payment method</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function StudentInvoiceHistoryRow({ invoice, onDownload }: { readonly invoice: StudentInvoice; readonly onDownload?: (invoice: StudentInvoice) => void }) {
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
        {invoiceOverpayment(invoice) > 0 && <small>Overpayment {formatMoney(invoiceOverpayment(invoice), invoice.currency)} — contact the administrator</small>}
      </div>
      {onDownload && <button type="button" className="btn btn--sm" onClick={() => onDownload(invoice)}>PDF</button>}
      <details className="payment-history-row__breakdown"><summary>Statement breakdown</summary><StudentInvoiceBreakdown invoice={invoice} /></details>
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
