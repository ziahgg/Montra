/**
 * Local-first persistence in IndexedDB (one versioned document per device).
 * Data never leaves the browser: there is no account, sync or encryption.
 */
import type { MontraData } from '@/domain/types';
import { buildSeed, DATA_VERSION } from './seed';

const DB = 'montra';
const STORE = 'kv';
const KEY = 'data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Light structural check so a corrupted or foreign record isn't trusted. */
export function isValidData(v: unknown): v is MontraData {
  if (!v || typeof v !== 'object') return false;
  const d = v as Partial<MontraData>;
  return (
    typeof d.version === 'number' &&
    Array.isArray(d.accounts) &&
    Array.isArray(d.transactions) &&
    Array.isArray(d.budgets) &&
    Array.isArray(d.goals) &&
    Array.isArray(d.notifications) &&
    !!d.settings &&
    d.transactions.every((t) => t && typeof t.id === 'string' && Number.isSafeInteger(t.amount) && t.amount > 0 && typeof t.at === 'string')
  );
}

/** Upgrades older documents. Version 1 is the first schema, so this is the hook for future changes. */
function migrate(d: MontraData): MontraData {
  return d.version === DATA_VERSION ? d : { ...d, version: DATA_VERSION };
}

export interface LoadResult {
  data: MontraData;
  source: 'stored' | 'seed' | 'recovered';
}

export async function loadData(): Promise<LoadResult> {
  try {
    const raw = await run<unknown>('readonly', (s) => s.get(KEY));
    if (raw === undefined) {
      const seed = buildSeed();
      await saveData(seed);
      return { data: seed, source: 'seed' };
    }
    if (isValidData(raw) && raw.version <= DATA_VERSION) return { data: migrate(raw), source: 'stored' };
    // Unreadable data: keep a copy for inspection, then start from the sample data.
    await run('readwrite', (s) => s.put(raw, `${KEY}:corrupt:${Date.now()}`));
    const seed = buildSeed();
    await saveData(seed);
    return { data: seed, source: 'recovered' };
  } catch {
    // IndexedDB unavailable (e.g. private mode restrictions): work in memory for this session.
    return { data: buildSeed(), source: 'seed' };
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Writes are serialised so a slow write can't overwrite a newer one. */
export function saveData(data: MontraData): Promise<void> {
  const next = queue.then(() => run('readwrite', (s) => s.put(data, KEY))).then(() => undefined);
  queue = next.catch(() => undefined);
  return next;
}
