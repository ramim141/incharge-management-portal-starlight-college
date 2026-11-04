import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, CloudCheck } from 'lucide-react';
import { backend } from '../backend';
import { describeSync } from '../lib/sync';
import { cx } from './ui';

const STYLE = {
  offline: { cls: 'bg-amber-500 text-white', icon: WifiOff },
  done: { cls: 'bg-emerald-600 text-white', icon: CloudCheck },
};

/**
 * A quiet pill at the top ONLY shown when offline or when connection restores.
 * Completely silent during normal online usage.
 */
export function SyncStatus() {
  const [state, setState] = useState({ online: typeof navigator === 'undefined' ? true : navigator.onLine, pending: 0 });
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => backend.onSync?.(setState), []);

  useEffect(() => {
    const on = () => {
      setState((s) => ({ ...s, online: true }));
      if (wasOffline.current) {
        wasOffline.current = false;
        setJustReconnected(true);
        const t = setTimeout(() => setJustReconnected(false), 2200);
        return () => clearTimeout(t);
      }
    };
    const off = () => {
      wasOffline.current = true;
      setState((s) => ({ ...s, online: false }));
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!state.online) {
      wasOffline.current = true;
    }
  }, [state.online]);

  const view = describeSync({ online: state.online, pending: state.pending, justSynced: justReconnected });
  if (!view.kind) return null;
  const { cls, icon: Icon } = STYLE[view.kind] || {};
  if (!Icon) return null;

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }} role="status" aria-live="polite">
      <span className={cx('animate-toast flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold shadow-lift', cls)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{view.text}</span>
      </span>
    </div>
  );
}

