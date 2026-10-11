import React, { useEffect, useMemo, useState } from 'react';
import { ReceiptText, Gavel, Wallet, ClipboardList, Users, BellRing, Trash2, ScrollText } from 'lucide-react';
import { backend } from '../backend';
import { useApp } from '../context/AppContext';
import { PageHeader, SearchBar, Card, EmptyState, Button, cx } from '../components/ui';
import { ListSkeleton } from '../components/Skeletons';
import { taka, fmtDate, fmtTime, dayNameBn, todayISO, shiftISODate, toISODate } from '../lib/format';

const KINDS = {
  payment: { label: 'পেমেন্ট', icon: ReceiptText, tile: 'bg-emerald-50 text-emerald-600' },
  fine: { label: 'জরিমানা', icon: Gavel, tile: 'bg-rose-50 text-rose-600' },
  fee: { label: 'বেতন', icon: Wallet, tile: 'bg-brand-50 text-brand-600' },
  exam: { label: 'পরীক্ষা', icon: ClipboardList, tile: 'bg-amber-50 text-amber-600' },
  student: { label: 'শিক্ষার্থী', icon: Users, tile: 'bg-sky-50 text-sky-600' },
  reminder: { label: 'রিমাইন্ডার', icon: BellRing, tile: 'bg-slate-100 text-slate-600' },
};
const PAGE = 60;

/** Who changed what, and when — newest first. Entries are only ever added, never edited. */
export const AuditView = () => {
  const { classId } = useApp();
  const [logs, setLogs] = useState(null); // null = still loading
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => backend.subscribeCollection(['classes', classId, 'audit'], (rows) => setLogs(rows || [])), [classId]);

  const sorted = useMemo(() => [...(logs || [])].sort((a, b) => String(b.at).localeCompare(String(a.at))), [logs]);
  const t = q.trim().toLowerCase();
  const list = sorted.filter(
    (e) => (kind === 'all' || e.kind === kind) && (!t || [e.text, e.detail, e.action, e.by, String(e.roll ?? '')].some((v) => String(v || '').toLowerCase().includes(t))),
  );
  const visible = list.slice(0, shown);

  const groups = [];
  visible.forEach((e) => {
    const d = toISODate(new Date(e.at));
    const g = groups[groups.length - 1];
    if (g && g.date === d) g.items.push(e);
    else groups.push({ date: d, items: [e] });
  });

  const today = todayISO();
  const dayLabel = (d) => (d === today ? 'আজ' : d === shiftISODate(today, -1) ? 'গতকাল' : dayNameBn(d));
  const count = (k) => sorted.filter((e) => k === 'all' || e.kind === k).length;

  return (
    <div>
      <PageHeader title="অডিট লগ" subtitle="কে কখন কী বদলেছেন">
        <SearchBar value={q} onChange={setQ} placeholder="নাম, রোল বা রশিদ নম্বর" />
      </PageHeader>

      {logs === null ? (
        <ListSkeleton rows={6} summary={false} />
      ) : (
        <>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {[['all', 'সব'], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setShown(PAGE);
                }}
                className={cx('press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold', kind === k ? 'bg-ink text-white' : 'bg-white text-slate-600 shadow-card')}
              >
                {label} <span className={cx('tabular ml-0.5 text-[12.5px]', kind === k ? 'text-white/70' : 'text-slate-400')}>{count(k)}</span>
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <EmptyState icon={ScrollText} title={sorted.length === 0 ? 'এখনো কোনো রেকর্ড নেই' : 'কিছু পাওয়া যায়নি'} text={sorted.length === 0 ? 'পেমেন্ট, জরিমানা বা বেতনে কিছু বদলালে এখানে জমা হবে' : 'অন্য ফিল্টার বা নাম দিয়ে খুঁজুন'} />
          ) : (
            groups.map((g) => (
              <div key={g.date}>
                <div className="mb-2 mt-5 flex items-baseline justify-between px-1">
                  <p className="text-[13.5px] font-bold text-slate-600">
                    {dayLabel(g.date)}, {fmtDate(g.date, { year: g.date.slice(0, 4) !== today.slice(0, 4) })}
                  </p>
                  <p className="tabular text-[12.5px] font-semibold text-slate-400">{g.items.length}টি</p>
                </div>
                <Card className="divide-y divide-slate-100 overflow-hidden">
                  {g.items.map((e) => {
                    const k = KINDS[e.kind] || KINDS.fee;
                    const danger = /মুছ/.test(e.action || '');
                    const Icon = danger ? Trash2 : k.icon;
                    return (
                      <div key={e.id} className="flex items-start gap-3 px-4 py-3.5">
                        <span className={cx('mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl', danger ? 'bg-rose-50 text-rose-600' : k.tile)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx('block text-[14.5px] font-bold leading-snug', danger ? 'text-rose-700' : 'text-ink')}>{e.action}</span>
                          {e.text && <span className="block text-[13.5px] text-slate-700">{e.text}</span>}
                          {e.detail && <span className="tabular block text-[12.5px] text-slate-500">{e.detail}</span>}
                          <span className="mt-1 block text-[12px] text-slate-400">
                            {e.by || '—'} · {fmtTime(e.at)}
                          </span>
                        </span>
                        {e.amount != null && Number(e.amount) > 0 && (
                          <span className="tabular shrink-0 pt-0.5 text-[15px] font-extrabold text-ink">{taka(e.amount)}</span>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))
          )}

          {list.length > shown && (
            <Button variant="secondary" block className="mt-4" onClick={() => setShown((n) => n + PAGE)}>
              আরও দেখান ({list.length - shown}টি)
            </Button>
          )}
        </>
      )}
    </div>
  );
};
