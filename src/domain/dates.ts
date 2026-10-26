/**
 * Dates are stored as local wall-clock strings without a zone:
 *   date-time "2026-10-26T08:42", date "2026-10-26", month "2026-10".
 * Comparing these strings lexicographically orders them correctly, and month
 * and day boundaries never shift with the device's time zone.
 */
export type LocalDateTime = string;
export type LocalDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function nowLocal(d = new Date()): LocalDateTime {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayLocal(d = new Date()): LocalDate {
  return nowLocal(d).slice(0, 10);
}

export function isLocalDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isLocalDateTime(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && isLocalDate(v.slice(0, 10)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60;
}

function toUTC(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): LocalDate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** "2026-10" */
export type Month = string;

export function monthOf(date: LocalDate | LocalDateTime): Month {
  return date.slice(0, 7);
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function monthStart(month: Month): LocalDate {
  return `${month}-01`;
}

export function monthEnd(month: Month): LocalDate {
  return addDays(monthStart(addMonths(month, 1)), -1);
}

/** Inclusive date range. */
export interface DateRange {
  start: LocalDate;
  end: LocalDate;
}

export function inRange(at: LocalDate | LocalDateTime, range: DateRange): boolean {
  const day = at.slice(0, 10);
  return day >= range.start && day <= range.end;
}

export function monthRange(month: Month): DateRange {
  return { start: monthStart(month), end: monthEnd(month) };
}

export function monthsInRange(range: DateRange): Month[] {
  const out: Month[] = [];
  for (let m = monthOf(range.start); m <= monthOf(range.end); m = addMonths(m, 1)) out.push(m);
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DateStyle = 'us' | 'intl';

function parts(date: LocalDate) {
  const d = toUTC(date);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
}

/** "Oct 26" / "26 Oct" */
export function formatShortDate(date: LocalDate, style: DateStyle = 'us'): string {
  const p = parts(date);
  return style === 'us' ? `${MONTHS[p.m]} ${p.d}` : `${p.d} ${MONTHS[p.m]}`;
}

/** "Mon, Oct 26" / "Mon, 26 Oct" */
export function formatDayLabel(date: LocalDate, style: DateStyle = 'us'): string {
  return `${DAYS[parts(date).wd]}, ${formatShortDate(date, style)}`;
}

/** "Mon, Oct 26, 2026" / "Mon, 26 Oct 2026" */
export function formatLongDate(date: LocalDate, style: DateStyle = 'us'): string {
  const p = parts(date);
  return style === 'us' ? `${DAYS[p.wd]}, ${MONTHS[p.m]} ${p.d}, ${p.y}` : `${DAYS[p.wd]}, ${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** "Oct 2, 2026" / "2 Oct 2026" */
export function formatDate(date: LocalDate, style: DateStyle = 'us'): string {
  const p = parts(date);
  return style === 'us' ? `${MONTHS[p.m]} ${p.d}, ${p.y}` : `${p.d} ${MONTHS[p.m]} ${p.y}`;
}

/** "8:42 AM" */
export function formatTime(at: LocalDateTime): string {
  const h = Number(at.slice(11, 13));
  const m = at.slice(14, 16);
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "October 2026" */
export function formatMonthLong(month: Month): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "Oct 2026" */
export function formatMonthShort(month: Month): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Oct" */
export function monthAbbr(month: Month): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

/** "October" */
export function monthName(month: Month): string {
  return MONTHS_LONG[Number(month.slice(5, 7)) - 1];
}

/** "Oct 1 – Oct 26, 2026", "May – Oct 2026", "Jan – Oct 2026". */
export function formatRangeLabel(range: DateRange, style: DateStyle = 'us'): string {
  const a = parts(range.start);
  const b = parts(range.end);
  if (a.y === b.y && a.m === b.m) return style === 'us' ? `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}, ${b.y}` : `${a.d} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
  return `${formatShortDate(range.start, style)}${a.y !== b.y ? `, ${a.y}` : ''} – ${formatDate(range.end, style)}`;
}

export function formatMonthSpan(range: DateRange): string {
  const a = monthOf(range.start);
  const b = monthOf(range.end);
  if (a === b) return formatMonthShort(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${monthAbbr(a)}–${formatMonthShort(b)}` : `${formatMonthShort(a)} – ${formatMonthShort(b)}`;
}
