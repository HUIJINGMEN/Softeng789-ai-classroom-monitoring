import type { FeedbackSummaryDelivery } from '../../lib/feedbackSummaryApi';

export function deliveryActionLabel(download: boolean, email: boolean, publish: boolean): string {
  const count = Number(download) + Number(email) + Number(publish);
  if (count === 0) return 'Choose delivery';
  if (count > 1) return `Deliver report · ${count} actions`;
  if (download) return 'Download report';
  if (email) return 'Email report';
  return 'Publish report';
}

export function deliveryCompletionMessage(
  deliveries: readonly FeedbackSummaryDelivery[],
  sharing: boolean
): string {
  if (deliveries.length > 0 && deliveries.every((item) => item.status === 'DEMO'))
    return 'Email delivery is in Demo mode; no external email was sent.';
  if (deliveries.some((item) => item.status === 'DEMO'))
    return 'Confirmed email deliveries completed. Previously handled Demo summaries were not resent.';
  return sharing ? 'Selected sharing actions completed.' : '';
}
