/** Unknown/new transport states must never be presented as completed delivery. */
export function reportEmailProblem(deliveries: readonly { status: string }[]): string {
  return deliveries.some(item => item.status !== 'SENT' && item.status !== 'DEMO')
    ? 'Some email deliveries could not be confirmed and will not be sent again automatically. Check with the recipient or mail administrator. Completed portal publications are retained; PDF delivery remains available.'
    : '';
}
