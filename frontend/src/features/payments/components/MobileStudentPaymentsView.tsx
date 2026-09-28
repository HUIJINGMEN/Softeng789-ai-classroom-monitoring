import { IconArrowRight, IconChevronRight, IconWallet } from '../../../components/icons';
import {
  formatMoney,
  formatPaymentDate,
  formatPaymentDeduction,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';
import {
  invoiceEntryCount,
  statementDueDatePrefix,
  successfulTransactions
} from '../studentPaymentModel';
import type { StudentInvoice, StudentPaymentStatement } from '../api';

interface Props {
  readonly statement: StudentPaymentStatement;
  readonly openInvoices: readonly StudentInvoice[];
  readonly history: readonly StudentInvoice[];
  readonly onPay: (invoice: StudentInvoice) => void;
}

function MobileInvoiceBreakdown({ invoice }: { readonly invoice: StudentInvoice }) {
  const successfulPayments = successfulTransactions(invoice);
  const entryCount = invoiceEntryCount(invoice);

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
          {successfulPayments.map((transaction) => (
            <div className="mobile-payment-entry" key={transaction.id}>
              <span>
                <strong>Payment received</strong>
                <small>{formatPaymentDate(transaction.occurredAt.slice(0, 10))}</small>
              </span>
              <b className="is-deduction">−{formatMoney(transaction.amount, invoice.currency)}</b>
            </div>
          ))}
        </div>

        <dl className="mobile-payment-totals">
          <div><dt>Charges</dt><dd>{formatMoney(invoice.charges, invoice.currency)}</dd></div>
          <div><dt>Reductions</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.credits, invoice.currency)}</dd></div>
          <div><dt>Paid</dt><dd className="is-deduction">{formatPaymentDeduction(invoice.payments, invoice.currency)}</dd></div>
          <div><dt>Amount due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
        </dl>

        {invoice.note && <p className="mobile-payment-breakdown__note">{invoice.note}</p>}
      </div>
    </details>
  );
}

function MobileOpenInvoice({ invoice, onPay }: {
  readonly invoice: StudentInvoice;
  readonly onPay: (invoice: StudentInvoice) => void;
}) {
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
      <button type="button" className="mobile-payment-statement__pay" onClick={() => onPay(invoice)}>
        Pay {formatMoney(invoice.balance, invoice.currency)} <IconArrowRight />
      </button>
      <MobileInvoiceBreakdown invoice={invoice} />
    </article>
  );
}

function MobilePaymentHistory({ invoices }: { readonly invoices: readonly StudentInvoice[] }) {
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
            <div><strong>{invoice.title}</strong><small>Due {formatPaymentDate(invoice.dueDate)}</small></div>
            <b>{formatMoney(invoice.charges - invoice.credits, invoice.currency)}</b>
          </article>
        ))}
      </div>
    </details>
  );
}

export default function MobileStudentPaymentsView({ statement, openInvoices, history, onPay }: Props) {
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
            <div><dt>Payments received</dt><dd>{formatMoney(statement.totalPayments, statement.currency)}</dd></div>
          </dl>
        </details>
      </section>

      <section className="mobile-payment-due" id="student-open-payments" aria-labelledby="mobile-payment-due-title">
        <div className="mobile-student-section__head">
          <div>
            <h2 id="mobile-payment-due-title">Payments due</h2>
            <p>{openInvoices.length ? 'Review and pay each open statement.' : 'Nothing needs your attention.'}</p>
          </div>
          {openInvoices.length > 0 && <span>{openInvoices.length}</span>}
        </div>

        {openInvoices.length > 0
          ? <div className="mobile-payment-statement-list">{openInvoices.map((invoice) => <MobileOpenInvoice key={invoice.id} invoice={invoice} onPay={onPay} />)}</div>
          : <div className="mobile-payment-clear"><IconWallet /><strong>You are all paid up</strong><span>New statements will appear here when they are issued.</span></div>}
      </section>

      <MobilePaymentHistory invoices={history} />
    </div>
  );
}
