import type { PaymentTransaction, StudentInvoice } from './types';
import { sumMoneyValues } from './money';

export function isInvoicePayable(invoice: StudentInvoice) {
  return invoice.balance > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID';
}

export function splitStudentInvoices(invoices: readonly StudentInvoice[]) {
  const openInvoices: StudentInvoice[] = [];
  const history: StudentInvoice[] = [];

  for (const invoice of invoices) {
    if (isInvoicePayable(invoice)) openInvoices.push(invoice);
    else history.push(invoice);
  }

  return { openInvoices, history };
}

/** Posted transactions affect the balance; failures and pending manual claims do not. */
function statementTransactionLabel(transaction: PaymentTransaction): string {
  if (transaction.status === 'SUCCEEDED') return 'Payment received';
  return transaction.provider === 'ADMIN_CORRECTION' ? 'Payment reversed' : 'Refund recorded';
}

export function statementPaymentEntries(invoice: StudentInvoice) {
  return invoice.transactions
    .filter((transaction) => transaction.status === 'SUCCEEDED' || transaction.status === 'REFUNDED')
    .map((transaction) => ({
      id: transaction.id,
      occurredAt: transaction.occurredAt,
      label: statementTransactionLabel(transaction),
      // The sign is the effect on amount due: receipts reduce it, returns/corrections increase it.
      balanceChange: transaction.status === 'SUCCEEDED' ? -transaction.amount : transaction.amount
    }));
}

/** Expose legacy surplus without silently applying it to a different invoice or moving money. */
export function invoiceOverpayment(invoice: StudentInvoice) {
  return Math.max(0, sumMoneyValues([invoice.payments, invoice.credits, -invoice.charges]));
}

export function pendingManualPayment(invoice: StudentInvoice) {
  return invoice.manualPayments.find((payment) => payment.status === 'PENDING') ?? null;
}

export function latestRejectedManualPayment(invoice: StudentInvoice) {
  return invoice.manualPayments.find((payment) => payment.status === 'REJECTED') ?? null;
}

export function invoiceEntryCount(invoice: StudentInvoice) {
  return invoice.lineItems.length + statementPaymentEntries(invoice).length;
}

export function statementDueDatePrefix(nextDueDate: string | null, openInvoiceCount: number) {
  if (!nextDueDate) return null;
  return openInvoiceCount > 1 ? 'Earliest due' : 'Due';
}
