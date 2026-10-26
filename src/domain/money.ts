/**
 * Money is stored as integer minor units (cents) with an ISO currency code.
 * Amounts are never added across currencies — see `sumByCurrency`.
 */
export type Cents = number;
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'IDR' | 'JPY';

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British pound', symbol: '£' },
  { code: 'IDR', label: 'Indonesian rupiah', symbol: 'Rp' },
  { code: 'JPY', label: 'Japanese yen', symbol: '¥' },
];

/** Minor units per major unit. JPY has no minor unit; IDR is shown without decimals but stored in "sen". */
const FRACTION: Record<CurrencyCode, number> = { USD: 2, EUR: 2, GBP: 2, IDR: 2, JPY: 0 };

export function isCents(v: unknown): v is Cents {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

export function fractionDigits(currency: CurrencyCode): number {
  return FRACTION[currency];
}

/** Parses a user-typed amount ("1,234.5", "12.75") into minor units. Returns null when invalid. */
export function parseAmount(input: string, currency: CurrencyCode): Cents | null {
  const clean = input.replace(/[,\s]/g, '').replace(/^[^\d.-]+/, '');
  const digits = fractionDigits(currency);
  const re = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${digits}})?$`);
  if (!clean || !re.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  const minor = Number(whole) * 10 ** digits + Number((frac + '0'.repeat(digits)).slice(0, digits) || 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → plain input string ("12.75"). */
export function toInput(cents: Cents, currency: CurrencyCode): string {
  const digits = fractionDigits(currency);
  return digits === 0 ? String(cents) : (cents / 10 ** digits).toFixed(digits);
}

const MINUS = '−';

/**
 * "$1,234.50", "−$12.75", "+$6,350.00". Uses a true minus sign like the design.
 * `whole` drops the minor units ("$12,300").
 */
export function formatMoney(cents: Cents, currency: CurrencyCode, opts: { sign?: 'auto' | 'always' | 'never'; whole?: boolean } = {}): string {
  const digits = opts.whole ? 0 : currency === 'IDR' ? 0 : fractionDigits(currency);
  const abs = Math.abs(cents) / 10 ** fractionDigits(currency);
  const body = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs);
  const sign = opts.sign ?? 'auto';
  if (sign === 'never') return body;
  if (cents < 0) return MINUS + body;
  if (sign === 'always' && cents > 0) return '+' + body;
  return body;
}

/** Compact axis labels: "$6k". */
export function formatCompact(cents: Cents, currency: CurrencyCode): string {
  const major = cents / 10 ** fractionDigits(currency);
  const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '';
  if (Math.abs(major) >= 1000) return `${sym}${Math.round(major / 1000)}k`;
  return `${sym}${Math.round(major)}`;
}

export function sumByCurrency(items: { amount: Cents; currency: CurrencyCode }[]): Map<CurrencyCode, Cents> {
  const out = new Map<CurrencyCode, Cents>();
  for (const i of items) out.set(i.currency, (out.get(i.currency) ?? 0) + i.amount);
  return out;
}

/** Whole-number percentage, never NaN. */
export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Percentage with one decimal, e.g. 54.6. */
export function percent1(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
