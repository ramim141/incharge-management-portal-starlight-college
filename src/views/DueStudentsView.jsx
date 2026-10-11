import React, { useMemo, useState } from 'react';
import { Phone, Wallet, PartyPopper, MessageSquareText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, FilterButton, SearchBar, Card, RollBadge, Badge, EmptyState, cx, CARD_GRID } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { ReasonSheet } from './FeesView';
import { taka, monthBn, feeStatus, daysLate } from '../lib/format';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

export const DueStudentsView = () => {
  const { students, fees, settings, calculateStudentTotalDue } = useApp();
  const { openWhatsApp, openPayment, openStudent } = useUI();
  const [q, setQ] = useState('');
  const DEFAULTS = { due: 'all', group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(DEFAULTS);
  const filter = filters.due;
  const [reasonFee, setReasonFee] = useState(null);

  const dueList = useMemo(
    () =>
      students
        .filter((s) => s.status !== 'inactive')
        .map((s) => {
          const fee = fees.find((f) => f.studentId === s.id && f.month === settings.currentMonth);
          const st = feeStatus(fee);
          return {
            ...s,
            fee,
            totalDue: calculateStudentTotalDue(s.id),
            overdue: st === 'Overdue',
            late: st === 'Overdue' ? daysLate(fee?.deadline) : 0,
          };
        })
        .filter((s) => s.totalDue > 0)
        .sort((a, b) => b.late - a.late || b.totalDue - a.totalDue),
    [students, fees, settings.currentMonth, calculateStudentTotalDue],
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
      <PageHeader title="বকেয়া ও রিমাইন্ডার" subtitle={`${monthBn(settings.currentMonth)} ${settings.currentYear}`} />

      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-500 to-rose-700 p-5 text-white shadow-[0_14px_34px_-14px_rgba(225,29,72,.7)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <p className="relative text-[13.5px] font-semibold text-white/80">মোট বকেয়া</p>
        <p className="tabular relative text-[32px] font-extrabold leading-tight max-[374px]:text-[26px]">{taka(total)}</p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold max-[374px]:px-2.5 max-[374px]:text-[12px]">{dueList.length} জন শিক্ষার্থী</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold max-[374px]:px-2.5 max-[374px]:text-[12px]">{overdueN} জন মেয়াদোত্তীর্ণ</span>
        </div>
      </div>

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
    </div>
  );
};
