import { useEffect, useState } from 'react';
import {
  AdminPaymentDirectory,
  AdminPaymentOverview,
  AdminPaymentReviewWorkspace,
  AdminPaymentWorkspaceTabs,
  BatchInvoiceReviewModal,
  BillingOperationsWorkspace,
  CreatePaymentRequestModal,
  InvoiceReviewModal,
  StudentPaymentDirectory,
  useAdminPaymentWorkspace
} from '../features/payments';
import useMediaQuery from '../hooks/useMediaQuery';

interface Props {
  readonly initialAccountFocusId?: string;
  readonly onInitialAccountFocusConsumed?: () => void;
}

export default function AdminPayments({ initialAccountFocusId = '', onInitialAccountFocusConsumed }: Props) {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [focusStudentId] = useState(initialAccountFocusId);
  const controller = useAdminPaymentWorkspace();
  const { payments, accounts } = controller;

  useEffect(() => {
    if (initialAccountFocusId) onInitialAccountFocusConsumed?.();
  }, [initialAccountFocusId, onInitialAccountFocusConsumed]);

  return (
    <div className="page__inner admin-payments-page">
      <AdminPaymentWorkspaceTabs
        current={controller.workspace}
        onChange={controller.setWorkspace}
      />

      {controller.notice && (
        <output className="notice notice--success admin-payment-notice">
          {controller.notice}
        </output>
      )}

      {controller.workspace === 'students' && (
        <StudentPaymentDirectory
          data={accounts.data}
          query={accounts.query}
          filter={accounts.filter}
          loading={accounts.loading}
          error={accounts.error}
          onQueryChange={accounts.setQuery}
          onFilterChange={accounts.setFilter}
          onPageChange={accounts.setPage}
          onRetry={() => void accounts.reload()}
          onCreate={() => controller.openCreate()}
          onAction={controller.openStudentAccountAction}
          focusStudentId={focusStudentId}
        />
      )}

      {controller.workspace === 'invoices' && (
        <AdminPaymentDirectory
          isMobile={isMobile}
          data={payments.data}
          query={payments.query}
          status={payments.status}
          loading={payments.loading}
          error={payments.error}
          onQueryChange={payments.setQuery}
          onStatusChange={payments.setStatus}
          onPageChange={payments.setPage}
          onRetry={() => void payments.reload()}
          onOpen={controller.setReviewing}
        />
      )}

      {controller.workspace === 'reviews' && (
        <AdminPaymentReviewWorkspace
          queue={controller.reviewQueue}
          focusStudentId={controller.reviewStudentId}
          manualPaymentsRefresh={controller.manualPaymentsRefresh}
          onQueueChange={controller.setReviewQueue}
          onNotice={controller.setNotice}
          onInvoiceCreated={controller.feeRequestConverted}
          onManualPaymentReviewed={controller.manualPaymentReviewed}
        />
      )}

      {controller.workspace === 'overview' && (
        <>
          <AdminPaymentOverview
            summary={controller.summary}
            onShowDrafts={controller.showDrafts}
            onShowOverdue={controller.showOverdue}
          />
          <BillingOperationsWorkspace
            refreshToken={controller.operationsRefresh}
            onOpenInvoice={controller.openOperationsAlert}
          />
        </>
      )}

      {controller.creating && (
        <CreatePaymentRequestModal
          initialStudents={controller.creatingStudents}
          onClose={controller.closeCreate}
          onCreated={controller.paymentCreated}
        />
      )}

      {controller.reviewing && (
        <InvoiceReviewModal
          invoiceId={controller.reviewing.invoiceId}
          studentName={controller.reviewing.studentName}
          studentNumber={controller.reviewing.studentNumber}
          onClose={() => controller.setReviewing(null)}
          onUpdated={controller.invoiceUpdated}
        />
      )}

      {controller.batchInvoices.length > 0 && (
        <BatchInvoiceReviewModal
          invoices={controller.batchInvoices}
          onClose={() => controller.setBatchInvoices([])}
          onSent={controller.batchSent}
        />
      )}
    </div>
  );
}
