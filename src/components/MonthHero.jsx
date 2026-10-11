import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Progress, cx } from './ui';
import { taka, monthBn, EN_MONTHS, feeStatus } from '../lib/format';
import { periodOf } from '../lib/classLogic';

const labelOf = (period) => `${monthBn(EN_MONTHS[Number(period.slice(5, 7)) - 1])} ${period.slice(0, 4)}`;

/**
 * The collection card as a swipeable row of months: every month that has fees (an advance month
 * paid ahead of time included) gets its own dashboard; swipe back for earlier months.
 */
export function MonthHero() {
  const { fees, settings, setActiveTab } = useApp();
  const current = periodOf(settings.currentMonth, settings.currentYear);

  const months = useMemo(() => {
    const set = new Set([current]);
    fees.filter((f) => !f.beforeStart).forEach((f) => set.add(periodOf(f.month, Number(f.year))));
    return [...set].sort().map((period) => {
      const rows = fees.filter((f) => !f.beforeStart && periodOf(f.month, Number(f.year)) === period);
      const target = rows.reduce((a, f) => a + Number(f.amount || 0) + Math.max(0, Number(f.fine || 0) - Number(f.fineWaived || 0)), 0);
      const collected = rows.reduce((a, f) => a + Number(f.paid || 0), 0);
      const due = rows.reduce((a, f) => a + Number(f.due || 0), 0);
      const paidN = rows.filter((f) => feeStatus(f) === 'Paid').length;
      const overdue = rows.filter((f) => feeStatus(f) === 'Overdue').length;
      return { period, rows: rows.length, target, collected, due, paidN, overdue, pending: rows.length - paidN - overdue, future: period > current };
    });
  }, [fees, current]);

  const startIdx = Math.max(0, months.findIndex((m) => m.period === current));
  const [idx, setIdx] = useState(startIdx);
  const scroller = useRef(null);

  // Open on the current month (earlier months to the left, advance months to the right)
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = startIdx * el.clientWidth;
    // only when the list of months is first built
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== idx) setIdx(i);
  };
  const goTo = (i) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="mt-4">
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[28px]">
        {months.map((m) => {
          const pct = m.target > 0 ? Math.round((m.collected / m.target) * 100) : 0;
          return (
            <div key={m.period} className="w-full shrink-0 snap-center">
              <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift">
                <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13.5px] font-semibold text-white/75">
                      {labelOf(m.period)} · আদায়
                      {m.period === current && <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">চলতি মাস</span>}
                      {m.future && <span className="ml-1.5 rounded-full bg-amber-300/25 px-2 py-0.5 text-[11px] font-bold text-amber-100">অগ্রিম</span>}
                    </p>
                    <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-bold">{pct}%</span>
                  </div>
                  <p className="tabular mt-1 text-[34px] font-extrabold leading-tight tracking-tight max-[374px]:text-[28px]">{taka(m.collected)}</p>
                  <p className="tabular text-[13px] text-white/70">
                    {m.rows === 0 ? 'এই মাসের বেতন এখনো তৈরি হয়নি' : `লক্ষ্য ${taka(m.target)} · বাকি ${taka(m.due)}`}
                  </p>
                  <Progress value={pct} tone="white" track="bg-white/20" className="mt-3" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'পরিশোধিত', value: m.paidN, to: 'fees' },
                      { label: 'বাকি', value: m.pending, to: 'due' },
                      { label: 'মেয়াদোত্তীর্ণ', value: m.overdue, to: 'due', hot: true },
                    ].map((x) => (
                      <button
                        key={x.label}
                        type="button"
                        onClick={() => setActiveTab(x.to)}
                        className="press rounded-2xl bg-white/10 px-3 py-2.5 text-center ring-1 ring-inset ring-white/10 max-[374px]:px-2.5"
                      >
                        <p className={cx('tabular text-[20px] font-extrabold', x.hot && x.value > 0 && 'text-rose-200')}>{x.value}</p>
                        <p className="truncate text-[12px] text-white/70 max-[374px]:text-[11px]">{x.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {months.length > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="মাস">
          {months.map((m, i) => (
            <button
              key={m.period}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={labelOf(m.period)}
              onClick={() => goTo(i)}
              className={cx('h-2 rounded-full transition-all', i === idx ? 'w-6 bg-brand-600' : 'w-2 bg-slate-300')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
