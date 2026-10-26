'use client';

import { useMemo } from 'react';

import { formatDate, formatDayLabel, formatLongDate, formatShortDate, type LocalDate } from '@/domain/dates';
import { formatMoney, type Cents, type CurrencyCode } from '@/domain/money';
import { useStore } from './store';

/** Formatting bound to the user's preferences (date style). */
export function useFormat() {
  const { data } = useStore();
  const style = data.settings.dateStyle;
  return useMemo(
    () => ({
      money: (c: Cents, cur: CurrencyCode, o?: Parameters<typeof formatMoney>[2]) => formatMoney(c, cur, o),
      day: (d: LocalDate) => formatDayLabel(d, style),
      short: (d: LocalDate) => formatShortDate(d, style),
      date: (d: LocalDate) => formatDate(d, style),
      long: (d: LocalDate) => formatLongDate(d, style),
      style,
    }),
    [style],
  );
}
