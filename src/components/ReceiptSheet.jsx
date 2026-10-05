import React from 'react';
import { Printer, Check, GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button } from './ui';
import { taka, fmtDate, fmtTime, groupBn, waLink, methodBn } from '../lib/format';

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.75C5.8.75.7 5.84.7 12.1c0 2 .52 3.95 1.52 5.67L.6 23.25l5.6-1.47a11.3 11.3 0 0 0 5.84 1.6h.01c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8z" />
  </svg>
);
export { WhatsAppIcon };

export function ReceiptSheet() {
  const { receipt, closeReceipt } = useUI();
  const { settings, students, calculateStudentTotalDue, userRole } = useApp();
  const p = receipt?.payment;
  const student = p ? students.find((s) => s.id === p.studentId || s.roll === Number(p.roll)) : null;
  const remaining = student ? calculateStudentTotalDue(student.id) : 0;

  const shareText = p
    ? `প্রিয় অভিভাবক,\n${p.studentName} (রোল ${p.roll})-এর ${taka(p.amount)} পরিশোধ সফলভাবে গৃহীত হয়েছে।\nরশিদ নং: ${p.receiptNo}\nতারিখ: ${fmtDate(p.paymentDate)}\nঅবশিষ্ট বকেয়া: ${taka(remaining)}\n\nধন্যবাদ,\n${settings.inchargeName}`
    : '';

  return (
    <Sheet
      open={!!p}
      onClose={closeReceipt}
      printable
      title="রশিদ"
      subtitle={p?.receiptNo}
      footer={
        p && (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              প্রিন্ট / PDF
            </Button>
            {student?.guardianPhone && userRole === 'admin' ? (
              <Button as="a" href={waLink(student.guardianPhone, shareText)} target="_blank" rel="noopener noreferrer" variant="success">
                <WhatsAppIcon className="h-5 w-5" />
                অভিভাবককে
              </Button>
            ) : (
              <Button onClick={closeReceipt}>বন্ধ করুন</Button>
            )}
          </div>
        )
      }
    >
      {p && (
        <div className="pt-1">
          {receipt.fresh && (
            <div className="no-print mb-5 flex flex-col items-center pt-2 text-center">
              <div className="grid h-16 w-16 animate-pop place-items-center rounded-full bg-emerald-500 text-white shadow-[0_12px_30px_-10px_rgba(16,185,129,.8)]">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
              <p className="mt-3 text-[20px] font-extrabold text-ink">পেমেন্ট সফল</p>
              <p className="text-[14px] text-slate-500">{taka(p.amount)} গ্রহণ করা হয়েছে</p>
            </div>
          )}

          <div className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 pb-5 pt-5 text-center text-white">
              <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-white/15">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="text-[15px] font-bold leading-snug">{settings.institutionName}</p>
              <p className="text-[12px] text-white/70">{settings.sectionName}</p>
              <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold tracking-wider">
                MONEY RECEIPT · অর্থ প্রাপ্তি রশিদ
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Meta label="রশিদ নং" value={p.receiptNo} mono />
                <Meta label="তারিখ" value={`${fmtDate(p.paymentDate)} · ${fmtTime(p.paymentDate)}`} right />
                <Meta label="শিক্ষার্থী" value={p.studentName} />
                <Meta label="রোল · বিভাগ" value={`${p.roll}${student ? ` · ${groupBn(student.group)}` : ''}`} right />
                <Meta label="মাধ্যম" value={`${methodBn(p.method)}${p.trxId ? ` · ${p.trxId}` : ''}`} />
                <Meta label="আইডি" value={student?.studentId || '—'} right mono />
              </div>

              <div className="my-4 border-t-2 border-dashed border-slate-200" />

              <div className="space-y-2.5">
                {(p.items?.length ? p.items : [{ description: 'Class Fee', amount: p.amount }]).map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 text-[14px]">
                    <span className="text-slate-600">{it.description}</span>
                    <span className="tabular font-semibold text-ink">{taka(it.amount)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                <span className="text-[14px] font-semibold text-emerald-800">পরিশোধিত</span>
                <span className="tabular text-[20px] font-extrabold text-emerald-700">{taka(p.amount)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-[13.5px]">
                <span className="text-slate-500">অবশিষ্ট মোট বকেয়া</span>
                <span className={`tabular font-bold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{taka(remaining)}</span>
              </div>

              <div className="mt-6 flex items-end justify-between border-t border-dashed border-slate-200 pt-4">
                <p className="text-[12px] text-slate-400">
                  ডিজিটালভাবে যাচাইকৃত
                  <br />
                  <span className="font-semibold text-slate-600">ধন্যবাদ!</span>
                </p>
                <div className="text-center">
                  <p className="border-b border-slate-300 px-2 pb-1 font-serif text-[13px] italic text-brand-700">{settings.inchargeName}</p>
                  <p className="mt-1 text-[11px] text-slate-500">ক্লাস ইনচার্জ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Meta({ label, value, right, mono }) {
  return (
    <div className={right ? 'text-right' : ''}>
      <p className="text-[11.5px] text-slate-400">{label}</p>
      <p className={`font-semibold text-ink ${mono ? 'tabular' : ''}`}>{value}</p>
    </div>
  );
}
