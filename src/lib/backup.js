// Whole-class backup: every record the class owns in one JSON file, and the checks + write list
// needed to put it back. Pure functions (no Firebase, no React) so they can be tested on their own.

export const BACKUP_VERSION = '3.0';

// Collections stored one document per record, each with an `id`
const RECORDS = ['students', 'fees', 'examFees', 'fines', 'payments', 'closings', 'notices', 'leaves', 'audit'];

export const BACKUP_LABELS = {
  students: 'শিক্ষার্থী',
  fees: 'মাসিক বেতন',
  examFees: 'পরীক্ষার ফি',
  fines: 'জরিমানা',
  payments: 'পেমেন্ট ও রশিদ',
  closings: 'ক্যাশ ক্লোজ',
  notices: 'নোটিশ',
  leaves: 'ছুটির আবেদন',
  audit: 'অডিট লগ',
  attendanceDays: 'হাজিরার দিন',
};

/**
 * @param raw        { students, fees, examFees, fines, payments, closings, notices, leaves, audit } — plain records
 * @param attendance { 'YYYY-MM-DD': { studentId: 'Present' | … } }
 */
export function buildBackup({ classId, className, institution, raw, attendance, classSettings, now = new Date() }) {
  const out = {
    version: BACKUP_VERSION,
    exportDate: now.toISOString(),
    classId,
    className: className || '',
    institution: institution || '',
    classSettings: classSettings || {},
    attendance: attendance || {},
  };
  RECORDS.forEach((k) => {
    out[k] = Array.isArray(raw?.[k]) ? raw[k] : [];
  });
  return out;
}

export function summarizeBackup(b) {
  const counts = {};
  RECORDS.forEach((k) => {
    counts[k] = Array.isArray(b?.[k]) ? b[k].length : 0;
  });
  counts.attendanceDays = b?.attendance && typeof b.attendance === 'object' ? Object.keys(b.attendance).length : 0;
  return { counts, exportDate: b?.exportDate || '', classId: b?.classId || '', version: b?.version || '', total: Object.values(counts).reduce((a, n) => a + n, 0) };
}

/** Is this really one of our backups, and is it safe to write? */
export function validateBackup(b, { classId } = {}) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'ফাইলটি সঠিক ব্যাকআপ নয়', warnings: [] };
  if (!Array.isArray(b.students)) return { ok: false, error: 'ফাইলে শিক্ষার্থীর তথ্য নেই', warnings: [] };
  const warnings = [];
  for (const k of RECORDS) {
    if (b[k] === undefined) continue; // older backups lack the newer lists
    if (!Array.isArray(b[k])) return { ok: false, error: `ফাইলের "${BACKUP_LABELS[k]}" অংশটি ভাঙা`, warnings };
    const bad = b[k].findIndex((d) => !d || typeof d !== 'object' || !d.id);
    if (bad >= 0) return { ok: false, error: `ফাইলের "${BACKUP_LABELS[k]}" অংশে ${bad + 1} নম্বর রেকর্ডের আইডি নেই`, warnings };
  }
  if (b.attendance !== undefined && (typeof b.attendance !== 'object' || Array.isArray(b.attendance))) return { ok: false, error: 'ফাইলের হাজিরা অংশটি ভাঙা', warnings };
  if (classId && b.classId && b.classId !== classId) warnings.push(`এই ব্যাকআপ অন্য ক্লাসের (${b.classId}), আপনি এখন ${classId}-এ আছেন`);
  if (!b.version) warnings.push('পুরোনো ধরনের ব্যাকআপ — নোটিশ, ছুটি ও অডিট লগ এতে নেই');
  return { ok: true, warnings };
}

/**
 * The writes that put a backup back into a class. Existing records with the same id are replaced;
 * nothing is deleted. `pathOf(collection, id)` gives a document path.
 */
export function restoreOps(b, { pathOf, studentIdFor, portalKey, restoreSettings = false, classPath }) {
  const ops = [];
  (b.students || []).forEach((s) => {
    const studentId = studentIdFor(s.roll);
    ops.push({ type: 'set', path: pathOf('students', s.id), data: { ...s, studentId, portalKey: portalKey(studentId, s.pin || '0000'), portalHash: null } });
  });
  // `beforeStart` is worked out from the class's fee start month; a saved copy could be stale
  (b.fees || []).forEach((d) => {
    const { beforeStart: _drop, ...rest } = d;
    ops.push({ type: 'set', path: pathOf('fees', d.id), data: rest });
  });
  ['examFees', 'fines', 'payments', 'closings', 'notices', 'leaves', 'audit'].forEach((k) => (b[k] || []).forEach((d) => ops.push({ type: 'set', path: pathOf(k, d.id), data: d })));
  Object.entries(b.attendance || {}).forEach(([date, records]) => ops.push({ type: 'set', path: pathOf('attendance', date), data: { date, records } }));
  if (restoreSettings && b.classSettings && classPath) ops.push({ type: 'merge', path: classPath, data: { settings: b.classSettings } });
  return ops;
}

// "When did we last save a backup?" — remembered on this device
const stampKey = (classId) => `xi_last_backup_${classId}`;
export const lastBackupAt = (classId) => {
  try {
    return localStorage.getItem(stampKey(classId)) || '';
  } catch {
    return '';
  }
};
export const rememberBackup = (classId, iso = new Date().toISOString()) => {
  try {
    localStorage.setItem(stampKey(classId), iso);
  } catch {
    /* private mode: just no reminder */
  }
};
/** Whole days since an ISO time; Infinity when never */
export const daysSince = (iso, now = new Date()) => (iso ? Math.floor((now - new Date(iso)) / 86400000) : Infinity);
