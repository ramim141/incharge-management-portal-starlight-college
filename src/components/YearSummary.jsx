import React, { useState } from 'react';
import { TrendingUp, TrendingDown, CalendarCheck, Gavel } from 'lucide-react';
import { Card, Progress, cx } from './ui';
import { taka, monthBn } from '../lib/format';
import { sessionLabel } from '../lib/summary';

const SHORT = { July: 'জুল', August: 'আগ', September: 'সেপ', October: 'অক্ট', November: 'নভে', December: 'ডিস', January: 'জান', February: 'ফেব', March: 'মার', April: 'এপ্র', May: 'মে', June: 'জুন' };

/** A session at a glance: totals, a bar per month (tap one for its details), attendance trend, headline findings */
export function YearSummary({ ys, sessions, session, onSession, currentPeriod }) {
  const [picked, setPicked] = useState(null);
  const t = ys.totals;
  // Open on this month if it is in the session, otherwise the last month that has fees
  const fallback = ys.months.find((m) => m.period === currentPeriod) || [...ys.months].reverse().find((m) => m.rows > 0) || ys.months[0];
  const sel = ys.months.find((m) => m.period === picked) || fallback;
  const maxTarget = Math.max(1, ...ys.months.map((m) => Math.max(m.target, m.collected)));
  const empty = t.target === 0 && t.cashIn === 0 && t.days === 0;

  return (
    <div className="space-y-4">
      {sessions.length > 1 && (
        <div className="no-print no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {sessions.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                onSession(y);
                setPicked(null);
              }}
              className={cx('press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold', y === session ? 'bg-brand-600 text-white shadow-lift' : 'bg-white text-slate-600 shadow-card')}
            >
              {sessionLabel(y)}
            </button>
          ))}
        </div>
      )}

      {empty ? (
        <Card className="p-6 text-center text-[14px] text-slate-500">এই সেশনে এখনো কোনো রেকর্ড নেই</Card>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-semibold text-white/75">সেশন {ys.label} · মোট আদায়</p>
                {t.rate !== null && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-bold">{t.rate}%</span>}
              </div>
              <p className="tabular mt-1 text-[32px] font-extrabold leading-tight">{taka(t.collected)}</p>
              <p className="tabular text-[13px] text-white/70">
                লক্ষ্য {taka(t.target)} · বাকি {taka(t.due)}
              </p>
              <Progress value={t.rate || 0} tone="white" track="bg-white/20" className="mt-3" />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['হাতে পাওয়া', taka(t.cashIn)],
                  ['গড় হাজিরা', t.attPct === null ? '—' : `${t.attPct}%`],
                  ['জরিমানা', `${t.fines}টি`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-white/10 px-2 py-2.5 ring-1 ring-inset ring-white/10">
                    <p className="tabular text-[16px] font-extrabold">{v}</p>
                    <p className="text-[11.5px] text-white/70">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly collection bars */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14.5px] font-bold text-ink">মাসভিত্তিক আদায়</p>
              <p className="flex items-center gap-3 text-[11.5px] text-slate-400">
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm bg-brand-600" /> আদায়
                </span>
                <span className="flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm bg-slate-200" /> লক্ষ্য
                </span>
              </p>
            </div>
            <div className="flex h-36 items-end gap-1">
              {ys.months.map((m) => (
                <button
                  key={m.period}
                  type="button"
                  onClick={() => setPicked(m.period)}
                  aria-label={`${monthBn(m.month)} ${m.year}`}
                  aria-pressed={m.period === sel.period}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <span className={cx('relative flex w-full flex-1 items-end overflow-hidden rounded-t-md', m.period === sel.period ? 'bg-brand-100' : 'bg-slate-100')}>
                    <span className="absolute inset-x-0 bottom-0 rounded-t-md bg-slate-200/80" style={{ height: `${(m.target / maxTarget) * 100}%` }} />
                    <span
                      className={cx('relative w-full rounded-t-md transition-all duration-500', m.future ? 'bg-brand-300' : 'bg-brand-600')}
                      style={{ height: `${(m.collected / maxTarget) * 100}%` }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              {ys.months.map((m) => (
                <span key={m.period} className={cx('min-w-0 flex-1 truncate text-center text-[10px] font-semibold', m.period === sel.period ? 'text-brand-700' : 'text-slate-400')}>
                  {SHORT[m.month]}
                </span>
              ))}
            </div>

            {/* The tapped month */}
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[14.5px] font-bold text-ink">
                  {monthBn(sel.month)} {sel.year}
                </p>
                {sel.rate !== null && <p className="tabular text-[12.5px] font-bold text-slate-500">{sel.rate}%</p>}
              </div>
              {sel.rows === 0 && sel.cashIn === 0 && sel.days === 0 ? (
                <p className="mt-1 text-[13px] text-slate-400">এই মাসে কোনো রেকর্ড নেই</p>
              ) : (
                <div className="tabular mt-2 grid grid-cols-3 gap-y-3 text-center">
                  <Cell label="লক্ষ্য" value={taka(sel.target)} />
                  <Cell label="আদায়" value={taka(sel.collected)} cls="text-emerald-600" />
                  <Cell label="বাকি" value={taka(sel.due)} cls={sel.due > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                  <Cell label="হাতে পাওয়া" value={taka(sel.cashIn)} />
                  <Cell label="হাজিরা" value={sel.attPct === null ? '—' : `${sel.attPct}%`} />
                  <Cell label="জরিমানা" value={sel.fines ? `${sel.fines}টি` : '—'} />
                </div>
              )}
            </div>
          </Card>

          {/* Attendance trend */}
          {t.attPct !== null && (
            <Card className="p-4">
              <p className="mb-3 text-[14.5px] font-bold text-ink">হাজিরার ধারা</p>
              <div className="flex h-24 items-end gap-1">
                {ys.months.map((m) => (
                  <div key={m.period} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    {m.attPct !== null && <span className="tabular mb-0.5 text-[9.5px] font-bold text-slate-500">{m.attPct}</span>}
                    <span
                      className={cx('w-full rounded-t-md transition-all duration-500', m.attPct === null ? 'h-0' : m.attPct < 75 ? 'bg-rose-400' : 'bg-emerald-500')}
                      style={m.attPct === null ? undefined : { height: `${m.attPct * 0.78}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1">
                {ys.months.map((m) => (
                  <span key={m.period} className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold text-slate-400">
                    {SHORT[m.month]}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-slate-400">লাল = 75% এর কম · {t.days} দিন ক্লাস, {t.absent}টি অনুপস্থিতি</p>
            </Card>
          )}

          {/* Findings */}
          <div className="grid gap-2.5">
            {ys.insights.bestRate && ys.insights.bestRate.rate !== null && (
              <Insight icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" title="সবচেয়ে ভালো আদায়" text={`${monthBn(ys.insights.bestRate.month)} ${ys.insights.bestRate.year} — লক্ষ্যের ${ys.insights.bestRate.rate}%`} />
            )}
            {ys.insights.mostDue && (
              <Insight icon={TrendingDown} tone="bg-rose-50 text-rose-600" title="সবচেয়ে বেশি বাকি" text={`${monthBn(ys.insights.mostDue.month)} ${ys.insights.mostDue.year} — ${taka(ys.insights.mostDue.due)}`} />
            )}
            {ys.insights.bestAtt && ys.insights.lowestAtt && ys.insights.bestAtt.period !== ys.insights.lowestAtt.period && (
              <Insight
                icon={CalendarCheck}
                tone="bg-sky-50 text-sky-600"
                title="হাজিরা"
                text={`সেরা ${monthBn(ys.insights.bestAtt.month)} (${ys.insights.bestAtt.attPct}%), সবচেয়ে কম ${monthBn(ys.insights.lowestAtt.month)} (${ys.insights.lowestAtt.attPct}%)`}
              />
            )}
            {t.fines > 0 && <Insight icon={Gavel} tone="bg-amber-50 text-amber-600" title="জরিমানা" text={`${t.fines}টি, মোট ${taka(t.fineTotal)}`} />}
          </div>

          {/* Month by month, for printing and a quick scan */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_.7fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11.5px] font-bold text-slate-500">
              <span>মাস</span>
              <span className="text-right">আদায়</span>
              <span className="text-right">বাকি</span>
              <span className="text-right">হাজিরা</span>
            </div>
            <div className="divide-y divide-slate-100">
              {ys.months.map((m) => (
                <div key={m.period} className={cx('tabular grid grid-cols-[1.1fr_1fr_1fr_.7fr] gap-2 px-4 py-2.5 text-[13px]', m.future && m.collected === 0 && 'opacity-50')}>
                  <span className="font-semibold text-ink">{monthBn(m.month)}</span>
                  <span className="text-right font-semibold text-emerald-600">{m.rows || m.cashIn ? taka(m.collected) : '—'}</span>
                  <span className={cx('text-right font-semibold', m.due > 0 ? 'text-rose-600' : 'text-slate-400')}>{m.rows ? taka(m.due) : '—'}</span>
                  <span className={cx('text-right', m.attPct !== null && m.attPct < 75 ? 'font-bold text-rose-600' : 'text-slate-600')}>{m.attPct === null ? '—' : `${m.attPct}%`}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const Cell = ({ label, value, cls }) => (
  <div>
    <p className={cx('text-[15px] font-bold text-ink', cls)}>{value}</p>
    <p className="text-[11.5px] text-slate-400">{label}</p>
  </div>
);

const Insight = ({ icon: Icon, tone, title, text }) => (
  <Card className="flex items-center gap-3 !p-3.5">
    <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', tone)}>
      <Icon className="h-5 w-5" />
    </span>
    <span className="min-w-0">
      <span className="block text-[12.5px] font-semibold text-slate-500">{title}</span>
      <span className="block text-[14px] font-bold leading-snug text-ink">{text}</span>
    </span>
  </Card>
);
