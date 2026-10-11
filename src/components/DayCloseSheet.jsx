import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, Lock, LockOpen, TriangleAlert, CheckCircle2, ReceiptText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, Field, Input, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { dayCloseSummary, cashDifference, dayCloseText } from '../lib/dayClose';
import { taka, fmtDate, fmtTime, dayNameBn, todayISO, shiftISODate, waLink } from '../lib/format';

/** "দিনের হিসাব": what came in on a day, by method and purpose, with the cash count to close it */
export function DayCloseSheet() {
  const { dayClose, closeDayClose } = useUI();
  return (
    <Sheet open={!!dayClose} onClose={closeDayClose} printable full title="দিনের ক্যাশ হিসাব" subtitle="আদায় মিলিয়ে দিন ক্লোজ করুন">
      {dayClose && <Body key={dayClose.date} initialDate={dayClose.date} />}
    </Sheet>
  );
}

function Body({ initialDate }) {
  const { payments, closings, closeDay, reopenDay, settings } = useApp();
  const { openReceipt, confirm, toast } = useUI();
  const today = todayISO();
  const [date, setDate] = useState(initialDate || today);
  const s = useMemo(() => dayCloseSummary(payments, date), [payments, date]);
  const closing = closings[date];

  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const countedNum = counted === '' ? s.expectedCash : Number(counted) || 0;
  const diff = cashDifference(countedNum, s.expectedCash);
  // Money moved after the day was closed (a receipt edited, deleted or added)
  const changedAfter = closing && (Number(closing.total) !== s.total || Number(closing.expectedCash) !== s.expectedCash);

  const dayLabel = `${date === today ? 'আজ' : dayNameBn(date)}, ${fmtDate(date)}`;
  const shiftDay = (n) => {
    setDate((d) => shiftISODate(d, n));
    setCounted('');
    setNote('');
  };

  const close = async () => {
    if (busy) return;
    if (diff !== 0) {
      const ok = await confirm({
        title: diff > 0 ? `${taka(diff)} বেশি আছে` : `${taka(Math.abs(diff))} কম আছে`,
        message: 'গোনা ক্যাশ আর রশিদের হিসাব মেলেনি। তবুও দিন ক্লোজ করবেন? পার্থক্যটা নোটসহ লগে থাকবে।',
        confirmText: 'ক্লোজ করুন',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    await closeDay({ date, countedCash: countedNum, note: note.trim() });
    setBusy(false);
    toast(diff === 0 ? 'দিন ক্লোজ হয়েছে, হিসাব মিলেছে' : 'দিন ক্লোজ হয়েছে');
  };

  const reopen = async () => {
    const ok = await confirm({ title: 'আবার খুলবেন?', message: `${dayLabel}-এর ক্লোজ বাতিল হবে। নতুন করে ক্যাশ গুনে ক্লোজ করতে হবে।`, confirmText: 'আবার খুলুন', icon: LockOpen });
    if (ok) {
      await reopenDay(date);
      toast('দিন আবার খোলা হয়েছে');
    }
  };

  const shareText = dayCloseText({ summary: s, closing, institution: settings.institutionName, className: settings.className, date, dateLabel: dayLabel });

  return (
    <div className="space-y-4 pt-1">
      {/* Day picker */}
      <div className="no-print flex items-center gap-2">
        <button type="button" onClick={() => shiftDay(-1)} aria-label="আগের দিন" className="press grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15.5px] font-bold text-ink">{dayLabel}</p>
          <p className={cx('text-[12.5px] font-semibold', closing ? 'text-emerald-600' : 'text-amber-600')}>{closing ? '● ক্লোজ করা হয়েছে' : '● এখনো ক্লোজ হয়নি'}</p>
        </div>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          disabled={date >= today}
          aria-label="পরের দিন"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Printed header */}
      <div className="print-only text-center">
        <p className="text-[18px] font-bold">{settings.institutionName}</p>
        <p className="text-[13px]">{settings.sectionName}</p>
        <p className="mt-1 text-[15px] font-bold">দিনের ক্যাশ হিসাব — {dayLabel}</p>
      </div>

      {/* Total */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 p-4 text-white">
        <p className="text-[13px] font-semibold text-white/75">মোট আদায়</p>
        <p className="tabular text-[32px] font-extrabold leading-tight">{taka(s.total)}</p>
        <p className="text-[12.5px] text-white/75">{s.count}টি রশিদ</p>
      </div>

      {s.count === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">এই দিনে কোনো আদায় হয়নি</p>
      ) : (
        <>
          {/* By method */}
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
            <p className="mb-2.5 text-[13px] font-semibold text-slate-500">মাধ্যম অনুযায়ী</p>
            <div className="space-y-2.5">
              {s.byMethod.filter((m) => m.count > 0).map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className={cx('h-3 w-3 shrink-0 rounded-full', m.color)} />
                  <span className="flex-1 text-[14.5px] font-semibold text-ink">{m.bn}</span>
                  <span className="tabular text-[12.5px] text-slate-400">{m.count}টি</span>
                  <span className="tabular w-24 text-right text-[15px] font-bold text-ink">{taka(m.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By purpose */}
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
            <p className="mb-2.5 text-[13px] font-semibold text-slate-500">খাত অনুযায়ী</p>
            <div className="grid grid-cols-2 gap-2">
              {s.purposes.map((p) => (
                <div key={p.id} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                  <p className="tabular text-[16px] font-extrabold text-ink">{taka(p.total)}</p>
                  <p className="text-[12px] text-slate-500">{p.bn}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Receipts */}
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-100">
            <p className="px-4 pb-1 pt-3.5 text-[13px] font-semibold text-slate-500">রশিদের তালিকা</p>
            <div className="divide-y divide-slate-100">
              {s.list.map((p) => (
                <button key={p.id} type="button" onClick={() => openReceipt(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                  <ReceiptText className="h-5 w-5 shrink-0 text-slate-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{p.studentName}</span>
                    <span className="tabular block text-[12px] text-slate-500">
                      রোল {p.roll} · {fmtTime(p.paymentDate)} · {p.method}
                    </span>
                  </span>
                  <span className="tabular text-[14.5px] font-bold text-emerald-600">{taka(p.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Cash count */}
      <div className="rounded-3xl bg-slate-50 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[13.5px] font-semibold text-slate-600">ড্রয়ারে থাকার কথা (শুধু নগদ)</p>
          <p className="tabular text-[18px] font-extrabold text-ink">{taka(s.expectedCash)}</p>
        </div>

        {closing ? (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-baseline justify-between text-[14px]">
              <span className="text-slate-600">গোনা ক্যাশ</span>
              <b className="tabular text-[16px] text-ink">{taka(closing.countedCash)}</b>
            </div>
            <div className={cx('flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13.5px] font-semibold', closing.diff === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
              {closing.diff === 0 ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              {closing.diff === 0 ? 'হিসাব মিলেছে' : closing.diff > 0 ? `${taka(closing.diff)} বেশি আছে` : `${taka(Math.abs(closing.diff))} কম আছে`}
            </div>
            {closing.note && <p className="text-[13px] text-slate-600">নোট: {closing.note}</p>}
            <p className="text-[12px] text-slate-400">
              {closing.closedBy || '—'} · {fmtDate(closing.closedAt)} {fmtTime(closing.closedAt)}
            </p>
            {changedAfter && (
              <div className="flex items-start gap-2 rounded-2xl bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                ক্লোজের পর টাকার হিসাব বদলেছে (ক্লোজের সময় {taka(closing.total)})। আবার খুলে নতুন করে ক্লোজ করুন।
              </div>
            )}
            <Button variant="secondary" block icon={LockOpen} className="no-print" onClick={reopen}>
              আবার খুলুন
            </Button>
          </div>
        ) : (
          <div className="no-print mt-3 space-y-3">
            <Field label="হাতে গোনা ক্যাশ (৳)">
              <Input type="number" inputMode="numeric" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={String(s.expectedCash)} />
            </Field>
            <div className={cx('flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[13.5px] font-semibold', diff === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
              {diff === 0 ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              {diff === 0 ? 'হিসাব মিলছে' : diff > 0 ? `${taka(diff)} বেশি` : `${taka(Math.abs(diff))} কম`}
            </div>
            {diff !== 0 && (
              <Field label="নোট (কেন মেলেনি)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন ভাংতি দেওয়া হয়েছে" />
              </Field>
            )}
            <Button size="lg" block icon={Lock} disabled={busy} onClick={close}>
              দিন ক্লোজ করুন
            </Button>
          </div>
        )}
      </div>

      <div className="no-print grid grid-cols-2 gap-2.5 pb-1">
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
          প্রিন্ট / PDF
        </Button>
        <Button as="a" href={waLink('', shareText)} target="_blank" rel="noopener noreferrer" variant="success">
          <WhatsAppIcon className="h-5 w-5" /> পাঠান
        </Button>
      </div>
    </div>
  );
}
