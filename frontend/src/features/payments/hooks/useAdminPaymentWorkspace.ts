import { useEffect, useMemo, useState } from 'react';
import type {
  OperationsAlert,
  StudentInvoice,
  StudentPaymentAccountRow
} from '../types';
import { toAdminPaymentSummaryView } from '../adminPaymentViewModel';
import type {
  AdminPaymentWorkspace,
  InvoiceReviewTarget,
  PaymentReviewQueue
} from '../admin/adminPaymentWorkspace';
import useAdminPayments from './useAdminPayments';
import useStudentPaymentAccounts from './useStudentPaymentAccounts';

function initialPaymentWorkspace(): AdminPaymentWorkspace {
  const requested = new URLSearchParams(window.location.search).get('paymentView');
  return requested === 'students' || requested === 'invoices' || requested === 'reviews' || requested === 'overview'
    ? requested
    : 'students';
}

export default function useAdminPaymentWorkspace() {
  const payments = useAdminPayments();
  const accounts = useStudentPaymentAccounts();
  const [workspace, setWorkspace] = useState<AdminPaymentWorkspace>(initialPaymentWorkspace);
  const [reviewQueue, setReviewQueue] = useState<PaymentReviewQueue>('payments');
  const [creating, setCreating] = useState(false);
  const [creatingStudents, setCreatingStudents] = useState<readonly { id: string; name: string }[]>([]);
  const [reviewing, setReviewing] = useState<InvoiceReviewTarget | null>(null);
  const [batchInvoices, setBatchInvoices] = useState<StudentInvoice[]>([]);
  const [notice, setNotice] = useState('');
  const [reviewStudentId, setReviewStudentId] = useState('');
  const [manualPaymentsRefresh, setManualPaymentsRefresh] = useState(0);
  const [operationsRefresh, setOperationsRefresh] = useState(0);

  const summary = useMemo(
    () => toAdminPaymentSummaryView(payments.data?.summary),
    [payments.data?.summary]
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('paymentView', workspace);
    if (url.href !== window.location.href) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [workspace]);

  const reloadDirectories = () => {
    void payments.reload();
    void accounts.reload();
  };

  const changeWorkspace = (next: AdminPaymentWorkspace) => {
    if (next === 'reviews') setReviewStudentId('');
    setWorkspace(next);
  };

  const openCreate = (students: readonly { id: string; name: string }[] = []) => {
    setCreatingStudents(students);
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setCreatingStudents([]);
  };

  const showInvoiceState = (status: 'DRAFT' | 'OVERDUE') => {
    payments.setStatus(status);
    setWorkspace('invoices');
  };

  const paymentCreated = (invoices: StudentInvoice[]) => {
    closeCreate();
    setWorkspace('invoices');
    payments.setStatus('DRAFT');
    setNotice(invoices.length === 1
      ? 'Invoice draft created. Review it before sending.'
      : `${invoices.length} invoice drafts created. Review each draft before sending.`);
    if (invoices.length > 1) {
      setBatchInvoices(invoices);
    } else if (invoices[0]) {
      setReviewing(invoiceTarget(invoices[0]));
    }
    reloadDirectories();
  };

  const openStudentAccountAction = (row: StudentPaymentAccountRow) => {
    if (row.state === 'PAYMENT_REVIEW') {
      setReviewStudentId(row.studentId);
      setReviewQueue('payments');
      setWorkspace('reviews');
    } else if (row.state === 'NEEDS_INVOICE') {
      openCreate([{ id: row.studentId, name: row.studentName }]);
    } else if (row.primaryInvoiceId) {
      setReviewing({
        invoiceId: row.primaryInvoiceId,
        studentName: row.studentName,
        studentNumber: row.studentNumber
      });
    }
  };

  const openOperationsAlert = (alert: OperationsAlert) => {
    setReviewing({ invoiceId: alert.invoiceId, studentName: alert.studentName, studentNumber: '' });
  };

  const feeRequestConverted = (invoice: InvoiceReviewTarget) => {
    setNotice('Invoice draft created from the student request. Review it before sending.');
    setWorkspace('invoices');
    payments.setStatus('DRAFT');
    setReviewing(invoice);
    reloadDirectories();
  };

  const manualPaymentReviewed = () => {
    setNotice('Manual payment review saved.');
    setManualPaymentsRefresh((value) => value + 1);
    reloadDirectories();
  };

  const invoiceUpdated = () => {
    reloadDirectories();
    setOperationsRefresh((value) => value + 1);
  };

  const batchSent = () => {
    const sentCount = batchInvoices.length;
    setBatchInvoices([]);
    setNotice(`${sentCount} invoices reviewed and sent.`);
    invoiceUpdated();
  };

  return {
    payments,
    accounts,
    summary,
    workspace,
    reviewQueue,
    creating,
    creatingStudents,
    reviewing,
    batchInvoices,
    notice,
    reviewStudentId,
    manualPaymentsRefresh,
    operationsRefresh,
    setWorkspace: changeWorkspace,
    setReviewQueue,
    setNotice,
    setReviewing,
    setBatchInvoices,
    openCreate,
    closeCreate,
    showDrafts: () => showInvoiceState('DRAFT'),
    showOverdue: () => showInvoiceState('OVERDUE'),
    paymentCreated,
    openStudentAccountAction,
    openOperationsAlert,
    feeRequestConverted,
    manualPaymentReviewed,
    invoiceUpdated,
    batchSent
  };
}

function invoiceTarget(invoice: StudentInvoice): InvoiceReviewTarget {
  return {
    invoiceId: invoice.id,
    studentName: invoice.studentName,
    studentNumber: invoice.studentNumber
  };
}
