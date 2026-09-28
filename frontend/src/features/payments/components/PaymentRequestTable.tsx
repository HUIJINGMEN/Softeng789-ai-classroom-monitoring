import type { AdminPaymentRow } from '../api';
import {
  formatMoney,
  formatPaymentDate,
  PAYMENT_STATUS_LABELS,
  paymentStatusClass
} from '../format';

interface Props {
  readonly rows: readonly AdminPaymentRow[];
}

export default function PaymentRequestTable({ rows }: Props) {
  return (
    <section
      className="admin-payment-table-wrap"
      aria-label="Student payment requests"
    >
      <table className="table admin-payment-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Request</th>
            <th>Due</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.invoiceId}>
              <td data-label="Student"><strong>{row.studentName}</strong><small>{row.studentNumber}</small></td>
              <td data-label="Request">{row.title}</td>
              <td data-label="Due">{formatPaymentDate(row.dueDate)}</td>
              <td data-label="Total">{formatMoney(row.total, row.currency)}</td>
              <td data-label="Paid">{formatMoney(row.paid, row.currency)}</td>
              <td data-label="Balance"><strong>{formatMoney(row.balance, row.currency)}</strong></td>
              <td data-label="Status">
                <span className={paymentStatusClass(row.status)}>{PAYMENT_STATUS_LABELS[row.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
