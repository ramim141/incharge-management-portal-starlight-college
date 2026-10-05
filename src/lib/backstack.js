import { useEffect, useRef } from 'react';

// Lets the Android back button / back gesture close the top-most sheet or
// return to Home, instead of leaving the app.
//
// Each active layer owns one history entry. Closing a layer from the UI pops its
// entry with history.back(); because that is async, new pushes wait until every
// pending back() has landed so entries never interleave.
const stack = [];
let ignorePops = 0;
const waiting = [];

const flush = () => {
  if (ignorePops > 0) return;
  while (waiting.length) waiting.shift()();
};

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      flush();
      return;
    }
    const top = stack.pop();
    if (top) {
      top.closedByBack = true;
      top.run();
    }
  });
}

export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    const entry = { run: () => ref.current?.(), closedByBack: false, pushed: false, cancelled: false };

    const push = () => {
      if (entry.cancelled) return;
      stack.push(entry);
      window.history.pushState({ xiLayer: true }, '');
      entry.pushed = true;
    };
    // Deferred so React StrictMode's mount→unmount→mount doesn't leave stray entries
    const t = setTimeout(() => (ignorePops > 0 ? waiting.push(push) : push()), 0);

    return () => {
      clearTimeout(t);
      entry.cancelled = true;
      if (!entry.pushed) return;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!entry.closedByBack) {
        ignorePops += 1;
        window.history.back();
      }
    };
  }, [active]);
}
