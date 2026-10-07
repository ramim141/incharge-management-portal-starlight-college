import React, { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { Button } from './ui';

// "Install this app" banner: Android/desktop Chrome get a one-tap install button; iPhone Safari
// (which has no install API) gets the Share → Add to Home Screen steps.
const DISMISS_KEY = 'xi_install_dismissed';
const SNOOZE_DAYS = 7;

let deferred = null;
const listeners = new Set();

/** Call once at startup, before React renders */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own banner instead of Chrome's mini-bar
    deferred = e;
    listeners.forEach((cb) => cb());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((cb) => cb());
  });
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOSSafari = () => isIOS() && !/crios|fxios|edgios/i.test(navigator.userAgent);

const snoozed = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < SNOOZE_DAYS * 86400000;
  } catch {
    return false;
  }
};

export function InstallPrompt() {
  const [, rerender] = useState(0);
  const [hidden, setHidden] = useState(() => isStandalone() || snoozed());
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — it just shows again next visit */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === 'accepted') setHidden(true);
    else dismiss();
  };

  const ios = isIOSSafari();
  if (hidden || (!deferred && !ios)) return null;

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-[150] mx-auto max-w-[480px] px-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="animate-sheet rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-bold text-ink">অ্যাপটি ফোনে ইনস্টল করুন</p>
            <p className="text-[13px] leading-snug text-slate-500">হোম স্ক্রিন থেকে এক ট্যাপে খুলবে — অ্যাপের মতো, পুরো স্ক্রিনে</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="এখন না" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {ios ? (
          iosHelp ? (
            <ol className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3 text-[13.5px] text-slate-700">
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">১</span>
                নিচের <Share className="mx-0.5 inline h-4 w-4 text-brand-600" /> <b>Share</b> বোতাম চাপুন
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">২</span>
                <SquarePlus className="inline h-4 w-4 text-brand-600" /> <b>Add to Home Screen</b> বাছুন
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[12px] font-bold text-white">৩</span>
                ডানে উপরে <b>Add</b> চাপুন
              </li>
            </ol>
          ) : (
            <Button block className="mt-3" icon={Download} onClick={() => setIosHelp(true)}>
              কীভাবে ইনস্টল করবেন
            </Button>
          )
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={dismiss}>
              এখন না
            </Button>
            <Button icon={Download} onClick={install}>
              ইনস্টল
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
