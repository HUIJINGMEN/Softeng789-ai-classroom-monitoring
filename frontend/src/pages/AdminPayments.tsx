import { useMemo, useState } from 'react';
import {
  AdminMobilePaymentSummary,
  AdminPaymentDirectory,
  AdminPaymentOverview,
  CreatePaymentRequestModal,
  toAdminPaymentSummaryView,
  useAdminPayments
} from '../features/payments';
import useMediaQuery from '../hooks/useMediaQuery';

export default function AdminPayments() {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const payments = useAdminPayments();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');
  const summary = useMemo(
    () => toAdminPaymentSummaryView(payments.data?.summary),
    [payments.data?.summary]
  );

  const showOverdue = () => payments.setStatus('OVERDUE');
  const paymentCreated = (count: number) => {
    setCreating(false);
    setNotice(`${count} payment request${count === 1 ? '' : 's'} issued.`);
    void payments.reload();
  };

  return (
    <div className="page__inner admin-payments-page">
      {isMobile ? (
        <AdminMobilePaymentSummary
          summary={summary}
          loading={payments.loading && !summary.available}
          onCreate={() => setCreating(true)}
          onShowOverdue={showOverdue}
        />
      ) : (
        <AdminPaymentOverview
          summary={summary}
          onCreate={() => setCreating(true)}
          onShowOverdue={showOverdue}
        />
      )}

      {notice && <output className="notice notice--success admin-payment-notice">{notice}</output>}

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
      />

      {creating && (
        <CreatePaymentRequestModal onClose={() => setCreating(false)} onCreated={paymentCreated} />
      )}
    </div>
  );
}
