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

/** Badge for a fee row: months before the class's fee start read "ভর্তির সময়" (taken with admission) */
export const feeBadge = (f, st) => (f?.beforeStart ? { bn: 'ভর্তির সময় নেওয়া', tone: 'green' } : FEE_STATUS[st] || FEE_STATUS.Due);

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

export const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
