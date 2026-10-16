import type { usePaymentReceipt } from '../usePaymentReceipt';
import { IconAlertTriangle, IconWallet } from '../../../components/icons';

interface Props {
  readonly fileName: string | null;
  readonly receipt: ReturnType<typeof usePaymentReceipt>;
  readonly cashPayment?: boolean;
}

export default function PaymentReceiptPreview({ fileName, receipt, cashPayment = false }: Props) {
  const noCashAttachment = cashPayment && receipt.status === 'none';
  return (
    <section className="payment-receipt-preview" aria-label={noCashAttachment ? 'Cash verification' : 'Submitted receipt'}>
      <header className="payment-receipt-preview__head">
        <div><h3>{noCashAttachment ? 'Cash verification' : 'Submitted receipt'}</h3><p>{fileName || 'No attachment submitted'}</p></div>
        <div className="payment-receipt-preview__actions">
          <span className={`payment-receipt-preview__status payment-receipt-preview__status--${receipt.status}`}>{receipt.status === 'none' ? (cashPayment ? 'Receipt optional' : 'Not attached') : receipt.status === 'error' ? 'Unavailable' : receipt.status === 'loading' ? 'Loading' : 'File loaded'}</span>
          {receipt.url && <a className="payment-receipt-preview__link" href={receipt.url} target="_blank" rel="noopener noreferrer">Open full size</a>}
        </div>
      </header>
      <div className="payment-receipt-preview__document" aria-busy={receipt.status === 'loading'}>
        {receipt.status === 'none' && <div className="payment-receipt-preview__state" role="status"><span className="payment-receipt-preview__cash" aria-hidden="true"><IconWallet /></span><strong>{cashPayment ? 'Verify cash received' : 'Verify the bank transfer'}</strong><p>{cashPayment ? 'A receipt is not required for cash payments. Check the amount against the institution cash record before approving.' : 'No receipt is attached. Check the amount, payer and reference against the institution bank account before approving.'}</p><p className="payment-receipt-preview__caution">Submitting a payment does not confirm receipt of funds. Administrator approval records the payment.</p></div>}
        {receipt.status === 'loading' && <div className="payment-receipt-preview__state" role="status"><span className="payment-receipt-preview__spinner" aria-hidden="true" /><strong>Loading receipt…</strong><p>Retrieving the submitted file securely.</p></div>}
        {receipt.status === 'error' && <div className="payment-receipt-preview__state" role="alert"><span className="payment-receipt-preview__warning" aria-hidden="true"><IconAlertTriangle /></span><strong>Receipt unavailable</strong><p>{receipt.error}</p><button type="button" className="btn" onClick={receipt.retry}>Retry preview</button><p className="payment-receipt-preview__caution">{cashPayment ? 'The attachment is optional for cash. Verify the institution cash record before approving.' : 'You can approve without a preview after verifying the amount, payer and reference in the institution bank account. If you cannot verify the transfer, do not approve.'}</p></div>}
        {receipt.status === 'ready' && (receipt.kind === 'pdf'
          ? <iframe title={`Receipt preview: ${fileName}`} src={`${receipt.url}#navpanes=0&view=FitH`} onError={receipt.failPreview} />
          : <img src={receipt.url} alt={`Submitted payment receipt: ${fileName}`} onError={receipt.failPreview} />)}
      </div>
      {receipt.kind === 'pdf' && <p className="payment-receipt-preview__help">Use the PDF controls to zoom or change pages. If your browser cannot display it here, open full size.</p>}
    </section>
  );
}
