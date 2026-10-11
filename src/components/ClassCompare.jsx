import React, { useMemo, useState } from 'react';
import { ChartNoAxesColumn, ChevronRight, CalendarOff } from 'lucide-react';
import { Card, cx } from './ui';
import { compareClasses, sortBy, totals, tone, COMPARE_KEYS } from '../lib/compare';
import { taka } from '../lib/format';

const BAR = { good: 'bg-emerald-500', mid: 'bg-amber-400', low: 'bg-rose-500', none: 'bg-slate-200' };
const TEXT = { good: 'text-emerald-600', mid: 'text-amber-600', low: 'text-rose-600', none: 'text-slate-400' };

/**
 * Principal's side-by-side: every class on one screen, ranked by collection, dues or today's
 * attendance. Tap a class to step inside it.
 */
export function ClassCompare({ classes, onOpenClass }) {
  const [key, setKey] = useState('pct');
  const rows = useMemo(() => compareClasses(classes), [classes]);
  const sorted = useMemo(() => sortBy(rows, key), [rows, key]);
  const t = useMemo(() => totals(rows), [rows]);
  if (classes.length < 2) return null;

  // Dues have no 100%: the bar is each class's share of the largest due
  const maxDue = Math.max(1, ...rows.map((r) => r.totalDue));

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 px-1">
        <ChartNoAxesColumn className="h-[18px] w-[18px] text-brand-600" />
        <h3 className="text-[15px] font-bold text-ink">ক্লাস তুলনা</h3>
      </div>

      <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
        {Object.entries(COMPARE_KEYS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setKey(k)} className={cx('press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold', key === k ? 'bg-ink text-white' : 'bg-white text-slate-600 shadow-card')}>
            {v.bn}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {sorted.map((r, i) => {
          const pct = key === 'pct' ? r.pct : key === 'att' ? r.attPct : null;
          const tn = key === 'due' ? (r.totalDue === 0 ? 'good' : r.totalDue / maxDue > 0.66 ? 'low' : r.totalDue / maxDue > 0.33 ? 'mid' : 'good') : tone(pct);
          const width = key === 'due' ? (r.totalDue / maxDue) * 100 : pct ?? 0;
          const figure = key === 'due' ? (r.reported ? taka(r.totalDue) : '—') : pct === null ? '—' : `${pct}%`;
          const note =
            !r.reported ? 'এখনো তথ্য আসেনি'
              : key === 'pct' ? `আদায় ${taka(r.collected)} · বাকি ${taka(r.monthDue)}`
                : key === 'due' ? `${r.overdue} জনের মেয়াদ পার`
                  : r.attendanceTaken ? `${r.absent} জন অনুপস্থিত` : 'আজ হাজিরা নেওয়া হয়নি';
          return (
            <button key={r.id} type="button" onClick={() => onOpenClass(r.id)} className="press flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold', i === 0 && r.reported && figure !== '—' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14.5px] font-bold text-ink">
                    {r.name}
                    {r.section ? ` · ${r.section}` : ''}
                  </span>
                  <span className={cx('tabular shrink-0 text-[15px] font-extrabold', TEXT[tn])}>{figure}</span>
                </span>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-slate-100">
                  <span className={cx('block h-full rounded-full transition-all duration-700', BAR[tn])} style={{ width: `${Math.max(0, Math.min(100, width))}%` }} />
                </span>
                <span className="tabular mt-1 flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="truncate">{note}</span>
                  {r.pendingLeaves > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-px text-[11px] font-bold text-sky-700">
                      <CalendarOff className="h-3 w-3" /> {r.pendingLeaves}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </Card>

      <div className="tabular mt-2.5 grid grid-cols-3 gap-2 text-center">
        {[
          ['সব মিলিয়ে আদায়', t.pct === null ? '—' : `${t.pct}%`],
          ['আজকের হাজিরা', t.attPct === null ? '—' : `${t.attPct}%`],
          ['আজ নগদ', taka(t.todayCash)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white px-2 py-2.5 shadow-card">
            <p className="text-[15px] font-extrabold text-ink">{v}</p>
            <p className="text-[11.5px] text-slate-400">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
