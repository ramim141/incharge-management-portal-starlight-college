import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, CloudCheck } from 'lucide-react';
import { backend } from '../backend';
import { describeSync } from '../lib/sync';
import { cx } from './ui';

const STYLE = {
  offline: { cls: 'bg-amber-500 text-white', icon: WifiOff },
  syncing: { cls: 'bg-ink/90 text-white', icon: RefreshCw },
  done: { cls: 'bg-emerald-600 text-white', icon: CloudCheck },
};

/**
 * A small pill at the top: offline (work continues, saved on the device), syncing, or "all synced"
 * for a moment after the connection catches up. Silent when nothing is going on.
 */
export function SyncStatus() {
  const [state, setState] = useState({ online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0 });
  const [justSynced, setJustSynced] = useState(false);
  const [settled, setSettled] = useState(true); // a pending write that clears at once is not worth a flash
  const wasBusy = useRef(false);

  useEffect(() => backend.onSync?.(setState), []);
  useEffect(() => {
    const on = () => setState((s) => ({ ...s, online: true }));
    const off = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const busy = !state.online || state.pending > 0;
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      setJustSynced(false);
      // online + pending: wait a moment before showing "syncing"
      const t = setTimeout(() => setSettled(false), state.online ? 900 : 0);
      return () => clearTimeout(t);
    }
    setSettled(true);
    if (wasBusy.current) {
      wasBusy.current = false;
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [busy, state.online]);

  const view = describeSync({ online: state.online, pending: state.pending, justSynced });
  if (!view.kind || (view.kind === 'syncing' && settled)) return null;
  const { cls, icon: Icon } = STYLE[view.kind];

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }} role="status" aria-live="polite">
      <span className={cx('animate-toast flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold shadow-lift', cls)}>
        <Icon className={cx('h-4 w-4 shrink-0', view.kind === 'syncing' && 'animate-spin')} />
        <span className="truncate">{view.text}</span>
      </span>
    </div>
  );
}
