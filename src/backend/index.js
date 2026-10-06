import { getFirebaseConfig } from '../firebase';
import { createFirebaseBackend } from './firebaseBackend';
import { createLocalBackend } from './localBackend';

// The app runs on Firebase (keys in .env.local). For offline testing only, VITE_LOCAL_TEST_DB=true
// starts an empty database inside this browser instead. With neither, the app shows a setup screen.
const config = getFirebaseConfig();
const localTest = !config && import.meta.env.VITE_LOCAL_TEST_DB === 'true';

/** True when no backend is configured: App shows the "Firebase setup pending" screen */
export const backendMissing = !config && !localTest;

const missing = () => {
  throw Object.assign(new Error('Firebase is not configured'), { code: 'app/not-configured' });
};
// Inert stand-in so module-level imports don't crash before the setup screen renders
const unconfigured = {
  mode: 'none',
  onError: () => () => {},
  onAuth: () => () => {},
  subscribeDoc: () => () => {},
  subscribeCollection: () => () => {},
  getDoc: missing,
  getCollection: missing,
  write: missing,
  signIn: missing,
  signOut: missing,
  resetPassword: missing,
  createAccount: missing,
  changePassword: missing,
  requestEmailChange: missing,
};

export const backend = config ? createFirebaseBackend(config) : localTest ? createLocalBackend() : unconfigured;
/** Local test database (this browser only) — never used once Firebase keys are set */
export const isLocal = backend.mode === 'local';

/** Human-readable Bangla message for auth / storage errors */
export const errorText = (e) => {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'লগইন আইডি বা পাসওয়ার্ড সঠিক নয়',
    'auth/wrong-password': 'লগইন আইডি বা পাসওয়ার্ড সঠিক নয়',
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই',
    'auth/invalid-email': 'ইমেইল ঠিকানা সঠিক নয়',
    'auth/email-already-in-use': 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই',
    'auth/operation-not-allowed': 'Firebase-এ Email/Password লগইন চালু করা হয়নি',
    'auth/local-mode': 'পরীক্ষামূলক ডাটাবেজে ইমেইল পাঠানো যায় না',
    'auth/unknown-id': 'এই লগইন আইডি পাওয়া যায়নি',
    'auth/no-recovery-email': 'এই আইডিতে কোনো রিকভারি ইমেইল নেই — নতুন পাসওয়ার্ডের জন্য অধ্যক্ষের সাথে যোগাযোগ করুন',
    'auth/requires-recent-login': 'নিরাপত্তার জন্য আবার লগইন করে চেষ্টা করুন',
    'auth/missing-password': 'পাসওয়ার্ড দিন',
    'app/not-configured': 'Firebase সেটআপ করা হয়নি',
    'permission-denied': 'এই কাজের অনুমতি আপনার নেই',
    'storage/quota': 'ফোনের জায়গা শেষ — ব্যাকআপ নিয়ে কিছু তথ্য মুছুন',
    unavailable: 'সার্ভারে পৌঁছানো যাচ্ছে না — ইন্টারনেট এলে আপনাআপনি সিঙ্ক হবে',
  };
  return map[code] || e?.message || 'কিছু একটা ভুল হয়েছে';
};
