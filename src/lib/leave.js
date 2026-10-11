import { parseISODate, toISODate, shiftISODate, daysBetween } from './format';

export const MAX_LEAVE_DAYS = 30;
export const MAX_BACKDATE_DAYS = 7; // an application may cover days that have just passed
export const LEAVE_REASONS = ['অসুস্থতা', 'পারিবারিক কারণ', 'বাইরে যাচ্ছি', 'অন্যান্য'];

export const LEAVE_STATUS = {
  pending: { bn: 'অপেক্ষায়', tone: 'amber' },
  approved: { bn: 'মঞ্জুর', tone: 'green' },
  rejected: { bn: 'নামঞ্জুর', tone: 'red' },
};

/** Every date from `from` to `to`, inclusive (at most MAX_LEAVE_DAYS) */
export function leaveDates(from, to = from) {
  if (!from) return [];
  const end = to && to >= from ? to : from;
  const out = [];
  for (let d = from; d <= end && out.length < MAX_LEAVE_DAYS; d = shiftISODate(d, 1)) out.push(d);
  return out;
}
export const leaveDays = (l) => leaveDates(l.from, l.to).length;

/** The guardian's form: what is wrong with it, in Bangla — an empty list means fine */
export function validateLeave({ from, to, reason }, today) {
  const errors = [];
  // a real calendar date: 2026-13-45 would roll over into some other day, so compare it back
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && toISODate(parseISODate(s)) === s;
  if (!ok(from)) errors.push('শুরুর তারিখ দিন');
  else {
    if (daysBetween(from, today) > MAX_BACKDATE_DAYS) errors.push(`${MAX_BACKDATE_DAYS} দিনের বেশি আগের তারিখে আবেদন করা যায় না`);
    if (to && !ok(to)) errors.push('শেষ তারিখ ঠিক নয়');
    else if (to && to < from) errors.push('শেষ তারিখ শুরুর তারিখের আগে হতে পারে না');
    else if (to && daysBetween(from, to) + 1 > MAX_LEAVE_DAYS) errors.push(`একবারে সর্বোচ্চ ${MAX_LEAVE_DAYS} দিনের ছুটি`);
  }
  const r = String(reason || '').trim();
  if (!r) errors.push('ছুটির কারণ লিখুন');
  else if (r.length > 300) errors.push('কারণ ৩০০ অক্ষরের মধ্যে লিখুন');
  return errors;
}

/** The record that is saved when a guardian applies */
export function newLeave({ id, classId, student, portalKey, from, to, reason, now = new Date() }) {
  return {
    id,
    classId,
    studentId: student.id,
    roll: Number(student.roll),
    studentName: student.name,
    portalKey,
    from,
    to: to && to >= from ? to : from,
    reason: String(reason).trim(),
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

/** The approved leave that covers this student on this date, if any */
export const approvedLeaveFor = (leaves, studentId, date) =>
  leaves.find((l) => l.status === 'approved' && l.studentId === studentId && l.from <= date && date <= (l.to || l.from)) || null;

/** { studentId: 'Leave' } for everyone on approved leave that day — the starting point of the roll call */
export function leaveDefaultsFor(leaves, date) {
  const out = {};
  leaves.forEach((l) => {
    if (l.status === 'approved' && l.from <= date && date <= (l.to || l.from)) out[l.studentId] = 'Leave';
  });
  return out;
}

/**
 * Days already recorded in the attendance book that an approved leave should now turn into "Leave":
 * only where the student was marked absent (present / late stay as they are).
 * → [{ date, records }] with the full day's records, ready to save.
 */
export function leaveAttendanceChanges(leave, attendance) {
  const out = [];
  leaveDates(leave.from, leave.to).forEach((date) => {
    const rec = attendance[date];
    if (rec && rec[leave.studentId] === 'Absent') out.push({ date, records: { ...rec, [leave.studentId]: 'Leave' } });
  });
  return out;
}

export const pendingLeaves = (leaves) => leaves.filter((l) => l.status === 'pending');

/** What the portal is shown: this student's applications, newest first (the guardian never sees others') */
export const leavesForPortal = (leaves, studentId, limit = 20) =>
  leaves
    .filter((l) => l.studentId === studentId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(({ id, from, to, reason, status, createdAt, decidedAt, note }) => ({ id, from, to: to || from, reason, status, createdAt, decidedAt: decidedAt || '', note: note || '' }));

export { toISODate };
