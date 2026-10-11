import React, { useMemo, useState } from 'react';
import { ChevronDown, CalendarDays } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Progress, cx } from './ui';
import { taka, monthBn, METHODS, EN_MONTHS } from '../lib/format';
import { periodOf, ADMISSION_NOTE } from '../lib/classLogic';

const labelOf = (period) => `${monthBn(EN_MONTHS[Number(period.slice(5, 7)) - 1])} ${period.slice(0, 4)}`;

/**
 * Dashboard card: the month's figures, for this month or any earlier one — fee targets and what was
 * collected, cash received during the month, attendance and fines.
 */
export function MonthHistory() {
  const { fees, payments, attendance, fines, settings } = useApp();
  const current = periodOf(settings.currentMonth, settings.currentYear);
  const [period, setPeriod] = useState(current);
  const [open, setOpen] = useState(false); // folded until someone wants the history

  // Every month that has any record, newest first (this month always included)
  const options = useMemo(() => {
    const set = new Set([current]);
    fees.filter((f) => !f.beforeStart).forEach((f) => set.add(periodOf(f.month, Number(f.year))));
    payments.forEach((p) => p.paymentDate && set.add(String(p.paymentDate).slice(0, 7)));
    Object.keys(attendance).forEach((d) => set.add(d.slice(0, 7)));
    fines.forEach((f) => f.date && set.add(String(f.date).slice(0, 7)));
    return [...set].filter((p) => /^\d{4}-\d{2}$/.test(p)).sort().reverse();
  }, [fees, payments, attendance, fines, current]);

  const d = useMemo(() => {
    const rows = fees.filter((f) => !f.beforeStart && periodOf(f.month, Number(f.year)) === period);
    const target = rows.reduce((a, f) => a + Number(f.amount || 0) + Math.max(0, Number(f.fine || 0) - Number(f.fineWaived || 0)), 0);
    const collected = rows.reduce((a, f) => a + Number(f.paid || 0), 0);
    const due = rows.reduce((a, f) => a + Number(f.due || 0), 0);
    const paidN = rows.filter((f) => f.status === 'Paid').length;
    // Taken together with admission (no receipt) — e.g. a new class's first month
    const admRows = rows.filter((f) => f.note === ADMISSION_NOTE && Number(f.paid) > 0);
    const admPaid = admRows.reduce((a, f) => a + Number(f.paid || 0), 0);

    const pays = payments.filter((p) => p.status !== 'void' && String(p.paymentDate || '').slice(0, 7) === period);
    const cash = pays.reduce((a, p) => a + Number(p.amount || 0), 0);
    const byMethod = METHODS.map((m) => ({ ...m, total: pays.filter((p) => p.method === m.id).reduce((a, p) => a + Number(p.amount || 0), 0) })).filter((m) => m.total > 0);

    const days = Object.keys(attendance).filter((k) => k.startsWith(period));
    const att = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
    days.forEach((k) => Object.values(attendance[k] || {}).forEach((st) => att[st] != null && (att[st] += 1)));
    const marked = att.Present + att.Absent + att.Late + att.Leave;

    const monthFines = fines.filter((f) => String(f.date || '').slice(0, 7) === period);
    const fineTotal = monthFines.reduce((a, f) => a + Number(f.amount || 0), 0);
    const finePaid = monthFines.reduce((a, f) => a + Number(f.paid || 0), 0);
    return { rows, admRows, admPaid, target, collected, due, paidN, pays, cash, byMethod, days: days.length, att, marked, monthFines, fineTotal, finePaid };
  }, [fees, payments, attendance, fines, period]);

  const pct = d.target > 0 ? Math.round((d.collected / d.target) * 100) : 0;
  const present = d.att.Present + d.att.Late * 0.5; // a late arrival counts half, as everywhere else
  const attPct = d.marked > 0 ? Math.round((present / d.marked) * 100) : 0;
  const isCurrent = period === current;

  return (
    <div className="mt-5">
      <Card className="overflow-hidden">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="press flex w-full items-center gap-3 p-4 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-bold text-ink">মাসের হিসাব</span>
            <span className="block truncate text-[12.5px] text-slate-500">{open ? labelOf(period) : 'আগের যেকোনো মাসের ইতিহাস দেখুন'}</span>
          </span>
          <ChevronDown className={cx('h-5 w-5 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="space-y-4 border-t border-slate-100 p-4">
            {/* Month chips: swipe sideways, newest first */}
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
              {options.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cx('press h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold', p === period ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}
                >
                  {labelOf(p)}
                </button>
              ))}
            </div>

        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-slate-500">বেতন · {labelOf(period)}</p>
            <p className="tabular text-[12.5px] font-bold text-slate-500">{pct}%</p>
          </div>
          {d.rows.length === 0 ? (
            <p className="mt-1 text-[13.5px] text-slate-400">এই মাসের কোনো বেতনের রেকর্ড নেই</p>
          ) : (
            <>
              <div className="tabular mt-2 grid grid-cols-3 gap-2 text-center">
                <Stat label="লক্ষ্য" value={taka(d.target)} />
                <Stat label="আদায়" value={taka(d.collected)} cls="text-emerald-600" />
                <Stat label="বাকি" value={taka(d.due)} cls={d.due > 0 ? 'text-rose-600' : 'text-emerald-600'} />
              </div>
              <Progress value={pct} className="mt-3" />
              <p className="tabular mt-2 text-[12.5px] text-slate-500">
                {d.paidN}/{d.rows.length} জন পরিশোধ করেছে
              </p>
              {d.admPaid > 0 && (
                <div className="tabular mt-2.5 space-y-1 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                  <p className="flex justify-between gap-3">
                    <span>ভর্তির সময় নেওয়া ({d.admRows.length} জন)</span>
                    <b>{taka(d.admPaid)}</b>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span>রশিদে আদায়</span>
                    <b>{taka(Math.max(0, d.collected - d.admPaid))}</b>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3.5">
          <p className="text-[13px] font-semibold text-slate-500">{isCurrent ? 'এই মাসে' : 'সেই মাসে'} হাতে পাওয়া টাকা</p>
          <p className="tabular mt-1 text-[22px] font-extrabold text-ink">
            {taka(d.cash)}
            <span className="ml-2 text-[13px] font-medium text-slate-500">{d.pays.length}টি রশিদ</span>
          </p>
          {d.admPaid > 0 && <p className="tabular mt-0.5 text-[12.5px] text-emerald-700">এর বাইরে ভর্তির সময় নেওয়া {taka(d.admPaid)} (রশিদ ছাড়া)</p>}
          {d.byMethod.length > 0 && (
            <p className="tabular mt-0.5 text-[12.5px] text-slate-500">{d.byMethod.map((m) => `${m.id} ${taka(m.total)}`).join(' · ')}</p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-slate-500">হাজিরা</p>
            <p className="tabular text-[12.5px] font-bold text-slate-500">{d.days > 0 ? `${d.days} দিন ক্লাস` : ''}</p>
          </div>
          {d.days === 0 ? (
            <p className="mt-1 text-[13.5px] text-slate-400">এই মাসে হাজিরা নেওয়া হয়নি</p>
          ) : (
            <>
              <p className="tabular mt-1 text-[22px] font-extrabold text-ink">
                {attPct}%<span className="ml-2 text-[13px] font-medium text-slate-500">গড় উপস্থিতি</span>
              </p>
              <div className="tabular mt-2 grid grid-cols-4 gap-2 text-center">
                <Stat label="উপস্থিত" value={d.att.Present} />
                <Stat label="অনুপস্থিত" value={d.att.Absent} cls={d.att.Absent > 0 ? 'text-rose-600' : ''} />
                <Stat label="দেরি" value={d.att.Late} />
                <Stat label="ছুটি" value={d.att.Leave} />
              </div>
            </>
          )}
        </div>

        {d.monthFines.length > 0 && (
          <div className="border-t border-slate-100 pt-3.5">
            <p className="text-[13px] font-semibold text-slate-500">জরিমানা</p>
            <p className="tabular mt-1 text-[15px] font-bold text-ink">
              {d.monthFines.length}টি · {taka(d.fineTotal)}
              <span className="ml-2 text-[13px] font-medium text-emerald-600">আদায় {taka(d.finePaid)}</span>
            </p>
          </div>
        )}
          </div>
        )}
      </Card>
    </div>
  );
}

const Stat = ({ label, value, cls }) => (
  <div>
    <p className={cx('text-[16px] font-bold text-ink', cls)}>{value}</p>
    <p className="text-[11.5px] text-slate-400">{label}</p>
  </div>
);
