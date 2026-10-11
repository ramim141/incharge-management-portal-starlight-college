import React, { useState } from 'react';
import { Plus, ReceiptText, HandCoins, NotebookTabs } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SearchBar, EmptyState, Button, IconButton, CARD_GRID, cx } from '../components/ui';
import { taka, fmtDate, fmtTime, dayNameBn, toISODate, todayISO, monthBn, EN_MONTHS, METHODS } from '../lib/format';
import { periodOf, ADMISSION_NOTE } from '../lib/classLogic';

const METHOD_DOT = Object.fromEntries(METHODS.map((m) => [m.id, m.color]));
const labelOf = (period) => `${monthBn(EN_MONTHS[Number(period.slice(5, 7)) - 1])} ${period.slice(0, 4)}`;

export const PaymentsView = () => {
  const { payments, fees } = useApp();
  const { openPayment, openReceipt, openDayClose } = useUI();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('All');
  const [period, setPeriod] = useState('all'); // 'all' or 'YYYY-MM'

  const today = todayISO();
  const monthKey = today.slice(0, 7);
  const dayOf = (p) => toISODate(new Date(p.paymentDate));
  const valid = payments.filter((p) => p.status !== 'void');
  const todayList = valid.filter((p) => dayOf(p) === today);
  const sum = (list) => list.reduce((a, p) => a + Number(p.amount), 0);

  // Fees taken together with admission have no receipt — shown apart so a month is never "empty" by mistake
  const admission = fees.filter((f) => !f.beforeStart && f.note === ADMISSION_NOTE && Number(f.paid) > 0);
  const months = [...new Set([monthKey, ...payments.map((p) => dayOf(p).slice(0, 7)), ...admission.map((f) => periodOf(f.month, Number(f.year)))])]
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .sort()
    .reverse();
  const inPeriod = (key) => period === 'all' || key === period;
  const admissionShown = admission.filter((f) => inPeriod(periodOf(f.month, Number(f.year))));
  const admissionTotal = admissionShown.reduce((a, f) => a + Number(f.paid || 0), 0);
  const periodTotal = sum(valid.filter((p) => dayOf(p).startsWith(period === 'all' ? monthKey : period)));
  const periodCount = valid.filter((p) => dayOf(p).startsWith(period === 'all' ? monthKey : period)).length;

  const t = q.trim().toLowerCase();
  const list = payments
    .filter((p) => period === 'all' || dayOf(p).startsWith(period))
    .filter((p) => method === 'All' || p.method === method)
    .filter((p) => !t || p.receiptNo.toLowerCase().includes(t) || p.studentName.toLowerCase().includes(t) || String(p.roll).includes(t))
    .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  const groups = [];
  list.forEach((p) => {
    const d = dayOf(p);
    const g = groups[groups.length - 1];
    if (g && g.date === d) g.items.push(p);
    else groups.push({ date: d, items: [p] });
  });

  // Only offer the payment methods that were actually used
  const methods = METHODS.map((m) => ({ ...m, count: payments.filter((p) => p.method === m.id).length })).filter((m) => m.count > 0);

  return (
    <div>
      <PageHeader
        title="পেমেন্ট ও রশিদ"
        subtitle={`মোট ${payments.length}টি লেনদেন`}
        actions={<IconButton icon={NotebookTabs} label="দিনের হিসাব" onClick={() => openDayClose(todayISO())} />}
      >
        <SearchBar value={q} onChange={setQ} placeholder="রশিদ নং, নাম বা রোল" />
      </PageHeader>

      {/* Collection summary */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 p-4 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/12 p-3.5 ring-1 ring-inset ring-white/15">
            <p className="text-[12.5px] font-semibold text-white/75">আজকের আদায়</p>
            <p className="tabular mt-0.5 text-[24px] font-extrabold leading-tight max-[374px]:text-[20px]">{taka(sum(todayList))}</p>
            <p className="text-[12px] text-white/70">{todayList.length}টি রশিদ</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-3.5 ring-1 ring-inset ring-white/15">
            <p className="text-[12.5px] font-semibold text-white/75">{period === 'all' || period === monthKey ? 'এই মাসে' : labelOf(period)}</p>
            <p className="tabular mt-0.5 text-[24px] font-extrabold leading-tight max-[374px]:text-[20px]">{taka(periodTotal)}</p>
            <p className="text-[12px] text-white/70">{periodCount}টি রশিদ</p>
          </div>
        </div>
      </div>

      {/* Any earlier month's history */}
      {months.length > 1 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {[{ id: 'all', label: 'সব সময়' }, ...months.map((m) => ({ id: m, label: labelOf(m) }))].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPeriod(m.id)}
              className={cx('press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold', period === m.id ? 'bg-brand-600 text-white shadow-lift' : 'bg-white text-slate-600 shadow-card')}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {admissionTotal > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-3xl bg-emerald-50 p-3.5 ring-1 ring-emerald-100">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
            <HandCoins className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold text-emerald-950">ভর্তির সময় নেওয়া</span>
            <span className="block text-[12.5px] text-emerald-800">
              {admissionShown.length} জনের বেতন · রশিদ ছাড়া
              {period === 'all' && ` · ${[...new Set(admissionShown.map((f) => monthBn(f.month)))].join(', ')}`}
            </span>
          </span>
          <span className="tabular shrink-0 text-[17px] font-extrabold text-emerald-700">{taka(admissionTotal)}</span>
        </div>
      )}

      {/* Payment method chips */}
      {methods.length > 1 && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {[{ id: 'All', label: 'সব', count: payments.length }, ...methods.map((m) => ({ id: m.id, label: m.id, count: m.count }))].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cx('press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold', method === m.id ? 'bg-ink text-white' : 'bg-white text-slate-600 shadow-card')}
            >
              {m.label} <span className={cx('tabular ml-0.5 text-[12.5px]', method === m.id ? 'text-white/70' : 'text-slate-400')}>{m.count}</span>
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={payments.length === 0 ? 'রশিদ কাটা কোনো লেনদেন নেই' : 'কিছু পাওয়া যায়নি'}
          text={payments.length === 0 ? 'নতুন পেমেন্ট নিলে রশিদ এখানে জমা থাকবে' : period !== 'all' || method !== 'All' || q ? 'এই মাস বা ফিল্টারে কোনো রশিদ নেই — অন্য মাস বা নাম/রোল দিয়ে খুঁজুন' : 'অন্য নাম, রোল বা রশিদ নম্বর দিয়ে খুঁজুন'}
          action={
            payments.length === 0 && (
              <Button icon={Plus} onClick={() => openPayment()}>
                টাকা আদায়
              </Button>
            )
          }
        />
      ) : (
        groups.map((g) => (
          <div key={g.date}>
            <div className="mb-2 mt-5 flex items-baseline justify-between px-1">
              <p className="text-[13.5px] font-bold text-slate-600">
                {g.date === today ? 'আজ' : dayNameBn(g.date)}, {fmtDate(g.date, { year: g.date.slice(0, 4) !== today.slice(0, 4) })}
              </p>
              <p className="tabular text-[13px] font-bold text-emerald-600">
                {taka(g.items.reduce((a, p) => a + Number(p.amount), 0))}
                <span className="ml-1.5 font-medium text-slate-400">· {g.items.length}টি</span>
              </p>
            </div>
            <div className={CARD_GRID}>
              {g.items.map((p) => {
                const voided = p.status === 'void';
                const what = (p.items || []).map((it) => it.description).filter(Boolean).join(', ');
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openReceipt(p)}
                    className={cx('press block w-full rounded-3xl bg-white p-3.5 text-left shadow-card', voided && 'opacity-60')}
                  >
                    <span className="flex items-center gap-3">
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <ReceiptText className="h-5 w-5" />
                        <span className={cx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', METHOD_DOT[p.method] || 'bg-slate-400')} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{p.studentName}</span>
                        <span className="tabular block text-[12.5px] text-slate-500">রোল {p.roll}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={cx('tabular block text-[17px] font-extrabold', voided ? 'text-slate-400 line-through' : 'text-emerald-600')}>{taka(p.amount)}</span>
                        <span className="block text-[12px] font-medium text-slate-400">{voided ? 'বাতিল' : p.method}</span>
                      </span>
                    </span>
                    {what && <span className="mt-2.5 block truncate rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{what}</span>}
                    <span className="tabular mt-2 flex items-center justify-between text-[12px] text-slate-400">
                      <span>{p.receiptNo}</span>
                      <span>{fmtTime(p.paymentDate)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
