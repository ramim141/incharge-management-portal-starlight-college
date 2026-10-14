// Formatting + domain label helpers shared by every screen.

export const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];
export const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
export const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toEnDigits = (s) => String(s ?? '').replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d));

// Academic session runs July → June
export const ACADEMIC_MONTHS = [
  'July', 'August', 'September', 'October', 'November', 'December',
  'January', 'February', 'March', 'April', 'May', 'June',
];

export const monthBn = (en) => {
  const i = EN_MONTHS.findIndex((m) => m.toLowerCase() === String(en || '').toLowerCase());
  return i >= 0 ? BN_MONTHS[i] : en;
};

export const taka = (n) => `৳${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * What a student owes, line by line: each unpaid month (monthly fee and transport apart), fines and
 * exam fees. Months taken at admission carry no due, so they never appear. → [{ label, amount }]
 */
export const studentDueItems = (studentId, { fees = [], fines = [], examFees = [] }) => {
  const items = [];
  fees
    .filter((f) => f.studentId === studentId && Number(f.due) > 0)
    .sort((a, b) => Number(a.year) - Number(b.year) || EN_MONTHS.indexOf(a.month) - EN_MONTHS.indexOf(b.month))
    .forEach((f) => {
      // A late fine is the last part of a month's charge to be settled (same as the payment sheet)
      const late = Math.min(Math.max(0, Number(f.fine || 0) - Number(f.fineWaived || 0)), Number(f.due));
      const rest = Number(f.due) - late;
      const transport = Math.min(Number(f.transport) || 0, rest);
      const period = `${f.year}-${pad(EN_MONTHS.indexOf(f.month) + 1)}`;
      if (rest - transport > 0) items.push({ label: `${monthBn(f.month)} বেতন`, amount: rest - transport, period, kind: 'tuition' });
      if (transport > 0) items.push({ label: `${monthBn(f.month)} পরিবহন`, amount: transport, period, kind: 'transport' });
      if (late > 0) items.push({ label: `${monthBn(f.month)} দেরির জরিমানা`, amount: late, period, kind: 'late' });
    });
  const owedFines = fines.filter((x) => x.studentId === studentId && Number(x.due) > 0);
  const absent = owedFines.filter((x) => x.kind === 'absent');
  const other = owedFines.filter((x) => x.kind !== 'absent');
  const sum = (list) => list.reduce((a, x) => a + Number(x.due), 0);
  if (absent.length) items.push({ label: `অনুপস্থিতির জরিমানা (${absent.length} দিন)`, amount: sum(absent), kind: 'fine' });
  if (other.length) items.push({ label: 'অন্যান্য জরিমানা', amount: sum(other), kind: 'fine' });
  examFees
    .filter((e) => e.studentId === studentId && e.status === 'Due' && Number(e.due || e.amount || 0) > 0)
    .forEach((e) => items.push({ label: e.examName ? (e.examName.endsWith('ফি') ? e.examName : `${e.examName} ফি`) : 'পরীক্ষার ফি', amount: Number(e.due || e.amount), kind: 'exam' }));
  return items;
};

const pad = (n) => String(n).padStart(2, '0');

// Local-date ISO (toISOString() is UTC and flips the date before 6am in Bangladesh)
export const toISODate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());

export const parseISODate = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const toDate = (input) =>
  typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? parseISODate(input) : new Date(input);

export const fmtDate = (input, { year = true } = {}) => {
  if (!input) return '—';
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return `${d.getDate()} ${BN_MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
};

export const fmtTime = (input) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${ampm}`;
};

export const dayNameBn = (input) => BN_DAYS[toDate(input).getDay()];

/** Whole days from one ISO date to another (negative when `to` is earlier) */
export const daysBetween = (from, to) => Math.round((parseISODate(to) - parseISODate(from)) / 86400000);

export const shiftISODate = (iso, days) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const greetingBn = () => {
  const h = new Date().getHours();
  if (h < 12) return 'শুভ সকাল';
  if (h < 15) return 'শুভ দুপুর';
  if (h < 18) return 'শুভ বিকেল';
  return 'শুভ সন্ধ্যা';
};

export const GROUPS = [
  { id: 'Science', bn: 'বিজ্ঞান' },
  { id: 'Business Studies', bn: 'ব্যবসায় শিক্ষা' },
  { id: 'Humanities', bn: 'মানবিক' },
];
export const GENDERS = [
  { id: 'Male', bn: 'ছাত্র' },
  { id: 'Female', bn: 'ছাত্রী' },
];

// Each in-charge names their own departments and sections (class settings). The class screen
// registers them here so every label helper below shows the teacher's own names.
let labels = { group: {}, section: {} };
export const setClassLabels = ({ departments = [], sections = [] } = {}) => {
  labels = {
    group: Object.fromEntries(departments.map((d) => [d.id, d.bn])),
    section: Object.fromEntries(sections.map((d) => [d.id, d.bn])),
  };
};

export const groupBn = (id) => (id ? labels.group[id] || GROUPS.find((g) => g.id === id)?.bn || id : '');
export const sectionBn = (id) => (id ? labels.section[id] || id : '');
export const genderBn = (id) => GENDERS.find((g) => g.id === id)?.bn || '';
/** "বিজ্ঞান · ক শাখা" — whatever of department / section the student has */
export const studentTags = (s) => [groupBn(s?.group), sectionBn(s?.section)].filter(Boolean).join(' · ');

export const FEE_STATUS = {
  Paid: { bn: 'পরিশোধিত', tone: 'green' },
  Partial: { bn: 'আংশিক', tone: 'amber' },
  Due: { bn: 'বাকি', tone: 'amber' },
  Overdue: { bn: 'মেয়াদোত্তীর্ণ', tone: 'red' },
};

/** Badge for a fee row: admission month displays "বেতন হয়ে গেছে (ভর্তির সময়)" */
export const feeBadge = (f, st) => {
  if (f?.atAdmission) return { bn: 'বেতন হয়ে গেছে (ভর্তির সময়)', tone: 'green' };
  if (f?.beforeStart) return { bn: 'ভর্তির সময় নেওয়া', tone: 'green' };
  return FEE_STATUS[st] || FEE_STATUS.Due;
};

export const FINE_STATUS = {
  Active: { bn: 'বাকি', tone: 'red' },
  Paid: { bn: 'পরিশোধিত', tone: 'green' },
  Waived: { bn: 'মওকুফ', tone: 'slate' },
};

export const ATT_STATUS = {
  Present: { bn: 'উপস্থিত', short: 'উ', tone: 'green' },
  Absent: { bn: 'অনুপস্থিত', short: 'অ', tone: 'red' },
  Late: { bn: 'দেরি', short: 'দে', tone: 'amber' },
  Leave: { bn: 'ছুটি', short: 'ছু', tone: 'sky' },
};
export const ATT_ORDER = ['Present', 'Absent', 'Late', 'Leave'];

export const METHODS = [
  { id: 'Cash', bn: 'নগদ', color: 'bg-slate-800' },
  { id: 'bKash', bn: 'বিকাশ', color: 'bg-pink-600' },
  { id: 'Nagad', bn: 'নগদ (অ্যাপ)', color: 'bg-orange-500' },
  { id: 'Bank', bn: 'ব্যাংক', color: 'bg-sky-600' },
];
export const methodBn = (id) => METHODS.find((m) => m.id === id)?.bn || id;

// Fee row status with the deadline taken into account
export const feeStatus = (fee) => {
  if (!fee) return null;
  if (fee.status === 'Paid') return 'Paid';
  if (fee.status === 'Overdue') return 'Overdue';
  if (fee.deadline && todayISO() > fee.deadline) return 'Overdue';
  return fee.status || 'Due';
};

export const daysLate = (deadline) => {
  if (!deadline || todayISO() <= deadline) return 0;
  return Math.round((parseISODate(todayISO()) - parseISODate(deadline)) / 86400000);
};

export const waPhone = (phone) => {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (!p.startsWith('88')) p = `88${p}`;
  return p;
};
export const waLink = (phone, text) => `https://wa.me/${waPhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const EN_TO_BN_MONTH = {
  january: 'জানুয়ারি',
  february: 'ফেব্রুয়ারি',
  march: 'মার্চ',
  april: 'এপ্রিল',
  may: 'মে',
  june: 'জুন',
  july: 'জুলাই',
  august: 'আগস্ট',
  september: 'সেপ্টেম্বর',
  october: 'অক্টোবর',
  november: 'নভেম্বর',
  december: 'ডিসেম্বর',
  jan: 'জানু',
  feb: 'ফেব্রু',
  mar: 'মার্চ',
  apr: 'এপ্রিল',
  jun: 'জুন',
  jul: 'জুলাই',
  aug: 'আগস্ট',
  sep: 'সেপ্টে',
  oct: 'অক্টো',
  nov: 'নভে',
  dec: 'ডিসে',
};

export const formatItemDescBn = (desc) => {
  if (!desc) return 'ফি পরিশোধ';
  let s = String(desc);

  Object.entries(EN_TO_BN_MONTH).forEach(([en, bn]) => {
    s = s.replace(new RegExp(`\\b${en}\\b`, 'gi'), bn);
  });

  s = s.replace(/\bMonthly Fee\b/gi, 'মাসিক বেতন');
  s = s.replace(/\bTransport Fee\b/gi, 'পরিবহন ফি');
  s = s.replace(/\bExamination Fee\b/gi, 'পরীক্ষার ফি');
  s = s.replace(/\bCollege Fee Payment\b/gi, 'কলেজ ফি পরিশোধ');
  s = s.replace(/\bClass Fee\b/gi, 'ক্লাস ফি');
  s = s.replace(/\bFine\s*\(([0-9]+)\)/gi, (_, n) => `জরিমানা (${n}টি)`);
  s = s.replace(/\bFine\b/gi, 'জরিমানা');

  return s.trim();
};

export const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

