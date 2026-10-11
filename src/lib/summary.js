import { EN_MONTHS, toISODate } from './format';

const pad2 = (n) => String(n).padStart(2, '0');
const periodOf = (monthName, year) => `${year}-${pad2(EN_MONTHS.indexOf(monthName) + 1)}`;

/** The academic session a date falls in: July → June. 2026-10 → 2026 (session 2026-27); 2027-03 → 2026 */
export const sessionStartOf = (year, monthIndex) => (monthIndex >= 6 ? year : year - 1);
export const sessionLabel = (startYear) => `${startYear}-${String(startYear + 1).slice(2)}`;

/** July of `startYear` through June of the next year */
export function sessionMonths(startYear) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = (6 + i) % 12;
    const year = m >= 6 ? startYear : startYear + 1;
    return { period: `${year}-${pad2(m + 1)}`, month: EN_MONTHS[m], year };
  });
}

/** Sessions that have any record, newest first (the current one is always offered) */
export function availableSessions({ fees = [], payments = [], attendance = {}, current }) {
  const set = new Set([current]);
  fees.filter((f) => !f.beforeStart).forEach((f) => set.add(sessionStartOf(Number(f.year), EN_MONTHS.indexOf(f.month))));
  payments.forEach((p) => {
    if (p.paymentDate) {
      const d = new Date(p.paymentDate);
      set.add(sessionStartOf(d.getFullYear(), d.getMonth()));
    }
  });
  Object.keys(attendance).forEach((k) => {
    const [y, m] = k.split('-').map(Number);
    if (y && m) set.add(sessionStartOf(y, m - 1));
  });
  return [...set].sort((a, b) => b - a);
}

/**
 * One session, month by month: what the fees asked for and what came in, what is still owed,
 * cash received during the month, and attendance. Totals and a few headline findings on top.
 */
export function yearSummary({ fees = [], payments = [], attendance = {}, fines = [], startYear, today = new Date() }) {
  const todayPeriod = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;
  const months = sessionMonths(startYear).map((m) => {
    const rows = fees.filter((f) => !f.beforeStart && periodOf(f.month, Number(f.year)) === m.period);
    const target = rows.reduce((a, f) => a + Number(f.amount || 0) + Math.max(0, Number(f.fine || 0) - Number(f.fineWaived || 0)), 0);
    const collected = rows.reduce((a, f) => a + Number(f.paid || 0), 0);
    const due = rows.reduce((a, f) => a + Number(f.due || 0), 0);
    const cashIn = payments
      .filter((p) => p.status !== 'void' && p.paymentDate && toISODate(new Date(p.paymentDate)).startsWith(m.period))
      .reduce((a, p) => a + Number(p.amount || 0), 0);

    const days = Object.keys(attendance).filter((k) => k.startsWith(m.period));
    const att = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
    days.forEach((k) => Object.values(attendance[k] || {}).forEach((st) => att[st] != null && (att[st] += 1)));
    const marked = att.Present + att.Absent + att.Late + att.Leave;
    // Same rule as a student's attendance %: a late arrival counts half
    const presentEq = att.Present + att.Late * 0.5;

    const monthFines = fines.filter((f) => String(f.date || '').startsWith(m.period));
    return {
      ...m,
      rows: rows.length,
      target,
      collected,
      due,
      rate: target > 0 ? Math.round((collected / target) * 100) : null,
      cashIn,
      days: days.length,
      absent: att.Absent,
      marked,
      presentEq,
      attPct: marked > 0 ? Math.round((presentEq / marked) * 100) : null,
      fines: monthFines.length,
      fineTotal: monthFines.reduce((a, f) => a + Number(f.amount || 0), 0),
      future: m.period > todayPeriod,
    };
  });

  const sum = (k) => months.reduce((a, m) => a + m[k], 0);
  const withFees = months.filter((m) => m.rows > 0);
  const withAtt = months.filter((m) => m.attPct !== null);
  const totals = {
    target: sum('target'),
    collected: sum('collected'),
    due: sum('due'),
    cashIn: sum('cashIn'),
    days: sum('days'),
    absent: sum('absent'),
    fines: sum('fines'),
    fineTotal: sum('fineTotal'),
    rate: sum('target') > 0 ? Math.round((sum('collected') / sum('target')) * 100) : null,
    // over every mark made in the session, so a month with more classes counts for more
    attPct: withAtt.length ? Math.round((withAtt.reduce((a, m) => a + m.presentEq, 0) / withAtt.reduce((a, m) => a + m.marked, 0)) * 100) : null,
  };
  const maxBy = (list, k) => list.reduce((best, m) => (best === null || m[k] > best[k] ? m : best), null);
  const minBy = (list, k) => list.reduce((best, m) => (best === null || m[k] < best[k] ? m : best), null);
  const insights = {
    mostDue: maxBy(withFees.filter((m) => m.due > 0), 'due'),
    bestRate: maxBy(withFees.filter((m) => m.rate !== null && !m.future), 'rate'),
    lowestAtt: minBy(withAtt, 'attPct'),
    bestAtt: maxBy(withAtt, 'attPct'),
  };
  return { startYear, label: sessionLabel(startYear), months, totals, insights };
}
