import { formatMoney, formatPaymentDate } from '../format';
import type { StudentInvoice } from '../types';
import InvoiceCoursePurchasesSummary from './InvoiceCoursePurchasesSummary';

export default function BatchInvoiceFacts({ invoice }: { readonly invoice: StudentInvoice }) {
  return (
    <section className="batch-review-facts" aria-label={`Invoice details for ${invoice.studentName}`}>
      <dl>
        <div><dt>Invoice</dt><dd>{invoice.invoiceNumber}</dd></div>
        <div><dt>Due date</dt><dd>{formatPaymentDate(invoice.dueDate)}</dd></div>
        <div className="is-total"><dt>Amount due</dt><dd>{formatMoney(invoice.balance, invoice.currency)}</dd></div>
      </dl>
      <div className="batch-review-facts__title"><span>Invoice title</span><strong>{invoice.title}</strong></div>
      <details>
        <summary>View charges and course access</summary>
        <div className="batch-review-facts__items">
          {invoice.lineItems.map((item) => (
            <div key={item.id}>
              <span>{item.description}</span>
              <strong>{item.type === 'CREDIT' ? '−' : ''}{formatMoney(item.amount, invoice.currency)}</strong>
            </div>
          ))}
        </div>
        <InvoiceCoursePurchasesSummary
          purchases={invoice.coursePurchases}
          legacyEntitlement={invoice.entitlement}
          legacySessionPackage={invoice.sessionPackage}
          compact
        />
      </details>
    </section>
  );
}
