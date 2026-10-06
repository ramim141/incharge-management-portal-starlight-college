// Teachers sign in with a short login ID (T001, T002…) instead of an email. Firebase Auth needs an
// email, so each ID gets an internal one; `loginIds/{ID}` (public get, no list) maps ID → that email.
// A teacher may later switch the account to a real email so password-reset links can reach them.
export const STAFF_DOMAIN = 'staff.class-portal.app';
export const STAFF_COUNTER_PATH = ['meta', 'staffCounter'];
export const DEFAULT_STAFF_PREFIX = 'T';

export const normalizeLoginId = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
export const loginIdPath = (id) => ['loginIds', normalizeLoginId(id)];
export const staffEmail = (id) => `${normalizeLoginId(id).toLowerCase()}@${STAFF_DOMAIN}`;
/** True for the internal address — i.e. this teacher has no real email for password resets */
export const isStaffEmail = (email) => String(email || '').toLowerCase().endsWith(`@${STAFF_DOMAIN}`);

export const formatStaffId = (prefix, n) => `${prefix}${String(n).padStart(3, '0')}`;

/** Next serial for the prefix. Numbers are never reused, even after a teacher is removed. */
export function nextStaffSerial(counter, users, prefix) {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const used = users.map((u) => Number(re.exec(String(u.loginId || ''))?.[1] || 0));
  const last = counter?.prefix === prefix ? Number(counter.last || 0) : 0;
  return Math.max(last, ...used, 0) + 1;
}

/** 6-digit first password — different for every teacher, changed on first login */
export const generateStaffPassword = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
};
