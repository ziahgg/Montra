'use client';

import { useId } from 'react';

/** Smooth (monotone-ish cubic) SVG path through points. */
function smooth(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

/**
 * Cash-flow line chart from the Reports frame: green income and orange expense
 * lines over months, gridlines with compact labels, and value badges on the last point.
 */
export function LineChart({
  labels,
  series,
  formatAxis,
  formatValue,
  summary,
  active,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  formatAxis: (v: number) => string;
  formatValue: (v: number) => string;
  summary: string;
  active: number;
}) {
  const W = 318;
  const H = 150;
  const left = 34;
  const right = 18;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / (2 * step)) * 2 * step || 1;
  const ticks = [0, top / 3, (top * 2) / 3, top];
  const x = (i: number) => (labels.length === 1 ? left + (W - left - right) / 2 : left + (i * (W - left - right)) / (labels.length - 1));
  const y = (v: number) => 8 + (H - 16) * (1 - v / top);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H + 4}`} className="h-auto w-full overflow-visible" role="img" aria-label={summary}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--divider)" strokeWidth={1} />
            <text x={0} y={y(t) + 4} className="t-chart" fill="var(--text-muted)">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        <line x1={x(active)} x2={x(active)} y1={4} y2={H} stroke="var(--text-muted)" strokeDasharray="3 3" strokeWidth={1} />
        {series.map((s) => (
          <g key={s.name}>
            <path d={smooth(s.values.map((v, i) => [x(i), y(v)]))} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={x(active)} cy={y(s.values[active] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        ))}
        {series.map((s, si) => {
          const v = s.values[active] ?? 0;
          const label = formatValue(v);
          const w = label.length * 7 + 18;
          const bx = Math.min(W - w + 6, Math.max(left, x(active) - w - 8));
          const by = y(v) - 12 + (si === 0 && series.length > 1 && Math.abs(y(series[1].values[active] ?? 0) - y(v)) < 26 ? -14 : 0);
          return (
            <g key={`b-${s.name}`}>
              <rect x={bx} y={by} width={w} height={24} rx={12} fill={si === 0 ? 'var(--ink)' : 'var(--surface)'} stroke={si === 0 ? 'none' : 'var(--border)'} />
              <text x={bx + w / 2} y={by + 16} textAnchor="middle" className="t-label num" fill={si === 0 ? 'var(--on-ink)' : 'var(--text)'}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Donut for spending by category; segments are clipped with small gaps like the design. */
export function Donut({ segments, size = 128, thickness = 22, label, children }: { segments: { value: number; color: string; name: string }[]; size?: number; thickness?: number; label: string; children?: React.ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={thickness} />
        {total > 0
          ? segments.map((s) => {
              const len = (s.value / total) * c;
              const gap = segments.length > 1 ? Math.min(3, len / 3) : 0;
              const el = <circle key={s.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Progress ring (goal details). */
export function Ring({ value, size = 172, thickness = 16, color = 'var(--savings)', label, children }: { value: number; size?: number; thickness?: number; color?: string; label: string; children?: React.ReactNode }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Weekly spending bars with a dashed limit line (budget details). */
export function WeekBars({ bars, limit, format, label }: { bars: { label: string; value: number }[]; limit: number; format: (v: number) => string; label: string }) {
  const id = useId();
  const H = 120;
  const max = Math.max(limit, ...bars.map((b) => b.value), 1) * 1.15;
  const ly = H - (limit / max) * H;
  return (
    <div className="relative" role="img" aria-label={label} aria-describedby={id}>
      <div className="relative flex h-[150px] items-end gap-3 pt-6">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-text-muted" style={{ top: 24 + ly }} aria-hidden />
        {bars.map((b) => {
          const over = b.value > limit;
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: H }}>
              <span className="t-caption-m num text-text">{format(b.value)}</span>
              <div className={over ? 'w-full rounded-[10px] bg-chart-expense' : 'w-full rounded-[10px] bg-ink'} style={{ height: Math.max(4, (b.value / max) * H) }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3" id={id}>
        {bars.map((b) => (
          <span key={b.label} className="flex-1 text-center t-caption text-text-muted">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
