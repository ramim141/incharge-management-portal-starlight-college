export const NOTICE_KINDS = {
  general: { bn: 'সাধারণ', tile: 'bg-brand-50 text-brand-600' },
  exam: { bn: 'পরীক্ষা', tile: 'bg-amber-50 text-amber-600' },
  holiday: { bn: 'ছুটি', tile: 'bg-emerald-50 text-emerald-600' },
  fee: { bn: 'ফি', tile: 'bg-rose-50 text-rose-600' },
};

export const NOTICE_TEMPLATES = [
  { kind: 'holiday', title: 'আগামীকাল ক্লাস বন্ধ', text: 'আগামীকাল কলেজ বন্ধ থাকবে। পরবর্তী ক্লাস যথারীতি শুরু হবে।' },
  { kind: 'exam', title: 'পরীক্ষার নোটিশ', text: 'পরীক্ষা শুরু হবে ... তারিখ থেকে। সবাইকে সময়মতো উপস্থিত থাকতে বলা হলো।' },
  { kind: 'fee', title: 'বেতন পরিশোধের অনুরোধ', text: 'এ মাসের বেতন ১০ তারিখের মধ্যে কলেজ অফিসে এসে পরিশোধ করুন।' },
  { kind: 'general', title: 'অভিভাবক সভা', text: 'অভিভাবক সভা ... তারিখে সকাল ১০টায়। অভিভাবকদের উপস্থিত থাকার অনুরোধ।' },
];

export const MAX_TITLE = 80;
export const MAX_TEXT = 1000;

/** What is wrong with a notice form, in Bangla — an empty list means fine */
export function validateNotice({ title, text, expiresOn }, today) {
  const errors = [];
  if (!String(title || '').trim()) errors.push('শিরোনাম লিখুন');
  else if (String(title).trim().length > MAX_TITLE) errors.push(`শিরোনাম ${MAX_TITLE} অক্ষরের মধ্যে লিখুন`);
  if (!String(text || '').trim()) errors.push('নোটিশের বিবরণ লিখুন');
  else if (String(text).trim().length > MAX_TEXT) errors.push(`বিবরণ ${MAX_TEXT} অক্ষরের মধ্যে লিখুন`);
  if (expiresOn && expiresOn < today) errors.push('মেয়াদের তারিখ আজকের আগে হতে পারে না');
  return errors;
}

export function newNotice({ id, title, text, kind = 'general', pinned = false, expiresOn = '', by = '', now = new Date() }) {
  return {
    id,
    title: String(title).trim(),
    text: String(text).trim(),
    kind: NOTICE_KINDS[kind] ? kind : 'general',
    pinned: !!pinned,
    expiresOn: expiresOn || '',
    createdBy: by,
    createdAt: now.toISOString(),
  };
}

/** A notice is shown until the end of its expiry day; none = until removed */
export const isActive = (n, today) => !n.expiresOn || n.expiresOn >= today;

const order = (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || String(b.createdAt).localeCompare(String(a.createdAt));
export const sortNotices = (list) => [...list].sort(order);
export const activeNotices = (list, today) => sortNotices(list.filter((n) => isActive(n, today)));

/** What goes into each student's portal record: active notices only, pinned first, newest first, trimmed to what the screen uses */
export const noticesForPortal = (list, today, limit = 10) =>
  activeNotices(list, today)
    .slice(0, limit)
    .map(({ id, title, text, kind, pinned, expiresOn, createdAt }) => ({ id, title, text, kind: kind || 'general', pinned: !!pinned, expiresOn: expiresOn || '', createdAt }));

/** The text shared outside the app (WhatsApp group) */
export const noticeText = (n, { institution = '', className = '' } = {}) =>
  [`📢 *${n.title}*`, '', n.text, '', [institution, className].filter(Boolean).join(' · ')].join('\n').trim();

/** Which of these has the student not opened yet? `seen` is the list of ids already read */
export const unreadNotices = (list, seen) => list.filter((n) => !seen.includes(n.id));
