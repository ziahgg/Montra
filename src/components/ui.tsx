'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

import { getCategory } from '@/domain/categories';
import { Icon } from './Icon';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

/* ───────────── Buttons ───────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';
  size?: 'lg' | 'sm';
  icon?: string;
  loading?: boolean;
  full?: boolean;
};

/** Figma "Button": Primary (ink) / Accent (yellow), Large 56 px / Small 40 px; plus secondary and danger. */
export function Button({ variant = 'primary', size = 'lg', icon, loading, full, className, children, disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-ink text-on-ink',
    accent: 'bg-brand text-on-brand',
    secondary: 'bg-surface text-text border border-border',
    danger: 'bg-error text-white',
    ghost: 'bg-transparent text-text',
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full transition-[opacity,transform] active:scale-[0.99] disabled:cursor-not-allowed',
        size === 'lg' ? 'h-14 px-6 t-button' : 'h-10 px-4 t-button-s',
        disabled && !loading ? 'bg-surface-muted text-disabled-text border-0' : styles,
        full && 'w-full',
        className,
      )}
    >
      {loading ? <span className="size-4 rounded-full border-2 border-current border-t-transparent anim-spin" aria-hidden /> : icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} /> : null}
      {children}
    </button>
  );
}

/** Figma "Icon Button": Surface (white + border) or Ink, 48 / 40 px. */
export function IconButton({ icon, label, look = 'surface', size = 'lg', href, onClick, badge, className }: { icon: string; label: string; look?: 'surface' | 'ink' | 'muted'; size?: 'lg' | 'md'; href?: string; onClick?: () => void; badge?: boolean; className?: string }) {
  const cls = cx(
    'relative inline-flex shrink-0 items-center justify-center rounded-full',
    size === 'lg' ? 'size-12' : 'size-10',
    look === 'surface' && 'bg-surface border border-border text-text',
    look === 'ink' && 'bg-ink text-on-ink',
    look === 'muted' && 'bg-surface-muted text-text',
    className,
  );
  const inner = (
    <>
      <Icon name={icon} size={size === 'lg' ? 22 : 20} />
      {badge ? <span className="absolute right-[11px] top-[10px] size-2 rounded-full bg-expense ring-2 ring-surface" aria-hidden /> : null}
    </>
  );
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Figma "Action Pill": ink pill with a white icon circle (Expense / Income on the balance card). */
export function ActionPill({ icon, label, href, onClick }: { icon: string; label: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="grid size-[34px] place-items-center rounded-full bg-on-ink text-ink">
        <Icon name={icon} size={18} />
      </span>
      <span className="t-button-s">{label}</span>
    </>
  );
  const cls = 'inline-flex h-[46px] flex-1 items-center gap-2.5 rounded-full bg-ink pl-1.5 pr-[18px] text-on-ink';
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/* ───────────── Tags, chips, pills ───────────── */

export type Tone = 'positive' | 'warning' | 'error' | 'neutral' | 'brand' | 'info' | 'savings';

/** Figma "Tag": 24 px pill — Positive / Warning / Error / Neutral (+ brand, info, savings). */
export function Tag({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: string }) {
  const t = {
    positive: 'bg-income-soft text-income',
    warning: 'bg-warning-soft text-warning',
    error: 'bg-error-soft text-error',
    neutral: 'bg-surface-muted text-text-secondary',
    brand: 'bg-brand text-on-brand',
    info: 'bg-info-soft text-info',
    savings: 'bg-savings-soft text-savings',
  }[tone];
  return (
    <span className={cx('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 t-caption-m whitespace-nowrap', t)}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

/** Figma "Filter Chip": 38 px pill; selected = ink. */
export function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx('h-[38px] shrink-0 rounded-full px-4 t-label', selected ? 'bg-ink text-on-ink' : 'border border-border bg-surface text-text')}
    >
      {children}
    </button>
  );
}

/** Figma "Dropdown Pill": Outline or Muted, 36 px, with chevron. */
export function DropdownPill({ label, onClick, look = 'outline', ariaLabel }: { label: string; onClick: () => void; look?: 'outline' | 'muted'; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-3.5 pr-3 t-label', look === 'outline' ? 'border border-border bg-surface' : 'bg-surface-muted')}
    >
      {label}
      <Icon name="chevron-down" size={16} />
    </button>
  );
}

/** Figma "Segmented — Type" (Expense / Income / …), 54 px. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-[54px] gap-1 rounded-full border border-border bg-surface p-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cx('flex flex-1 items-center justify-center gap-2 rounded-full t-button-s', on ? 'bg-ink text-on-ink' : 'text-text-secondary')}
          >
            {o.icon ? <Icon name={o.icon} size={18} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Figma "Toggle": 48×28, ink when on. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-ink' : 'bg-disabled')}
    >
      <span className={cx('absolute top-[3px] size-[22px] rounded-full bg-white shadow transition-[left]', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

/** Figma "Category Icon": 44 px circle tinted 12% with the category colour. */
export function CategoryIcon({ categoryId, kind, size = 44 }: { categoryId?: string | null; kind?: 'transfer' | 'income' | 'savings'; size?: number }) {
  const cat = getCategory(categoryId);
  const color = kind === 'transfer' || kind === 'savings' ? 'var(--savings)' : kind === 'income' && !cat ? 'var(--income)' : cat?.id === 'housing' ? 'var(--text)' : (cat?.color ?? 'var(--text-secondary)');
  const icon = kind === 'savings' ? 'piggy-bank' : kind === 'transfer' ? 'arrow-left-right' : (cat?.icon ?? 'tag');
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, color }}>
      <span className="absolute inset-0 rounded-full" style={{ background: color, opacity: cat?.id === 'housing' ? 0.08 : 0.12 }} />
      <Icon name={icon} size={Math.round(size * 0.45)} className="relative" />
    </span>
  );
}

/** Figma "Progress Bar": 8 px track; colour follows state. */
export function ProgressBar({ value, tone = 'ink', label, height = 8 }: { value: number; tone?: 'ink' | 'brand' | 'warning' | 'error' | 'savings' | 'income'; label: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = { ink: 'bg-ink', brand: 'bg-brand', warning: 'bg-warning', error: 'bg-error', savings: 'bg-savings', income: 'bg-income' }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="w-full overflow-hidden rounded-full bg-surface-muted" style={{ height }}>
      <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────────── Inputs ───────────── */

/** Figma "Input Field": label, 54 px field with leading icon, helper/error. */
export function InputField({ label, icon, error, helper, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: string; error?: string; helper?: string }) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="t-label text-text-secondary">
        {label}
      </label>
      <div className={cx('flex h-[54px] items-center gap-2.5 rounded-[16px] bg-surface px-4', error ? 'border-[1.5px] border-error' : 'border border-border focus-within:border-[1.5px] focus-within:border-ink')}>
        {icon ? <Icon name={icon} size={20} className="shrink-0 text-text-muted" /> : null}
        <input id={id} {...input} aria-invalid={!!error} aria-describedby={error || helper ? msg : undefined} className="t-input h-full min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-muted" />
      </div>
      {error ? (
        <p id={msg} role="alert" className="flex items-center gap-1.5 t-caption text-error">
          <Icon name="circle-alert" size={14} />
          {error}
        </p>
      ) : helper ? (
        <p id={msg} className="t-caption text-text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/** A field that opens a picker (category, account, date). */
export function PickerField({ label, icon, value, placeholder, onClick, error, children }: { label: string; icon?: ReactNode; value?: string; placeholder: string; onClick: () => void; error?: string; children?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="t-label text-text-secondary">
        {label}
      </span>
      <button
        type="button"
        aria-labelledby={id}
        aria-haspopup="dialog"
        onClick={onClick}
        className={cx('flex h-[54px] items-center gap-2.5 rounded-[16px] bg-surface px-4 text-left', error ? 'border-[1.5px] border-error' : 'border border-border')}
      >
        {icon}
        <span className={cx('t-input min-w-0 flex-1 truncate', value ? 'text-text' : 'text-text-muted')}>{value || placeholder}</span>
        {children ?? <Icon name="chevron-down" size={18} className="text-text-muted" />}
      </button>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 t-caption text-error">
          <Icon name="circle-alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Figma "Search Field": 52 px pill with search icon and a filter button. */
export function SearchField({ value, onChange, placeholder, onFilter, filterActive }: { value: string; onChange: (v: string) => void; placeholder: string; onFilter?: () => void; filterActive?: boolean }) {
  return (
    <div className="flex h-[52px] items-center gap-2.5 rounded-full border border-border bg-surface pl-[18px] pr-1.5">
      <Icon name="search" size={20} className="shrink-0 text-text-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="t-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted" />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="grid size-8 place-items-center rounded-full text-text-muted">
          <Icon name="x" size={18} />
        </button>
      ) : null}
      {onFilter ? (
        <button type="button" aria-label="More filters" onClick={onFilter} className={cx('relative grid size-10 shrink-0 place-items-center rounded-full', filterActive ? 'bg-ink text-on-ink' : 'bg-surface-muted text-text')}>
          <Icon name="sliders" size={20} />
        </button>
      ) : null}
    </div>
  );
}

/* ───────────── Layout pieces ───────────── */

/** Figma "Top Bar": circular back button, centred 18 px title, optional right action. */
export function TopBar({ title, back, right }: { title: string; back?: string | (() => void); right?: ReactNode }) {
  const router = useRouter();
  const onBack = typeof back === 'function' ? back : () => (back ? router.push(back) : router.back());
  return (
    <header className="flex h-12 items-center justify-between gap-2">
      <IconButton icon="arrow-left" label="Back" onClick={onBack} />
      <h1 className="t-title min-w-0 flex-1 truncate text-center">{title}</h1>
      {right ?? <span className="size-12 shrink-0" aria-hidden />}
    </header>
  );
}

/** Large left-aligned page title for tab roots ("Transactions", "Budgets"…). */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-3">
      <h1 className="t-page">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-[22px] bg-surface', className)}>{children}</As>;
}

export function SectionHeader({ title, href, linkLabel = 'See all', id }: { title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="t-section">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 t-body text-text-secondary">
          {linkLabel}
          <Icon name="chevron-right" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

/** Figma "Stat Tile": compact grey tile with label and amount. */
export function StatTile({ label, value, children, tone }: { label: string; value: string; children?: ReactNode; tone?: 'income' | 'expense' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[16px] bg-surface-muted p-4">
      <span className="t-caption text-text-secondary">{label}</span>
      <span className={cx('t-amount-m num truncate', tone === 'income' && 'text-income', tone === 'expense' && 'text-expense')}>{value}</span>
      {children}
    </div>
  );
}

/** Figma "List Row": icon tile, label, value and chevron / toggle. */
export function ListRow({ icon, label, value, href, onClick, trailing, danger }: { icon: string; label: string; value?: string; href?: string; onClick?: () => void; trailing?: ReactNode; danger?: boolean }) {
  const body = (
    <>
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-[12px]', danger ? 'bg-error-soft text-error' : 'bg-surface-muted text-text')}>
        <Icon name={icon} size={20} />
      </span>
      <span className={cx('t-item min-w-0 flex-1 truncate text-left', danger && 'text-error')}>{label}</span>
      {value ? <span className="t-body shrink-0 text-text-muted">{value}</span> : null}
      {trailing ?? (href || onClick ? <Icon name="chevron-right" size={18} className="shrink-0 text-text-muted" /> : null)}
    </>
  );
  const cls = 'flex min-h-16 w-full items-center gap-3 px-4 py-3';
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/** Figma "Empty State": icon disc, title, message, optional action. */
export function EmptyState({ icon, title, message, action }: { icon: string; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface text-text-secondary">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="t-section">{title}</h2>
      <p className="t-body max-w-[280px] text-text-secondary">{message}</p>
      {action}
    </div>
  );
}

export function Banner({ tone = 'warning', icon = 'triangle-alert', children, href }: { tone?: 'warning' | 'info' | 'error' | 'ink'; icon?: string; children: ReactNode; href?: string }) {
  const t = { warning: 'bg-warning-soft text-text', info: 'bg-info-soft text-text', error: 'bg-error-soft text-text', ink: 'bg-ink text-on-ink' }[tone];
  const ic = { warning: 'text-warning', info: 'text-info', error: 'text-error', ink: 'text-brand' }[tone];
  const body = (
    <>
      <Icon name={icon} size={20} className={cx('mt-px shrink-0', ic)} />
      <div className="min-w-0 flex-1 t-body">{children}</div>
      {href ? <Icon name="chevron-right" size={18} className="shrink-0 opacity-70" /> : null}
    </>
  );
  const cls = cx('flex items-start gap-3 rounded-[16px] px-4 py-3.5', t);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
