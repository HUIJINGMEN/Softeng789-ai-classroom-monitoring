import { useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import { IconWallet } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatMoney, formatPaymentDate, formatPaymentDeduction } from '../format';
import { payStudentInvoice, type StudentInvoice, type StudentPaymentStatement } from '../api';
import { splitStudentInvoices } from '../studentPaymentModel';
import MobileStudentPaymentsView from './MobileStudentPaymentsView';
import BankTransferModal from './BankTransferModal';
import {
  EmptyStudentPayments,
  StudentInvoiceCard,
  StudentInvoiceHistoryRow
} from './StudentInvoiceCards';

interface Props {
  readonly studentId: string;
  readonly statement: StudentPaymentStatement | null;
  readonly loading: boolean;
  readonly loadError: string;
  readonly onRefresh: () => void;
  readonly mobile?: boolean;
}

function paymentDueDateCopy(statement: StudentPaymentStatement, openInvoiceCount: number) {
  const hasAmountDue = statement.amountDue > 0;
  if (!hasAmountDue) return 'No outstanding payments';
  if (statement.nextDueDate) {
    const dueLabel = openInvoiceCount > 1 ? 'Earliest due date' : 'Due date';
    return `${dueLabel} · ${formatPaymentDate(statement.nextDueDate)}`;
  }
  return 'Review your open statement';
}

interface DesktopViewProps {
  readonly statement: StudentPaymentStatement;
  readonly openInvoices: readonly StudentInvoice[];
  readonly history: readonly StudentInvoice[];
  readonly onPay: (invoice: StudentInvoice) => void;
  readonly onBankTransfer: (invoice: StudentInvoice) => void;
}

function DesktopStudentPaymentsView({ statement, openInvoices, history, onPay, onBankTransfer }: DesktopViewProps) {
  const hasAmountDue = statement.amountDue > 0;
  const dueDateCopy = paymentDueDateCopy(statement, openInvoices.length);

  return (
    <div className="student-view student-view--payments student-payments">
      <header className="student-page-head student-payments__page-head">
        <div>
          <h1>Payments</h1>
          <p>Review your university account, due dates and payment history.</p>
        </div>
      </header>

      <section className={`student-account-overview${hasAmountDue ? ' has-balance' : ' is-settled'}`} aria-label="Account balance">
        <div className="student-account-overview__balance">
          <div className="student-account-overview__heading">
            <h2>Amount outstanding</h2>
            <span className="student-account-overview__state"><IconWallet /> {hasAmountDue ? 'Payment due' : 'Account clear'}</span>
          </div>
          <div className="student-account-overview__amount">
            <strong>{formatMoney(statement.amountDue, statement.currency)}</strong>
            <span>{statement.currency}</span>
          </div>
          <div className="student-account-overview__meta">
            <p>{dueDateCopy}</p>
            <span>{openInvoices.length} open statement{openInvoices.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <dl className="student-account-overview__breakdown">
          <div><dt>Charges issued</dt><dd>{formatMoney(statement.totalCharges, statement.currency)}</dd></div>
          <div><dt>Fee reductions</dt><dd className="is-deduction">{formatPaymentDeduction(statement.totalCredits, statement.currency)}</dd></div>
          <div><dt>Payments received</dt><dd>{formatMoney(statement.totalPayments, statement.currency)}</dd></div>
        </dl>
      </section>

      <section className="student-payments__section">
        <div className="payment-section-heading"><div><h2>Payments due</h2><p>Open statements that still need your attention.</p></div><span>{openInvoices.length} statement{openInvoices.length === 1 ? '' : 's'}</span></div>
        {openInvoices.length
          ? openInvoices.map((invoice) => <StudentInvoiceCard key={invoice.id} invoice={invoice} onPay={onPay} onBankTransfer={onBankTransfer} bankTransferAvailable={Boolean(statement.bankAccount)} />)
          : <EmptyStudentPayments />}
      </section>

      {history.length > 0 && (
        <section className="student-payments__section">
          <div className="payment-section-heading"><div><h2>Past statements</h2><p>Paid and cancelled statements remain available for your records.</p></div></div>
          <div className="payment-history-list">
            {history.map((invoice) => <StudentInvoiceHistoryRow key={invoice.id} invoice={invoice} />)}
          </div>
        </section>
      )}

    </div>
  );
}

interface ConfirmationProps {
  readonly invoice: StudentInvoice;
  readonly paying: boolean;
  readonly error: string;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

function PaymentConfirmation({ invoice, paying, error, onClose, onConfirm }: ConfirmationProps) {
  return (
    <Modal
      size="confirm"
      className="payment-confirm-modal"
      title="Review demo payment"
      subtitle="Check the statement and amount before recording this prototype payment."
      closeButton
      onClose={onClose}
      footer={<><button type="button" className="btn" disabled={paying} onClick={onClose}>Cancel</button><button type="button" className="btn btn--primary" aria-busy={paying} disabled={paying} onClick={onConfirm}>{paying ? 'Recording…' : 'Confirm payment'}</button></>}
    >
      <div className="payment-confirm-summary">
        <div className="payment-confirm-summary__statement"><span>Statement</span><strong>{invoice.title}</strong></div>
        <div className="payment-confirm-summary__amount"><span>Amount to pay</span><strong>{formatMoney(invoice.balance, invoice.currency)}</strong></div>
        <small>Demo checkout only — no card will be charged.</small>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function useStudentPayment(studentId: string, onRefresh: () => void) {
  const [selected, setSelected] = useState<StudentInvoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const openPayment = (invoice: StudentInvoice) => {
    setError('');
    setSelected(invoice);
  };

  const closePayment = () => {
    setError('');
    setSelected(null);
  };

  const confirmPayment = async () => {
    if (!selected) return;
    setPaying(true);
    setError('');
    try {
      await payStudentInvoice(studentId, selected.id);
      closePayment();
      onRefresh();
    } catch (cause) {
      setError(apiMessage(cause));
    } finally {
      setPaying(false);
    }
  };

  return { selected, paying, error, openPayment, closePayment, confirmPayment };
}

export default function StudentPaymentsView({ studentId, statement, loading, loadError, onRefresh, mobile = false }: Props) {
  const payment = useStudentPayment(studentId, onRefresh);
  const [bankTransferInvoice, setBankTransferInvoice] = useState<StudentInvoice | null>(null);
  const { openInvoices, history } = useMemo(
    () => splitStudentInvoices(statement?.invoices ?? []),
    [statement]
  );

  if (loading && !statement) return <output className="payment-page-state">Loading your statement…</output>;
  if (loadError || !statement) return <div className="payment-page-state payment-page-state--error" role="alert"><strong>Payments are unavailable</strong><p>{loadError || 'Please try again.'}</p><button className="btn" type="button" onClick={onRefresh}>Try again</button></div>;

  const paymentView = mobile
    ? <MobileStudentPaymentsView statement={statement} openInvoices={openInvoices} history={history} onPay={payment.openPayment} onBankTransfer={setBankTransferInvoice} bankTransferAvailable={Boolean(statement.bankAccount)} />
    : <DesktopStudentPaymentsView statement={statement} openInvoices={openInvoices} history={history} onPay={payment.openPayment} onBankTransfer={setBankTransferInvoice} />;

  return (
    <>
      {paymentView}
      {payment.selected && (
        <PaymentConfirmation
          invoice={payment.selected}
          paying={payment.paying}
          error={payment.error}
          onClose={payment.closePayment}
          onConfirm={payment.confirmPayment}
        />
      )}
      {bankTransferInvoice && statement.bankAccount && (
        <BankTransferModal
          studentId={studentId}
          invoice={bankTransferInvoice}
          account={statement.bankAccount}
          onClose={() => setBankTransferInvoice(null)}
          onSubmitted={() => {
            setBankTransferInvoice(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
