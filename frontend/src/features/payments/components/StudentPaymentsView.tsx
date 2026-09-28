import { useMemo, useState } from 'react';
import Modal from '../../../components/Modal';
import { IconWallet } from '../../../components/icons';
import { apiMessage } from '../../../lib/apiClient';
import { formatMoney, formatPaymentDate, formatPaymentDeduction } from '../format';
import { payStudentInvoice, type StudentInvoice, type StudentPaymentStatement } from '../api';
import { splitStudentInvoices } from '../studentPaymentModel';
import MobileStudentPaymentsView from './MobileStudentPaymentsView';
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

export default function StudentPaymentsView({ studentId, statement, loading, loadError, onRefresh, mobile = false }: Props) {
  const [selected, setSelected] = useState<StudentInvoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const { openInvoices, history } = useMemo(
    () => splitStudentInvoices(statement?.invoices ?? []),
    [statement]
  );

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

  if (loading && !statement) return <div className="payment-page-state" role="status">Loading your statement…</div>;
  if (loadError || !statement) return <div className="payment-page-state payment-page-state--error" role="alert"><strong>Payments are unavailable</strong><p>{loadError || 'Please try again.'}</p><button className="btn" type="button" onClick={onRefresh}>Try again</button></div>;

  const hasAmountDue = statement.amountDue > 0;
  let dueDateCopy = 'No outstanding payments';
  if (hasAmountDue && statement.nextDueDate) {
    const dueLabel = openInvoices.length > 1 ? 'Earliest due date' : 'Due date';
    dueDateCopy = `${dueLabel} · ${formatPaymentDate(statement.nextDueDate)}`;
  } else if (hasAmountDue) {
    dueDateCopy = 'Review your open statement';
  }

  const paymentView = mobile
    ? <MobileStudentPaymentsView statement={statement} openInvoices={openInvoices} history={history} onPay={openPayment} />
    : (
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
          ? openInvoices.map((invoice) => <StudentInvoiceCard key={invoice.id} invoice={invoice} onPay={openPayment} />)
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

  return (
    <>
      {paymentView}
      {selected && (
        <Modal
          size="confirm"
          className="payment-confirm-modal"
          title="Review demo payment"
          subtitle="Check the statement and amount before recording this prototype payment."
          closeButton
          onClose={closePayment}
          footer={<><button type="button" className="btn" disabled={paying} onClick={closePayment}>Cancel</button><button type="button" className="btn btn--primary" aria-busy={paying} disabled={paying} onClick={confirmPayment}>{paying ? 'Recording…' : 'Confirm payment'}</button></>}
        >
          <div className="payment-confirm-summary">
            <div className="payment-confirm-summary__statement"><span>Statement</span><strong>{selected.title}</strong></div>
            <div className="payment-confirm-summary__amount"><span>Amount to pay</span><strong>{formatMoney(selected.balance, selected.currency)}</strong></div>
            <small>Demo checkout only — no card will be charged.</small>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
