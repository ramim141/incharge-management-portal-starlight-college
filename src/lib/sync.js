// What the "are my changes safe?" pill should say. The app keeps working offline (Firestore saves
// every change on the device first and sends it when the connection returns); this only tells the
// user what is going on.

/**
 * @param online      is the device connected
 * @param pending     changes made here that the server has not confirmed yet
 * @param justSynced  true for a few seconds after the last pending change got through
 * @returns {{ kind: 'offline'|'syncing'|'done'|null, text: string }}
 */
export function describeSync({ online, pending, justSynced }) {
  if (!online) {
    return { kind: 'offline', text: pending > 0 ? `অফলাইন · ${pending}টি পরিবর্তন সেভ আছে, নেট এলে সিঙ্ক হবে` : 'অফলাইন · কাজ চলবে, নেট এলে সিঙ্ক হবে' };
  }
  if (pending > 0) return { kind: 'syncing', text: `সিঙ্ক হচ্ছে… (${pending})` };
  if (justSynced) return { kind: 'done', text: 'সব পরিবর্তন সিঙ্ক হয়েছে ✓' };
  return { kind: null, text: '' };
}

/** A write that has to be confirmed by the server (restore, a guardian's application) cannot wait for a connection that is not there */
export const OFFLINE_MESSAGE = 'ইন্টারনেট নেই — সংযোগ এলে আবার চেষ্টা করুন';
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Rejects after `ms` instead of waiting forever on a bad connection */
export const withTimeout = (promise, ms = 15000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'app/timeout' })), ms))]);
