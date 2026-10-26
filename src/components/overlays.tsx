'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from './Icon';
import { Button, IconButton, cx } from './ui';

/* ───────────── Sheet ───────────── */

/** Bottom sheet with the Figma "Sheet Header" (title + close). Escape and the scrim close it. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[var(--scrim)] anim-fade" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet absolute bottom-0 flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[28px] bg-surface outline-none"
      >
        <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-border" aria-hidden />
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-3">
          <h2 className="t-title">{title}</h2>
          <IconButton icon="x" label="Close" look="muted" size="md" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? <div className="shrink-0 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ───────────── Confirm dialog ───────────── */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  icon = 'trash',
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[var(--scrim)] anim-fade" aria-hidden onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative flex w-full max-w-[342px] flex-col items-center gap-3 rounded-[28px] bg-surface p-6 text-center anim-fade">
        <span className="grid size-[60px] place-items-center rounded-full bg-error-soft text-error">
          <Icon name={icon} size={26} />
        </span>
        <h2 id="confirm-title" className="t-section">
          {title}
        </h2>
        <div className="t-body text-text-secondary">{message}</div>
        <div className="mt-2 flex w-full flex-col gap-2.5">
          <button ref={confirmRef} type="button" onClick={onConfirm} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-error-soft t-button text-error">
            <Icon name={icon} size={20} />
            {confirmLabel}
          </button>
          <Button variant="secondary" full onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Toast ───────────── */

type ToastKind = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

/** Figma "Toast": ink card, coloured icon disc, title + message. Announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: Omit<ToastMsg, 'id'>) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 6000 : 3500);
  }, []);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);
  const icon = { success: { name: 'circle-check', bg: 'bg-income', fg: 'text-white' }, error: { name: 'circle-alert', bg: 'bg-error', fg: 'text-white' }, info: { name: 'info', bg: 'bg-brand', fg: 'text-on-brand' } };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-5">
        {toast ? (
          <div key={toast.id} role="status" className="anim-toast pointer-events-auto flex w-full max-w-[390px] items-center gap-3 rounded-[20px] bg-[#121316] py-3 pr-4 pl-3 text-white shadow-[var(--toast-shadow)]">
            <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', icon[toast.kind].bg, icon[toast.kind].fg)}>
              <Icon name={icon[toast.kind].name} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-5 font-medium">{toast.title}</p>
              {toast.message ? <p className="truncate t-caption text-white/70">{toast.message}</p> : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="shrink-0 t-button-s text-[#F8DC3B]"
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastCtx.Provider>
  );
}
