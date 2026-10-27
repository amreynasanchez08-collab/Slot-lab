const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('en-US');

/** Cents to "$1,234.56" (Panama uses the US number format). */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${money.format(Math.abs(cents) / 100)}`;
}

export function formatInt(n: number): string {
  return integer.format(n);
}

export function formatPct(x: number, digits = 2): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** "$1.25" or "1.25" to cents; null if invalid. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
