export const QUERY_SUBJECTS = [
  'বেতন ও ফি সংক্রান্ত',
  'হাজিরা সংক্রান্ত',
  'পরীক্ষা ও প্রবেশপত্র',
  'নাম বা তথ্য সংশোধন',
  'অন্যান্য জিজ্ঞাসা',
];

export const QUERY_STATUS = {
  pending: { bn: 'অপেক্ষায়', tone: 'amber' },
  replied: { bn: 'উত্তর দেওয়া হয়েছে', tone: 'green' },
};

/** Validates query input */
export function validateQuery({ subject, message }) {
  const errors = [];
  if (!String(subject || '').trim()) errors.push('একটি বিষয় নির্বাচন করুন');
  const m = String(message || '').trim();
  if (!m) errors.push('আপনার বার্তা বা জিজ্ঞাসা লিখুন');
  else if (m.length < 5) errors.push('কমপক্ষে ৫ অক্ষরে বার্তা লিখুন');
  else if (m.length > 600) errors.push('বার্তা ৬০০ অক্ষরের মধ্যে লিখুন');
  return errors;
}

/** Prepares a new query object for submission */
export function newQuery({ id, classId, student, portalKey, subject, message, now = new Date() }) {
  return {
    id,
    classId,
    studentId: student.id,
    roll: Number(student.roll),
    studentName: student.name,
    portalKey,
    subject: String(subject || 'অন্যান্য জিজ্ঞাসা').trim(),
    message: String(message || '').trim(),
    status: 'pending',
    createdAt: now.toISOString(),
    reply: '',
    repliedAt: null,
    repliedBy: '',
  };
}

/** Formats query list for student portal */
export const queriesForPortal = (all = [], studentId) =>
  all
    .filter((q) => q.studentId === studentId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(({ id, subject, message, status, reply, repliedAt, repliedBy, createdAt }) => ({
      id,
      subject,
      message,
      status,
      reply: reply || '',
      repliedAt: repliedAt || null,
      repliedBy: repliedBy || '',
      createdAt,
    }));

