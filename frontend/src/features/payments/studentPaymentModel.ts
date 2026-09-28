import type { StudentInvoice } from './types';

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

export function successfulTransactions(invoice: StudentInvoice) {
  return invoice.transactions.filter((transaction) => transaction.status === 'SUCCEEDED');
}

export function invoiceEntryCount(invoice: StudentInvoice) {
  return invoice.lineItems.length + successfulTransactions(invoice).length;
}

export function statementDueDatePrefix(nextDueDate: string | null, openInvoiceCount: number) {
  if (!nextDueDate) return null;
  return openInvoiceCount > 1 ? 'Earliest due' : 'Due';
}
