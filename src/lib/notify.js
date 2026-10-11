// System notifications while the app is open (or running in the background on the phone). They tell the
// in-charge about a new leave application, and give one morning summary of what needs doing.
// NOTE: this is not server push — nothing arrives while the app is fully closed (that needs a server).

import { fmtDate } from './format';

const KEY = 'xi_notify'; // 'on' | 'off'
const STATE_KEY = 'xi_notify_state';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
export const permission = () => (notifySupported() ? Notification.permission : 'unsupported'); // default | granted | denied | unsupported
export const isEnabled = () => {
  try {
    return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};

/** Ask the browser; only turns on when the user allows it */
export async function enableNotifications() {
  if (!notifySupported()) return { ok: false, reason: 'unsupported' };
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') return { ok: false, reason: p };
  try {
    localStorage.setItem(KEY, 'on');
  } catch {
    /* ignore */
  }
  return { ok: true };
}
export const disableNotifications = () => {
  try {
    localStorage.setItem(KEY, 'off');
  } catch {
    /* ignore */
  }
};

/** Show one notification through the service worker (works with the app in the background) */
export async function showNotification({ title, body, tag, tab }) {
  if (!isEnabled()) return false;
  const options = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', lang: 'bn', renotify: false, data: { tab: tab || '' } };
  try {
    // no service worker registered (dev builds): don't wait for one that never comes
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('no service worker')), 1500))]);
    await reg.showNotification(title, options);
    return true;
  } catch {
    try {
      new Notification(title, options); // eslint-disable-line no-new
      return true;
    } catch {
      return false;
    }
  }
}

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
};
const write = (s) => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};
export const loadState = (classId) => read()[classId] || null;
export const saveState = (classId, state) => write({ ...read(), [classId]: state });

/**
 * Decides which notifications to show now, and what to remember so none is shown twice.
 *
 * @param now        Date
 * @param today      'YYYY-MM-DD'
 * @param leaves     pending leave applications [{ id, studentName, from, to }]
 * @param reminders  { overdue, upcoming } how many guardians are due a reminder
 * @param attendance { taken: bool, active: number }
 * @param state      what was remembered last time (null the first time)
 * @returns {{ alerts: [{ key, title, body, tag, tab }], state }}
 */
export function planNotifications({ now, today, leaves, reminders, attendance, closedToday, cashToday, state }) {
  const next = { leaves: [...(state?.leaves || [])], days: { ...(state?.days || {}) } };
  const alerts = [];
  const hour = now.getHours();
  const friday = now.getDay() === 5; // weekly holiday

  // New leave applications. The first time, whatever is already waiting is remembered silently.
  const known = new Set(state?.leaves || []);
  const fresh = leaves.filter((l) => !known.has(l.id));
  fresh.forEach((l) => next.leaves.push(l.id));
  next.leaves = next.leaves.slice(-300);
  if (state && fresh.length) {
    alerts.push({
      key: `leave:${fresh.map((l) => l.id).join(',')}`,
      title: fresh.length === 1 ? 'নতুন ছুটির আবেদন' : `${fresh.length}টি নতুন ছুটির আবেদন`,
      body: fresh.length === 1 ? `${fresh[0].studentName} · ${fmtDate(fresh[0].from, { year: false })}${fresh[0].to && fresh[0].to !== fresh[0].from ? ` – ${fmtDate(fresh[0].to, { year: false })}` : ''}` : fresh.slice(0, 3).map((l) => l.studentName).join(', '),
      tag: 'leave',
      tab: 'leaves',
    });
  }

  // One summary a day, from 8am, if there is anything to do
  const did = next.days[today] || {};
  const lines = [];
  if (reminders.overdue > 0) lines.push(`${reminders.overdue} জনের শেষ তারিখ পার হয়েছে`);
  if (reminders.upcoming > 0) lines.push(`${reminders.upcoming} জনের শেষ তারিখ ২ দিনের মধ্যে`);
  if (!attendance.taken && attendance.active > 0 && !friday && hour >= 9) lines.push('আজকের হাজিরা নেওয়া হয়নি');
  if (hour >= 8 && lines.length && !did.digest) {
    alerts.push({ key: `digest:${today}`, title: 'আজকের কাজ', body: lines.join(' · '), tag: 'digest', tab: 'dashboard' });
    did.digest = true;
  }
  // A nudge later in the morning if attendance is still missing
  if (hour >= 11 && !attendance.taken && attendance.active > 0 && !friday && !did.attendance) {
    alerts.push({ key: `att:${today}`, title: 'হাজিরা বাকি', body: `${attendance.active} জন শিক্ষার্থীর আজকের হাজিরা এখনো নেওয়া হয়নি`, tag: 'attendance', tab: 'attendance' });
    did.attendance = true;
  }
  // End of the day: cash received but not closed
  if (hour >= 16 && cashToday > 0 && !closedToday && !did.close) {
    alerts.push({ key: `close:${today}`, title: 'ক্যাশ ক্লোজ করুন', body: 'আজকের আদায় মিলিয়ে দিন ক্লোজ করা হয়নি', tag: 'close', tab: 'payments' });
    did.close = true;
  }

  // Keep a week of daily marks, no more
  next.days[today] = did;
  Object.keys(next.days).sort().slice(0, -7).forEach((d) => delete next.days[d]);
  return { alerts, state: next };
}
