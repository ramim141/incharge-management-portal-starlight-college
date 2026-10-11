// Everything that happened to one student, newest first — built from the records the class already
// keeps (receipts, fines, attendance, admission-time payments, audit lines, leave applications).

import { monthBn } from './format';

const dayStart = (d) => (String(d).length === 10 ? `${d}T00:00:00` : String(d));

/** Kinds → filter groups on the screen */
export const TIMELINE_GROUPS = [
  { id: 'all', bn: 'সব' },
  { id: 'money', bn: 'টাকা' },
  { id: 'att', bn: 'হাজিরা' },
  { id: 'other', bn: 'অন্যান্য' },
];
const GROUP_OF = { payment: 'money', fine: 'money', admission: 'money', att: 'att', leave: 'other', reminder: 'other', edit: 'other', joined: 'other' };
export const groupOfKind = (kind) => GROUP_OF[kind] || 'other';

const ATT_TEXT = { Absent: 'অনুপস্থিত', Late: 'দেরিতে এসেছে', Leave: 'ছুটি' };

export function studentTimeline({ student, payments = [], fines = [], fees = [], attendance = {}, audit = [], leaves = [] }) {
  const id = student.id;
  const out = [];

  if (student.admissionDate) out.push({ id: 'joined', at: dayStart(student.admissionDate), kind: 'joined', title: 'ভর্তি হয়েছে', text: `রোল ${student.roll}` });

  payments
    .filter((p) => p.studentId === id && p.status !== 'void')
    .forEach((p) =>
      out.push({
        id: `pay-${p.id}`,
        at: p.paymentDate,
        kind: 'payment',
        title: 'পেমেন্ট দিয়েছে',
        text: (p.items || []).map((i) => i.description).filter(Boolean).join(', ') || p.method,
        detail: [p.receiptNo, p.method].filter(Boolean).join(' · '),
        amount: Number(p.amount),
        payment: p,
      }),
    );

  fines
    .filter((f) => f.studentId === id)
    .forEach((f) => {
      out.push({ id: `fine-${f.id}`, at: dayStart(f.date), kind: 'fine', title: 'জরিমানা হয়েছে', text: f.reason || '', amount: Number(f.amount), fine: f });
      if (Number(f.waived) > 0 && f.waivedAt) out.push({ id: `fine-w-${f.id}`, at: f.waivedAt, kind: 'fine', title: 'জরিমানা মওকুফ', text: f.reason || '', amount: Number(f.waived), tone: 'good' });
    });

  // Fees collected together with admission have no receipt: the row itself records when
  fees
    .filter((f) => f.studentId === id && f.note === 'ভর্তির সময় আদায়' && f.settledAt)
    .forEach((f) => out.push({ id: `adm-${f.id}`, at: f.settledAt, kind: 'admission', title: 'ভর্তির সময় আদায়', text: `${monthBn(f.month)} ${f.year} মাসের বেতন`, amount: Number(f.paid) }));

  Object.entries(attendance).forEach(([date, rec]) => {
    const st = rec?.[id];
    if (st && st !== 'Present') out.push({ id: `att-${date}`, at: dayStart(date), kind: 'att', title: ATT_TEXT[st] || st, text: '', tone: st === 'Absent' ? 'bad' : st === 'Late' ? 'warn' : 'info', status: st });
  });

  audit
    .filter((a) => a.studentId === id)
    .forEach((a) => {
      if (a.kind === 'payment' && /^পেমেন্ট নিয়েছেন$/.test(a.action)) return; // the receipt already shows it
      out.push({ id: `log-${a.id}`, at: a.at, kind: a.kind === 'reminder' ? 'reminder' : 'edit', title: a.action, text: a.detail || '', by: a.by, amount: a.amount != null ? Number(a.amount) : undefined });
    });

  leaves
    .filter((l) => l.studentId === id)
    .forEach((l) =>
      out.push({
        id: `leave-${l.id}`,
        at: l.createdAt || dayStart(l.from),
        kind: 'leave',
        title: l.status === 'approved' ? 'ছুটি মঞ্জুর' : l.status === 'rejected' ? 'ছুটি নামঞ্জুর' : 'ছুটির আবেদন',
        text: `${l.from}${l.to && l.to !== l.from ? ` – ${l.to}` : ''}${l.reason ? ` · ${l.reason}` : ''}`,
        tone: l.status === 'approved' ? 'good' : l.status === 'rejected' ? 'bad' : 'warn',
      }),
    );

  return out.filter((e) => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(a.id).localeCompare(String(b.id)));
}
