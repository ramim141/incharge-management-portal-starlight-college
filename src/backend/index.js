import { getFirebaseConfig } from '../firebase';
import { createFirebaseBackend } from './firebaseBackend';
import { createLocalBackend } from './localBackend';

// Firebase when it's configured in .env, otherwise the on-device demo.
const config = getFirebaseConfig();
export const backend = config ? createFirebaseBackend(config) : createLocalBackend();
export const isDemo = backend.mode === 'local';

/** Human-readable Bangla message for auth / storage errors */
export const errorText = (e) => {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
    'auth/wrong-password': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই',
    'auth/invalid-email': 'ইমেইল ঠিকানা সঠিক নয়',
    'auth/email-already-in-use': 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই',
    'auth/demo-mode': 'ডেমো মোডে ইমেইল পাঠানো যায় না',
    'permission-denied': 'এই কাজের অনুমতি আপনার নেই',
    'storage/quota': 'ফোনের জায়গা শেষ — ব্যাকআপ নিয়ে কিছু তথ্য মুছুন',
    unavailable: 'সার্ভারে পৌঁছানো যাচ্ছে না — ইন্টারনেট এলে আপনাআপনি সিঙ্ক হবে',
  };
  return map[code] || e?.message || 'কিছু একটা ভুল হয়েছে';
};
