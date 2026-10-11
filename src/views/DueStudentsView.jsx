import React, { useMemo, useState } from 'react';
import { Phone, Wallet, PartyPopper, MessageSquareText, CalendarPlus, Trash2, CalendarClock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, MultiSelectPill, FilterButton, SearchBar, Card, RollBadge, Badge, EmptyState, Button, Sheet, Field, Input, cx, CARD_GRID } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { ReasonSheet } from './FeesView';
import { ReminderPanel } from '../components/Reminders';
import { taka, monthBn, feeStatus, daysLate, studentDueItems, fmtDate } from '../lib/format';
import { monthDeadline, periodOf } from '../lib/classLogic';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

export const DueStudentsView = () => {
  const { students, fees, fines, examFees, settings } = useApp();
  const { openWhatsApp, openPayment, openStudent } = useUI();
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [q, setQ] = useState('');
  const DEFAULTS = { due: 'all', group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(DEFAULTS);
  const filter = filters.due;
  const [reasonFee, setReasonFee] = useState(null);
  const [picked, setPicked] = useState([]); // periods; empty = every month

  // Months that have something owed — what the dropdown offers
  const monthOptions = useMemo(() => {
    const seen = new Map();
    fees.filter((f) => Number(f.due) > 0).forEach((f) => seen.set(periodOf(f.month, Number(f.year)), { month: f.month, year: Number(f.year) }));
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, m]) => ({ value, label: `${monthBn(m.month)} ${m.year}` }));
  }, [fees]);
  const sel = picked.filter((p) => monthOptions.some((o) => o.value === p));

  const dueList = useMemo(
    () =>
      students
        .filter((s) => s.status !== 'inactive')
        .map((s) => {
          const fee = fees.find((f) => f.studentId === s.id && f.month === settings.currentMonth);
          const st = feeStatus(fee);
          // With months picked, only those months count (fines and exam fees belong to "all months")
          const items = studentDueItems(s.id, { fees, fines, examFees }).filter((i) => (sel.length ? i.period && sel.includes(i.period) : true));
          return {
            ...s,
            items,
            fee,
            totalDue: items.reduce((a, i) => a + i.amount, 0),
            overdue: st === 'Overdue',
            late: st === 'Overdue' ? daysLate(fee?.deadline) : 0,
          };
        })
        .filter((s) => s.totalDue > 0)
        .sort((a, b) => b.late - a.late || b.totalDue - a.totalDue),
    [students, fees, fines, examFees, settings.currentMonth, sel],
  );

  const t = q.trim().toLowerCase();
  const list = dueList.filter(
    (s) =>
      (filter === 'all' || s.overdue) &&
      matchStudentFilter(s, filters) &&
      (!t || String(s.roll).includes(t) || s.name.toLowerCase().includes(t) || (s.nameEn || '').toLowerCase().includes(t) || (s.guardianPhone || '').includes(t)),
  );

  const total = dueList.reduce((a, s) => a + s.totalDue, 0);
  const overdueN = dueList.filter((s) => s.overdue).length;
  return (
    <div>
      <PageHeader title="বকেয়া ও রিমাইন্ডার" subtitle="যেকোনো মাসের বকেয়া দেখুন">
        <MultiSelectPill label="মাস" value={sel} onChange={setPicked} allLabel="সব মাস" options={monthOptions} />
      </PageHeader>

      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-500 to-rose-700 p-5 text-white shadow-[0_14px_34px_-14px_rgba(225,29,72,.7)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <p className="relative text-[13.5px] font-semibold text-white/80">মোট বকেয়া</p>
        <p className="tabular relative text-[32px] font-extrabold leading-tight max-[374px]:text-[26px]">{taka(total)}</p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold max-[374px]:px-2.5 max-[374px]:text-[12px]">{dueList.length} জন শিক্ষার্থী</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold max-[374px]:px-2.5 max-[374px]:text-[12px]">{overdueN} জন মেয়াদোত্তীর্ণ</span>
        </div>
      </div>

      <ReminderPanel list={list} />

      <button
        type="button"
        onClick={() => setMonthsOpen(true)}
        className="press mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card"
      >
        <CalendarPlus className="h-5 w-5 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold text-ink">মাসের বকেয়া তৈরি / সরান</span>
          <span className="block text-[12.5px] text-slate-500">যেকোনো মাসের বেতন বকেয়া হিসেবে যোগ করুন, শেষ তারিখ ঠিক করুন বা সরিয়ে দিন</span>
        </span>
      </button>

      <div className="mt-4 flex gap-2">
        <SearchBar className="flex-1" value={q} onChange={setQ} placeholder="রোল, নাম বা ফোন" />
        <FilterButton
          value={filters}
          defaults={DEFAULTS}
          onChange={setFilters}
          groups={[
            {
              key: 'due',
              label: 'বকেয়া',
              options: [
                { value: 'all', label: 'সবাই', count: dueList.length },
                { value: 'overdue', label: 'মেয়াদোত্তীর্ণ', count: overdueN },
              ],
            },
            ...studentFilterGroups(settings, dueList),
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={PartyPopper} title="কোনো বকেয়া নেই!" text="এই তালিকায় কেউ নেই — দারুণ কাজ।" />
      ) : (
        <div className={cx('mt-3', CARD_GRID)}>
          {list.map((s) => {
            return (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex items-center gap-3 p-4 pb-3">
                  <button type="button" onClick={() => openStudent(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <RollBadge roll={s.roll} seed={s.id} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold text-ink">{s.name}</span>
                      <span className="tabular block text-[12.5px] text-slate-500">
                        {s.guardianPhone}
                      </span>
                    </span>
                  </button>
                  <div className="text-right">
                    <p className="tabular text-[17px] font-extrabold text-rose-600">{taka(s.totalDue)}</p>
                    {s.late > 0 ? <Badge tone="red">{s.late} দিন দেরি</Badge> : <Badge tone="amber">বাকি</Badge>}
                  </div>
                </div>

                {s.items.length > 0 && (
                  <ul className="tabular mx-4 mb-3 space-y-0.5 rounded-xl bg-rose-50/60 px-3 py-2 text-[12.5px] text-rose-700">
                    {s.items.map((it) => (
                      <li key={it.label} className="flex justify-between gap-3"><span>• {it.label}</span><b>{taka(it.amount)}</b></li>
                    ))}
                  </ul>
                )}

                {s.fee && s.fee.status !== 'Paid' && (
                  <button
                    type="button"
                    onClick={() => setReasonFee(s.fee)}
                    className={cx('mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px]', s.fee.reason ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500')}
                  >
                    <MessageSquareText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{s.fee.reason ? `${s.fee.reason}${s.fee.note ? ` — ${s.fee.note}` : ''}` : 'কারণ যোগ করুন'}</span>
                  </button>
                )}

                <div className="grid grid-cols-3 border-t border-slate-100">
                  <a href={`tel:${s.guardianPhone}`} className="flex h-12 items-center justify-center gap-1.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50">
                    <Phone className="h-4 w-4" /> কল
                  </a>
                  <button type="button" onClick={() => openWhatsApp([s])} className="flex h-12 items-center justify-center gap-1.5 border-x border-slate-100 text-[14px] font-semibold text-emerald-600 active:bg-emerald-50">
                    <WhatsAppIcon className="h-4 w-4" /> রিমাইন্ডার
                  </button>
                  <button type="button" onClick={() => openPayment(s)} className="flex h-12 items-center justify-center gap-1.5 text-[14px] font-semibold text-brand-600 active:bg-brand-50">
                    <Wallet className="h-4 w-4" /> আদায়
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ReasonSheet fee={reasonFee} onClose={() => setReasonFee(null)} />
      <MonthDuesSheet open={monthsOpen} onClose={() => setMonthsOpen(false)} />
    </div>
  );
};

/** Pick any fee month: create its dues for everyone, change the payment deadline, or take it off again */
function MonthDuesSheet({ open, onClose }) {
  const { fees, feeMonths, settings, generateMonthFees, removeMonthFees, setMonthDeadline } = useApp();
  const { confirm, toast } = useUI();
  const [editing, setEditing] = useState(null); // period being created / re-dated
  const [deadline, setDeadline] = useState('');

  const rows = feeMonths.map((m) => {
    const list = fees.filter((f) => f.month === m.month && Number(f.year) === m.year);
    return {
      ...m,
      count: list.length,
      owing: list.filter((f) => Number(f.due) > 0).length,
      due: list.reduce((a, f) => a + Number(f.due || 0), 0),
      deadline: list.find((f) => f.deadline)?.deadline || '',
    };
  });

  const start = (m) => {
    setEditing(m.period);
    setDeadline(m.deadline || monthDeadline(m.month, m.year, settings.defaultFeeDeadlineDay));
  };
  const save = async (m) => {
    if (!deadline) return;
    if (m.count > 0) {
      const n = await setMonthDeadline(m.month, m.year, deadline);
      toast(`${n} জনের শেষ তারিখ ${fmtDate(deadline)} হয়েছে`);
    } else {
      const n = await generateMonthFees(m.month, m.year, deadline);
      toast(`${monthBn(m.month)} মাসের বকেয়া ${n} জনের জন্য তৈরি হয়েছে`);
    }
    setEditing(null);
  };
  const remove = async (m) => {
    const ok = await confirm({
      title: `${monthBn(m.month)} ${m.year}-এর বকেয়া সরাবেন?`,
      message: 'যাদের কিছুই পরিশোধ করা হয়নি তাদের এই মাসের বেতন তালিকা থেকে মুছে যাবে। যারা টাকা দিয়েছে তাদেরটা থেকে যাবে।',
      confirmText: 'সরিয়ে দিন',
      icon: Trash2,
    });
    if (!ok) return;
    const { removed, kept } = await removeMonthFees(m.month, m.year);
    toast(`${removed} জনের বকেয়া সরানো হয়েছে${kept ? ` (${kept} জনের পরিশোধ আছে, রাখা হয়েছে)` : ''}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="মাসের বকেয়া" subtitle="তৈরি করুন, শেষ তারিখ বদলান বা সরান">
      <div className="space-y-2.5 pb-2 pt-1">
        {rows.length === 0 && <p className="py-6 text-center text-[14px] text-slate-400">কোনো মাস নেই</p>}
        {rows.map((m) => (
          <div key={m.period} className="rounded-2xl bg-slate-50 p-3.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-ink">
                  {monthBn(m.month)} {m.year}
                </p>
                <p className="tabular text-[12.5px] text-slate-500">
                  {m.count === 0 ? 'বকেয়া তৈরি হয়নি' : `${m.count} জনের তৈরি · ${m.owing} জনের বাকি ${taka(m.due)}`}
                  {m.deadline ? ` · শেষ তারিখ ${fmtDate(m.deadline)}` : ''}
                </p>
              </div>
              {m.count === 0 ? (
                <Button size="sm" variant="soft" icon={CalendarPlus} onClick={() => start(m)}>
                  তৈরি করুন
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => start(m)} aria-label="শেষ তারিখ" />
                  <Button size="sm" variant="soft-danger" icon={Trash2} onClick={() => remove(m)} aria-label="সরান" />
                </div>
              )}
            </div>
            {editing === m.period && (
              <div className="mt-3 space-y-2.5 border-t border-slate-200 pt-3">
                <Field label="পরিশোধের শেষ তারিখ">
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
                    বাতিল
                  </Button>
                  <Button variant="primary" className="flex-1" disabled={!deadline} onClick={() => save(m)}>
                    {m.count === 0 ? 'তৈরি করুন' : 'তারিখ বদলান'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
