'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { buildSeed } from '@/data/seed';
import { loadData, saveData } from '@/data/storage';
import type { Ctx } from '@/domain/actions';
import { nowLocal, todayLocal } from '@/domain/dates';
import type { MontraData } from '@/domain/types';

interface Store {
  data: MontraData;
  ready: boolean;
  /** "Today" for budget periods and labels. */
  today: string;
  ctx: () => Ctx;
  /** Applies a pure update and persists it. Returns whatever the update returned. */
  apply: <R>(fn: (d: MontraData, ctx: Ctx) => { data: MontraData } & R) => R;
  set: (fn: (d: MontraData, ctx: Ctx) => MontraData) => void;
  resetSampleData: () => Promise<void>;
  saveError: boolean;
}

const StoreContext = createContext<Store | null>(null);

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MontraData>(() => buildSeed());
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Read the clock only on the client (after mount) so prerendering stays static.
  const [today, setToday] = useState('');
  // Latest committed data, read by actions so rapid successive updates never use a stale copy.
  const latest = useRef(data);

  useEffect(() => {
    let alive = true;
    void loadData().then((r) => {
      if (!alive) return;
      latest.current = r.data;
      setToday(todayLocal());
      setData(r.data);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  const ctx = useCallback((): Ctx => ({ stamp: new Date().toISOString(), now: nowLocal(), id: newId }), []);

  const persist = useCallback((next: MontraData) => {
    latest.current = next;
    setData(next);
    saveData(next)
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  }, []);

  const apply = useCallback(
    <R,>(fn: (d: MontraData, c: Ctx) => { data: MontraData } & R): R => {
      // Validation errors throw here, before anything is saved.
      const result = fn(latest.current, ctx());
      persist(result.data);
      return result;
    },
    [ctx, persist],
  );

  const set = useCallback((fn: (d: MontraData, c: Ctx) => MontraData) => apply((d, c) => ({ data: fn(d, c) })), [apply]);

  const resetSampleData = useCallback(async () => {
    const seed = buildSeed();
    persist({ ...seed, settings: { ...seed.settings, onboarded: true } });
  }, [persist]);

  const value = useMemo(() => ({ data, ready, today, ctx, apply, set, resetSampleData, saveError }), [data, ready, today, ctx, apply, set, resetSampleData, saveError]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
