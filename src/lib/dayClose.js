import { METHODS, toISODate } from './format';

const CATEGORIES = [
  { id: 'transport', bn: 'পরিবহন', test: /পরিবহন/ },
  { id: 'fine', bn: 'জরিমানা', test: /জরিমানা/ },
  { id: 'exam', bn: 'পরীক্ষা', test: /পরীক্ষা|টেস্ট|exam/i },
  { id: 'tuition', bn: 'মাসিক বেতন', test: /./ },
];
const categoryOf = (description) => (CATEGORIES.find((c) => c.test.test(String(description || ''))) || CATEGORIES[3]).id;

/**
 * Everything received on one day: total, by payment method, by purpose, and the cash that should be
 * in the drawer (only "Cash" counts; bKash/Nagad/Bank went to accounts). Voided receipts are ignored.
 */
export function dayCloseSummary(payments, date) {
  const list = payments
    .filter((p) => p.status !== 'void' && p.paymentDate && toISODate(new Date(p.paymentDate)) === date)
    .sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));
  const total = list.reduce((a, p) => a + Number(p.amount || 0), 0);

  const byMethod = METHODS.map((m) => {
    const rows = list.filter((p) => p.method === m.id);
    return { id: m.id, bn: m.bn, color: m.color, count: rows.length, total: rows.reduce((a, p) => a + Number(p.amount || 0), 0) };
  });
  // A method that is not in METHODS (old data) still has to be counted, or the parts would not add up
  const known = new Set(METHODS.map((m) => m.id));
  const other = list.filter((p) => !known.has(p.method));
  if (other.length) byMethod.push({ id: 'other', bn: 'অন্যান্য', color: 'bg-slate-400', count: other.length, total: other.reduce((a, p) => a + Number(p.amount || 0), 0) });

  const byPurpose = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  list.forEach((p) => {
    const items = p.items?.length ? p.items : [{ description: '', amount: p.amount }];
    const itemsTotal = items.reduce((a, it) => a + Number(it.amount || 0), 0);
    items.forEach((it) => {
      byPurpose[categoryOf(it.description)] += Number(it.amount || 0);
    });
    // The receipt's own amount is the truth; anything the item lines do not explain is "tuition"
    byPurpose.tuition += Number(p.amount || 0) - itemsTotal;
  });

  return {
    date,
    list,
    count: list.length,
    total,
    byMethod,
    purposes: CATEGORIES.map((c) => ({ id: c.id, bn: c.bn, total: byPurpose[c.id] })).filter((x) => x.total !== 0),
    expectedCash: byMethod.find((m) => m.id === 'Cash')?.total || 0,
  };
}

/** What the drawer count says against what the receipts say: 0 = matches, + extra cash, − short */
export const cashDifference = (counted, expected) => Math.round((Number(counted) || 0) - (Number(expected) || 0));

/** Plain-text summary for sharing (WhatsApp) */
export function dayCloseText({ summary, closing, institution, className, date, dateLabel }) {
  const lines = [`📋 *দিনের ক্যাশ হিসাব*`, `${institution || ''}${className ? ` · ${className}` : ''}`.trim(), `তারিখ: ${dateLabel || date}`, ''];
  lines.push(`*মোট আদায়: ৳${summary.total.toLocaleString('en-IN')}* (${summary.count}টি রশিদ)`);
  summary.byMethod.filter((m) => m.total > 0).forEach((m) => lines.push(`• ${m.bn}: ৳${m.total.toLocaleString('en-IN')}`));
  if (summary.purposes.length) {
    lines.push('', 'খাত অনুযায়ী:');
    summary.purposes.forEach((p) => lines.push(`• ${p.bn}: ৳${p.total.toLocaleString('en-IN')}`));
  }
  if (closing) {
    lines.push('', `হাতে গোনা ক্যাশ: ৳${Number(closing.countedCash).toLocaleString('en-IN')}`);
    const d = closing.diff;
    lines.push(d === 0 ? 'হিসাব মিলেছে ✓' : d > 0 ? `বেশি আছে: ৳${d}` : `কম আছে: ৳${Math.abs(d)}`);
    if (closing.note) lines.push(`নোট: ${closing.note}`);
  }
  return lines.join('\n');
}
