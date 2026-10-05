import React, { useState } from 'react';
import { Zap, MessageSquareText, Wallet, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Chips, SearchBar, Card, Avatar, Badge, Button, IconButton, Sheet, Textarea, EmptyState, cx, CARD_GRID } from '../components/ui';
import { taka, monthBn, ACADEMIC_MONTHS, FEE_STATUS, feeStatus, daysLate } from '../lib/format';

export const REASONS = [
  'আর্থিক সমস্যা',
  'অসুস্থ',
  'অভিভাবক বাইরে',
  'পরে দেবে',
  'ভুলে গেছে',
  'অন্য কারণ',
];

export const FeesView = () => {
  const { fees, students, settings, applyAutoFines, generateMonthFees } = useApp();
  const { openPayment, confirm, toast } = useUI();

  const sessionStart = ACADEMIC_MONTHS.indexOf(settings.currentMonth) <= 5 ? settings.currentYear : settings.currentYear - 1;
  const yearOf = (m) => (ACADEMIC_MONTHS.indexOf(m) <= 5 ? sessionStart : sessionStart + 1);

  const [month, setMonth] = useState(settings.currentMonth);
  const [status, setStatus] = useState('All');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const year = yearOf(month);
  const monthFees = fees.filter((f) => f.month.toLowerCase() === month.toLowerCase() && Number(f.year) === year);
  const withStudent = monthFees
    .map((f) => ({ f, s: students.find((x) => x.id === f.studentId || x.roll === Number(f.roll)), st: feeStatus(f) }))
    .sort((a, b) => Number(a.f.roll) - Number(b.f.roll));

  const t = q.trim().toLowerCase();
  const list = withStudent.filter(
    ({ f, s, st }) =>
      (status === 'All' || st === status || (status === 'Due' && st === 'Partial')) &&
      (!t || String(f.roll).includes(t) || (s?.name || '').toLowerCase().includes(t) || (s?.nameEn || '').toLowerCase().includes(t)),
  );

  const missing = students.filter((s) => s.status !== 'inactive' && !monthFees.some((f) => f.studentId === s.id)).length;
  const createMonth = async () => {
    const n = await generateMonthFees(month, year);
    toast(`${monthBn(month)} মাসের বেতন ${n} জনের জন্য তৈরি হয়েছে`);
  };

  const collected = monthFees.reduce((a, f) => a + Number(f.paid || 0), 0);
  const due = monthFees.reduce((a, f) => a + Number(f.due || 0), 0);
  const cnt = (k) => withStudent.filter(({ st }) => st === k || (k === 'Due' && st === 'Partial')).length;

  const runAutoFine = async () => {
    const ok = await confirm({
      title: 'বিলম্ব জরিমানা যোগ করবেন?',
      message: `${monthBn(month)} মাসে সময়সীমা পার করা প্রত্যেকের সাথে ${taka(settings.fixedFineAfterDeadline)} জরিমানা যোগ হবে (যাদের আগে যোগ হয়নি)।`,
      confirmText: 'যোগ করুন',
      icon: Zap,
    });
    if (!ok) return;
    const n = await applyAutoFines(month);
    toast(n > 0 ? `${n} জনের সাথে জরিমানা যোগ হয়েছে` : 'নতুন কারো জরিমানা প্রযোজ্য নয়', n > 0 ? 'success' : 'info');
  };

  return (
    <div>
      <PageHeader
        title="মাসিক বেতন"
        subtitle={`${monthBn(month)} ${year} · শেষ তারিখ ${settings.defaultFeeDeadlineDay} ${monthBn(month)}`}
        actions={<IconButton icon={Zap} label="স্বয়ংক্রিয় জরিমানা" onClick={runAutoFine} />}
      >
        <Chips value={month} onChange={setMonth} options={ACADEMIC_MONTHS.map((m) => ({ value: m, label: monthBn(m) }))} />
      </PageHeader>

      {missing > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold text-ink">{missing} জনের {monthBn(month)} মাসের বেতন তৈরি হয়নি</p>
            <p className="text-[12.5px] text-slate-600">প্রত্যেকের মাসিক বেতন ও শেষ তারিখ দিয়ে তৈরি হবে</p>
          </div>
          <Button size="sm" onClick={createMonth}>
            তৈরি করুন
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[12.5px] font-semibold text-slate-500">আদায় হয়েছে</p>
          <p className="tabular mt-1 text-[22px] font-extrabold text-emerald-600">{taka(collected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12.5px] font-semibold text-slate-500">বাকি আছে</p>
          <p className="tabular mt-1 text-[22px] font-extrabold text-rose-600">{taka(due)}</p>
        </Card>
      </div>

      <Chips
        className="mt-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'All', label: 'সবাই', count: withStudent.length },
          { value: 'Paid', label: '🟢 পরিশোধিত', count: cnt('Paid') },
          { value: 'Due', label: '🟡 বাকি', count: cnt('Due') },
          { value: 'Overdue', label: '🔴 মেয়াদোত্তীর্ণ', count: cnt('Overdue') },
        ]}
      />
      <SearchBar className="mt-3" value={q} onChange={setQ} placeholder="রোল বা নাম" />

      {list.length === 0 ? (
        <EmptyState icon={CreditCard} title="কোনো রেকর্ড নেই" text={`${monthBn(month)} মাসের জন্য এই ফিল্টারে কিছু পাওয়া যায়নি`} />
      ) : (
        <div className={cx('mt-3', CARD_GRID)}>
          {list.map(({ f, s, st }) => {
            const late = st === 'Overdue' ? daysLate(f.deadline) : 0;
            return (
              <Card key={f.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar src={s?.avatar} name={s?.nameEn || s?.name || String(f.roll)} seed={f.studentId} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] font-semibold text-ink">{s?.name || `রোল ${f.roll}`}</p>
                    <p className="text-[12.5px] text-slate-500">
                      রোল {f.roll}
                      {late > 0 && <span className="font-semibold text-rose-600"> · {late} দিন দেরি</span>}
                    </p>
                  </div>
                  <Badge tone={FEE_STATUS[st]?.tone} dot>
                    {FEE_STATUS[st]?.bn}
                  </Badge>
                </div>

                <div className="tabular mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-center">
                  <Amt label="ফি" value={f.amount} />
                  <Amt label="জরিমানা" value={f.fine || 0} cls={f.fine ? 'text-amber-600' : ''} />
                  <Amt label="বাকি" value={f.due || 0} cls={Number(f.due) > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                </div>

                {st !== 'Paid' && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      className={cx(
                        'press flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px]',
                        f.reason ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-500',
                      )}
                    >
                      <MessageSquareText className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{f.reason ? `${f.reason}${f.note ? ` — ${f.note}` : ''}` : 'না দেওয়ার কারণ যোগ করুন'}</span>
                    </button>
                    <Button size="sm" icon={Wallet} onClick={() => s && openPayment(s)}>
                      আদায়
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ReasonSheet fee={editing} onClose={() => setEditing(null)} />
    </div>
  );
};

const Amt = ({ label, value, cls }) => (
  <div>
    <p className="text-[11.5px] text-slate-400">{label}</p>
    <p className={cx('text-[15px] font-bold text-ink', cls)}>{taka(value)}</p>
  </div>
);

export function ReasonSheet({ fee, onClose }) {
  const { students, updateFee } = useApp();
  const { toast } = useUI();
  const s = fee ? students.find((x) => x.id === fee.studentId) : null;
  return (
    <Sheet open={!!fee} onClose={onClose} title="ফি না দেওয়ার কারণ" subtitle={fee ? `${s?.name || ''} · রোল ${fee.roll} · ${monthBn(fee.month)}` : ''}>
      {fee && <ReasonForm fee={fee} onDone={onClose} updateFee={updateFee} toast={toast} />}
    </Sheet>
  );
}

function ReasonForm({ fee, onDone, updateFee, toast }) {
  const [reason, setReason] = useState(() => REASONS.find((r) => fee.reason?.startsWith(r)) || fee.reason || '');
  const [note, setNote] = useState(fee.note || '');

  const save = async () => {
    await updateFee(fee.id, { reason, note });
    toast('কারণ সংরক্ষিত হয়েছে');
    onDone();
  };

  return (
    <div className="space-y-5 pt-1">
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cx(
              'press h-11 rounded-2xl px-4 text-[14.5px] font-semibold ring-1 ring-inset',
              reason === r ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-200',
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[13.5px] font-semibold text-slate-700">ইনচার্জের নোট (শুধু আপনি দেখবেন)</p>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন: অভিভাবক আগামী সপ্তাহে বেতন দেবেন।" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            await updateFee(fee.id, { reason: '', note: '' });
            onDone();
          }}
        >
          মুছে দিন
        </Button>
        <Button onClick={save} disabled={!reason}>
          সংরক্ষণ
        </Button>
      </div>
    </div>
  );
}
