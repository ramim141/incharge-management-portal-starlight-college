import React, { useState } from 'react';
import { Printer, Check, Copy, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, Logo } from './ui';
import { taka, fmtDate, fmtTime, studentTags, waLink, methodBn, formatItemDescBn } from '../lib/format';

const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43zm8.03-17.46A11.3 11.3 0 0 0 12.05.75C5.8.75.7 5.84.7 12.1c0 2 .52 3.95 1.52 5.67L.6 23.25l5.6-1.47a11.3 11.3 0 0 0 5.84 1.6h.01c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8z" />
  </svg>
);
export { WhatsAppIcon };

export function ReceiptSheet() {
  const { receipt, closeReceipt, openEditPayment, confirm, toast } = useUI();
  const { settings, students, payments, calculateStudentTotalDue, deletePayment, userRole } = useApp();
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const rawP = receipt?.payment;
  const p = rawP ? payments.find((x) => x.id === rawP.id) || rawP : null;
  const student = p ? students.find((s) => s.id === p.studentId || s.roll === Number(p.roll)) : null;
  const remaining = student ? calculateStudentTotalDue(student.id) : 0;

  const portalUrl = typeof window !== 'undefined' && p?.roll ? `${window.location.origin}?roll=${p.roll}` : '';

  const rawItems = p?.items?.length ? p.items : [{ description: 'ফি পরিশোধ', amount: p?.amount || 0 }];
  const itemsText = rawItems
    .map((it) => `• ${formatItemDescBn(it.description)}: ${taka(it.amount)}`)
    .join('\n');

  const methodText = methodBn(p?.method || 'Cash');
  const trxPart = p?.trxId ? ` (TrxID: ${p.trxId})` : '';

  const inchargeDetails = [
    settings.inchargeDesignation || 'ক্লাস ইনচার্জ',
    settings.className,
  ].filter(Boolean).join(', ');

  const shareText = p
    ? [
        `*প্রিয় অভিভাবক,*`,
        `আসসালামু আলাইকুম।`,
        `*${p.studentName}* (রোল: *${p.roll}*)-এর ফি পরিশোধ সফলভাবে গৃহীত হয়েছে।`,
        ``,
        `🧾 *রশিদ নং:* ${p.receiptNo}`,
        `📅 *তারিখ:* ${fmtDate(p.paymentDate)} · ${fmtTime(p.paymentDate)}`,
        `💳 *মাধ্যম:* ${methodText}${trxPart}`,
        ``,
        `📋 *আদায়কৃত ফি বিবরণ:*`,
        itemsText,
        `━━━━━━━━━━━━━━━━`,
        `*মোট আদায়:* *${taka(p.amount)}*`,
        `*অবশিষ্ট মোট বকেয়া:* ${remaining > 0 ? taka(remaining) : '৳০ (পরিশোধিত)'}`,
        portalUrl ? `\n🌐 *শিক্ষার্থী পোর্টাল (বিস্তারিত ও রশিদ):*\n${portalUrl}` : '',
        ``,
        `ধন্যবাদ,`,
        `*${settings.inchargeName}*`,
        inchargeDetails,
        settings.institutionName || '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const handleDelete = async () => {
    if (!p) return;
    const ok = await confirm({
      title: 'পেমেন্ট ও রশিদ মুছবেন?',
      message: `${p.studentName} (রোল ${p.roll}) — ${taka(p.amount)} (${p.receiptNo})। এই রশিদের টাকা শিক্ষার্থীর বকেয়া হিসেবে পুনরায় যুক্ত হবে এবং ডাটাবেজ থেকে রশিদটি স্থায়ীভাবে মুছে যাবে।`,
      confirmText: 'হ্যাঁ, মুছুন',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    await deletePayment(p.id);
    toast('পেমেন্ট ও রশিদ মুছে ফেলা হয়েছে এবং বকেয়া ডাটাবেজে সমন্বয় করা হয়েছে');
    closeReceipt();
  };

  return (
    <Sheet
      open={!!p}
      onClose={closeReceipt}
      printable
      title="রশিদ"
      subtitle={p?.receiptNo}
      footer={
        p && (
          <div className="flex gap-2">
            {student?.guardianPhone && userRole === 'admin' ? (
              <Button as="a" href={waLink(student.guardianPhone, shareText)} target="_blank" rel="noopener noreferrer" variant="success" size="sm" className="min-w-0 flex-1">
                <WhatsAppIcon className="h-4 w-4" />
                অভিভাবককে পাঠান
              </Button>
            ) : (
              <Button onClick={closeReceipt} size="sm" className="min-w-0 flex-1">বন্ধ করুন</Button>
            )}
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()} className="px-3.5" aria-label="প্রিন্ট / PDF" title="প্রিন্ট / PDF" />
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyMessage} className="px-3.5" aria-label="মেসেজ কপি করুন" title="মেসেজ কপি করুন" />
          </div>
        )
      }
    >
      {p && (
        <div className="pt-1">
          {userRole === 'admin' && (
            <div className="no-print mb-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEditPayment(p)}>
                সম্পাদনা
              </Button>
              <Button variant="soft-danger" size="sm" icon={Trash2} onClick={handleDelete}>
                মুছুন
              </Button>
            </div>
          )}

          {receipt.fresh && (
            <div className="no-print mb-3 flex flex-col items-center text-center">
              <div className="grid h-11 w-11 animate-pop place-items-center rounded-full bg-emerald-500 text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,.8)]">
                <Check className="h-6 w-6" strokeWidth={3} />
              </div>
              <p className="mt-2 text-[16px] font-extrabold text-ink">পেমেন্ট সফল</p>
              <p className="text-[13px] text-slate-500">{taka(p.amount)} গ্রহণ করা হয়েছে</p>
            </div>
          )}

          <div className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-4 pb-3.5 pt-4 text-center text-white">
              <div className="mx-auto mb-1.5 grid h-11 w-11 place-items-center rounded-xl bg-white p-1">
                <Logo size={36} />
              </div>
              <p className="text-[14px] font-bold leading-snug">{settings.institutionName}</p>
              <p className="text-[12px] text-white/70">{settings.sectionName}</p>
              <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold tracking-wider">
                MONEY RECEIPT · অর্থ প্রাপ্তি রশিদ
              </p>
            </div>

            <div className="px-4 py-3.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                <Meta label="রশিদ নং" value={p.receiptNo} mono />
                <Meta label="তারিখ" value={`${fmtDate(p.paymentDate)} · ${fmtTime(p.paymentDate)}`} right />
                <Meta label="শিক্ষার্থী" value={p.studentName} />
                <Meta label="রোল · বিভাগ" value={`${p.roll}${student && studentTags(student) ? ` · ${studentTags(student)}` : ''}`} right />
                <Meta label="মাধ্যম" value={`${methodBn(p.method)}${p.trxId ? ` · ${p.trxId}` : ''}`} />
                <Meta label="আইডি" value={student?.studentId || '—'} right mono />
              </div>

              <div className="my-3 border-t-2 border-dashed border-slate-200" />

              <div className="space-y-2.5">
                {(p.items?.length ? p.items : [{ description: 'ফি পরিশোধ', amount: p.amount }]).map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 text-[14px]">
                    <span className="text-slate-600">{formatItemDescBn(it.description)}</span>
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

          {/* WhatsApp message preview toggle */}
          <div className="no-print mt-3">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <span className="inline-flex items-center gap-2">
                <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
                WhatsApp মেসেজ প্রিভিউ {showPreview ? 'লুকান' : 'দেখুন'}
              </span>
              <span className="text-[12px] text-emerald-600">{showPreview ? '▲' : '▼'}</span>
            </button>
            {showPreview && (
              <div className="mt-2 rounded-2xl bg-[#efeae2] p-3 text-[13.5px]">
                <div className="whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#d9fdd3] p-3 leading-relaxed text-[#111b21] shadow-sm">
                  {shareText}
                </div>
              </div>
            )}
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
