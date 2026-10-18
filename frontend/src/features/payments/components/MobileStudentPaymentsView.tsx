import { IconArrowRight, IconChevronRight, IconWallet } from '../../../components/icons';
import {
  formatMoney,
  formatPaymentDate,
  formatPaymentRecordedDate,
  formatPaymentDeduction,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';
import {
  invoiceEntryCount,
  invoiceOverpayment,
  latestRejectedManualPayment,
  pendingManualPayment,
  statementDueDatePrefix,
  statementPaymentEntries
} from '../studentPaymentModel';
import type { StudentInvoice, StudentPaymentStatement } from '../api';
import StudentLessonCredits from './StudentLessonCredits';
import InvoiceCoursePurchasesSummary from './InvoiceCoursePurchasesSummary';

interface Props {
  readonly statement: StudentPaymentStatement;
  readonly openInvoices: readonly StudentInvoice[];
  readonly history: readonly StudentInvoice[];
  readonly onChoosePayment: (invoice: StudentInvoice) => void;
  readonly onDownload: (invoice: StudentInvoice) => void;
}

function MobileInvoiceBreakdown({ invoice }: { readonly invoice: StudentInvoice }) {
  const paymentEntries = statementPaymentEntries(invoice);
  const entryCount = invoiceEntryCount(invoice);
  const overpayment = invoiceOverpayment(invoice);

  return (
    <details className="mobile-payment-breakdown">
      <summary>
        <span>Statement breakdown</span>
        <span>{entryCount} entr{entryCount === 1 ? 'y' : 'ies'} <IconChevronRight /></span>
      </summary>

      <div className="mobile-payment-breakdown__content">
        <div className="mobile-payment-entries">
          {invoice.lineItems.map((item) => (
            <div className="mobile-payment-entry" key={item.id}>
              <span>
                <strong>{item.description}</strong>
                <small>{item.type === 'CREDIT' ? 'Fee reduction' : 'Charge'}</small>
              </span>
              <b className={item.type === 'CREDIT' ? 'is-deduction' : ''}>
                {item.type === 'CREDIT' ? '−' : ''}{formatMoney(item.amount, invoice.currency)}
              </b>
            </div>
          ))}
          {paymentEntries.map((entry) => (
            <div className="mobile-payment-entry" key={entry.id}>
              <span>
                <strong>{entry.label}</strong>
                <small>{formatPaymentRecordedDate(entry.occurredAt)}</small>
              </span>
              <b className={entry.balanceChange < 0 ? 'is-deduction' : ''}>{entry.balanceChange < 0 ? '−' : '+'}{formatMoney(Math.abs(entry.balanceChange), invoice.currency)}</b>
            </div>
          ))}
        </div>

        <dl className="mobile-payment-totals">
          <div><dt>Charges</dt><dd>{formatMoney(invoice.charges, invoice.currency)}</dd></div>
          <div><dt>Reductions</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.credits, invoice.currency)}</dd></div>
          <div><dt>Net payments</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.payments, invoice.currency)}</dd></div>
          <div><dt>Amount due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
          {overpayment > 0 && <div><dt>Overpayment — contact the administrator</dt><dd>{formatMoney(overpayment, invoice.currency)}</dd></div>}
        </dl>
        <p className="mobile-payment-breakdown__note">Refunds and reversed payments reduce net payments.</p>

        {invoice.note && <p className="mobile-payment-breakdown__note">{invoice.note}</p>}
      </div>
    </details>
  );
}

function MobileOpenInvoice({ invoice, onChoosePayment, onDownload }: {
  readonly invoice: StudentInvoice;
  readonly onChoosePayment: (invoice: StudentInvoice) => void;
  readonly onDownload: (invoice: StudentInvoice) => void;
}) {
  const pendingPayment = pendingManualPayment(invoice);
  const rejectedPayment = latestRejectedManualPayment(invoice);
  return (
    <article className="mobile-payment-statement">
      <div className="mobile-payment-statement__topline">
        <span className={paymentStatusClass(invoice.status)}>{PAYMENT_STATUS_LABELS[invoice.status]}</span>
        <span>Due {formatPaymentDate(invoice.dueDate)}</span>
      </div>
      <div className="mobile-payment-statement__identity">
        <div>
          <h2>{invoice.title}</h2>
          <span>Amount due</span>
        </div>
        <strong>{formatMoney(invoice.balance, invoice.currency)}</strong>
      </div>
      <InvoiceCoursePurchasesSummary
        purchases={invoice.coursePurchases}
        legacyEntitlement={invoice.entitlement}
        legacySessionPackage={invoice.sessionPackage}
        compact
      />
      {pendingPayment ? (
        <div className="mobile-manual-payment-pending"><strong>{pendingPayment.method === 'CASH' ? 'Cash receipt under review' : 'Transfer receipt under review'}</strong><span>{formatMoney(pendingPayment.amount, invoice.currency)}</span></div>
      ) : (
        <>
          {rejectedPayment && (
            <output className="mobile-manual-payment-rejected">
              <strong>Receipt needs attention</strong>
              <span>{rejectedPayment.reviewNote || 'Check the details and submit a new receipt.'}</span>
            </output>
          )}
          <div className="mobile-payment-statement__actions">
            <button type="button" className="mobile-payment-statement__pdf" onClick={() => onDownload(invoice)}>PDF invoice</button>
            <button type="button" className="mobile-payment-statement__pay" onClick={() => onChoosePayment(invoice)}>Choose how to pay <IconArrowRight /></button>
          </div>
        </>
      )}
      <MobileInvoiceBreakdown invoice={invoice} />
    </article>
  );
}

function MobilePaymentHistory({ invoices, onDownload }: { readonly invoices: readonly StudentInvoice[]; readonly onDownload: (invoice: StudentInvoice) => void }) {
  if (!invoices.length) return null;

  return (
    <details className="mobile-payment-history">
      <summary>
        <span><strong>Payment history</strong><small>Paid and cancelled statements</small></span>
        <span>{invoices.length}<IconChevronRight /></span>
      </summary>
      <div className="mobile-payment-history__list">
        {invoices.map((invoice) => (
          <article key={invoice.id}>
            <span className={paymentStatusClass(invoice.status)}>{PAYMENT_STATUS_LABELS[invoice.status]}</span>
            <div><strong>{invoice.title}</strong><small>Due {formatPaymentDate(invoice.dueDate)}</small>{invoiceOverpayment(invoice) > 0 && <small>Overpayment {formatMoney(invoiceOverpayment(invoice), invoice.currency)} — contact the administrator</small>}</div>
            <b>{formatMoney(invoice.charges - invoice.credits, invoice.currency)}</b>
            <button type="button" className="btn btn--sm" aria-label={`Download ${invoice.title} PDF`} onClick={() => onDownload(invoice)}>PDF invoice</button>
            <MobileInvoiceBreakdown invoice={invoice} />
          </article>
        ))}
      </div>
    </details>
  );
}

export default function MobileStudentPaymentsView({ statement, openInvoices, history, onChoosePayment, onDownload }: Props) {
  const hasAmountDue = statement.amountDue > 0;
  const dueDatePrefix = statementDueDatePrefix(statement.nextDueDate, openInvoices.length);
  const dueDateCopy = dueDatePrefix && statement.nextDueDate
    ? `${dueDatePrefix} ${formatPaymentDate(statement.nextDueDate)}`
    : 'No outstanding payments';

  return (
    <div className="mobile-student-screen mobile-student-payments">
      <header className="mobile-student-page-title">
        <h1>Your account</h1>
        <p>See what is due, review each statement and keep your payment history together.</p>
      </header>

      <section className={`mobile-payment-balance${hasAmountDue ? ' has-balance' : ' is-settled'}`} aria-label="Account balance">
        <div className="mobile-payment-balance__status">
          <span><IconWallet /></span>
          <strong>{hasAmountDue ? 'Payment due' : 'Account clear'}</strong>
        </div>
        <div className="mobile-payment-balance__amount">
          <span>Amount outstanding</span>
          <strong>{formatMoney(statement.amountDue, statement.currency)}</strong>
        </div>
        <p>{dueDateCopy} <span aria-hidden="true">·</span> {openInvoices.length} open statement{openInvoices.length === 1 ? '' : 's'}</p>

        <details className="mobile-payment-account-details">
          <summary>Account activity <IconChevronRight /></summary>
          <dl>
            <div><dt>Charges issued</dt><dd>{formatMoney(statement.totalCharges, statement.currency)}</dd></div>
            <div><dt>Fee reductions</dt><dd className="is-deduction">{formatPaymentDeduction(statement.totalCredits, statement.currency)}</dd></div>
            <div><dt>Net payments</dt><dd>{formatMoney(statement.totalPayments, statement.currency)}</dd></div>
          </dl>
        </details>
      </section>

      <StudentLessonCredits invoices={statement.invoices} mobile />

      <section className="mobile-payment-due" id="student-open-payments" aria-labelledby="mobile-payment-due-title">
        <div className="mobile-student-section__head">
          <div>
            <h2 id="mobile-payment-due-title">Payments due</h2>
            <p>{openInvoices.length ? 'Review and pay each open statement.' : 'Nothing needs your attention.'}</p>
          </div>
          {openInvoices.length > 0 && <span>{openInvoices.length}</span>}
        </div>

        {openInvoices.length > 0
          ? <div className="mobile-payment-statement-list">{openInvoices.map((invoice) => <MobileOpenInvoice key={invoice.id} invoice={invoice} onChoosePayment={onChoosePayment} onDownload={onDownload} />)}</div>
          : <div className="mobile-payment-clear"><IconWallet /><strong>You are all paid up</strong><span>New statements will appear here when they are issued.</span></div>}
      </section>

      <MobilePaymentHistory invoices={history} onDownload={onDownload} />
    </div>
  );
}
