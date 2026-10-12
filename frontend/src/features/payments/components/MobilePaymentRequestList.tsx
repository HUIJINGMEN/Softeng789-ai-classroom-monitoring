import type { AdminPaymentRow } from '../api';
import {
  formatMoney,
  formatPaymentDate,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';

interface Props {
  readonly rows: readonly AdminPaymentRow[];
  readonly onOpen: (row: AdminPaymentRow) => void;
}

export default function MobilePaymentRequestList({ rows, onOpen }: Props) {
  return (
    <div className="mobile-payment-request-list" aria-label="Student invoices">
      {rows.map((row) => (
        <button type="button" className="mobile-payment-request" key={row.invoiceId} onClick={() => onOpen(row)}>
          <header className="mobile-payment-request__head">
            <div>
              <strong>{row.studentName}</strong>
              <span>{row.studentNumber}</span>
            </div>
            <span className={paymentStatusClass(row.status)}>{PAYMENT_STATUS_LABELS[row.status]}</span>
          </header>

          <div className="mobile-payment-request__request">
            <strong>{row.title}</strong>
            <span>Due {formatPaymentDate(row.dueDate)}</span>
          </div>

          <dl className="mobile-payment-request__money">
            <div>
              <dt>Balance</dt>
              <dd>{formatMoney(row.balance, row.currency)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatMoney(row.paid, row.currency)} <span>of {formatMoney(row.total, row.currency)}</span></dd>
            </div>
          </dl>
          <span className="mobile-payment-request__open">Review invoice →</span>
        </button>
      ))}
    </div>
  );
}
