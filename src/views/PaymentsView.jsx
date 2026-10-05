import React, { useState } from 'react';
import { Plus, ReceiptText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SearchBar, Chips, Card, IconButton, EmptyState, Button, cx } from '../components/ui';
import { taka, fmtDate, fmtTime, dayNameBn, toISODate, todayISO, METHODS } from '../lib/format';

const METHOD_DOT = Object.fromEntries(METHODS.map((m) => [m.id, m.color]));

export const PaymentsView = () => {
  const { payments } = useApp();
  const { openPayment, openReceipt } = useUI();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('All');

  const today = todayISO();
  const monthKey = today.slice(0, 7);
  const dayOf = (p) => toISODate(new Date(p.paymentDate));
  const todayTotal = payments.filter((p) => dayOf(p) === today).reduce((a, p) => a + Number(p.amount), 0);
  const monthTotal = payments.filter((p) => dayOf(p).startsWith(monthKey)).reduce((a, p) => a + Number(p.amount), 0);

  const t = q.trim().toLowerCase();
  const list = payments
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

  return (
    <div>
      <PageHeader
        title="পেমেন্ট ও রশিদ"
        subtitle={`মোট ${payments.length}টি লেনদেন`}
        actions={<IconButton icon={Plus} label="নতুন পেমেন্ট" onClick={() => openPayment()} />}
      >
        <SearchBar value={q} onChange={setQ} placeholder="রশিদ নং, নাম বা রোল" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[12.5px] font-semibold text-slate-500">আজকের আদায়</p>
          <p className="tabular mt-1 text-[22px] font-extrabold text-ink">{taka(todayTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-semibold text-slate-500">এই মাসে</p>
          <p className="tabular mt-1 text-[22px] font-extrabold text-emerald-600">{taka(monthTotal)}</p>
        </Card>
      </div>

      <Chips
        className="mt-4"
        value={method}
        onChange={setMethod}
        options={[{ value: 'All', label: 'সব মাধ্যম' }, ...METHODS.map((m) => ({ value: m.id, label: m.id }))]}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="কোনো লেনদেন নেই"
          text="নতুন পেমেন্ট নিলে রশিদ এখানে জমা থাকবে"
          action={
            <Button icon={Plus} onClick={() => openPayment()}>
              টাকা আদায়
            </Button>
          }
        />
      ) : (
        groups.map((g) => (
          <div key={g.date}>
            <div className="mb-2 mt-5 flex items-baseline justify-between px-1">
              <p className="text-[13.5px] font-bold text-slate-600">
                {g.date === today ? 'আজ' : dayNameBn(g.date)}, {fmtDate(g.date, { year: g.date.slice(0, 4) !== today.slice(0, 4) })}
              </p>
              <p className="tabular text-[13px] font-semibold text-slate-400">{taka(g.items.reduce((a, p) => a + Number(p.amount), 0))}</p>
            </div>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {g.items.map((p) => (
                <button key={p.id} type="button" onClick={() => openReceipt(p)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ReceiptText className="h-5 w-5" />
                    <span className={cx('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', METHOD_DOT[p.method] || 'bg-slate-400')} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{p.studentName}</span>
                    <span className="tabular block text-[12.5px] text-slate-500">
                      রোল {p.roll} · {p.receiptNo} · {fmtTime(p.paymentDate)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[15.5px] font-bold text-emerald-600">{taka(p.amount)}</span>
                    <span className="block text-[12px] text-slate-400">{p.method}</span>
                  </span>
                </button>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
};
