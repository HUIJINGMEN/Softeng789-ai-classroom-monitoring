/** Invoice inputs use exact integer cents, matching the backend DECIMAL(12,2) boundary. */
const MAX_MINOR_UNITS = 999_999_999_999;

export function moneyMinorUnits(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_MINOR_UNITS ? cents : null;
}

export function positiveMoney(value: string): boolean {
  const cents = moneyMinorUnits(value);
  return cents !== null && cents > 0;
}

export function sumDraftMoney(rows: readonly { amount: string; type?: string }[]): number {
  const cents = rows.reduce((total, row) => total
    + (moneyMinorUnits(row.amount) ?? 0) * (row.type === 'CREDIT' ? -1 : 1), 0);
  return cents / 100;
}

/** API totals are already two-decimal money; convert back to cents before summing a batch. */
export function sumMoneyValues(values: readonly number[]): number {
  return values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
}
