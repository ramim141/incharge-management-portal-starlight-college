import React, { useState } from 'react';
import { Copy, Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, RollBadge, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { taka, waLink } from '../lib/format';

export function WhatsAppSheet() {
  const { whatsapp, closeWhatsApp } = useUI();
  const n = whatsapp?.length || 0;
  return (
    <Sheet
      open={n > 0}
      onClose={closeWhatsApp}
      full={n > 1}
      title="WhatsApp রিমাইন্ডার"
      subtitle={n > 1 ? `${n} জন প্রাপক` : 'ফি রিমাইন্ডার'}
    >
      {n > 0 && <Body list={whatsapp} />}
    </Sheet>
  );
}

function Body({ list }) {
  const { generateWhatsAppMessage, getStudentDueItems, markReminded } = useApp();
  const [idx, setIdx] = useState(0);
  const [edits, setEdits] = useState({});
  const [sent, setSent] = useState(() => new Set());
  const [copied, setCopied] = useState(false);
  const [recipientTypes, setRecipientTypes] = useState({}); // { [studentId]: 'guardian' | 'student' }

  const s = list[idx];
  const message = edits[s.id] ?? generateWhatsAppMessage(s);
  const items = getStudentDueItems(s);
  const due = items.reduce((a, i) => a + i.amount, 0);
  const multi = list.length > 1;

  const hasGuardian = Boolean(s.guardianPhone);
  const hasStudent = Boolean(s.studentPhone);
  const currentRecipient = recipientTypes[s.id] || (hasGuardian ? 'guardian' : hasStudent ? 'student' : 'guardian');
  const targetPhone = currentRecipient === 'student' ? (s.studentPhone || s.guardianPhone) : (s.guardianPhone || s.studentPhone);

  const markSent = () => {
    setSent((prev) => new Set(prev).add(s.id));
    markReminded([s.id]);
    if (multi) {
      // Move on to the next recipient who hasn't been messaged yet
      setTimeout(() => {
        const next = list.findIndex((x, i) => i > idx && !sent.has(x.id) && x.id !== s.id);
        if (next >= 0) setIdx(next);
      }, 400);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {multi && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold text-slate-600">
              পাঠানো হয়েছে {sent.size}/{list.length}
            </span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(sent.size / list.length) * 100}%` }} />
            </div>
          </div>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {list.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setIdx(i)}
                className={cx(
                  'press flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 ring-1 ring-inset',
                  i === idx ? 'bg-emerald-50 ring-emerald-400' : 'bg-white ring-slate-200',
                )}
              >
                <RollBadge roll={x.roll} seed={x.id} size={28} rounded="rounded-full" />
                <span className="text-[13.5px] font-semibold text-ink">{x.roll}</span>
                {sent.has(x.id) && <CheckCheck className="h-4 w-4 text-sky-500" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <RollBadge roll={s.roll} seed={s.id} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-ink">{s.name}</p>
          <p className="tabular text-[13px] text-slate-500">
            {targetPhone ? (
              <span>
                {targetPhone}{' '}
                <span className="text-[11.5px] font-medium text-slate-400">
                  ({currentRecipient === 'student' ? 'শিক্ষার্থী' : 'অভিভাবক'})
                </span>
              </span>
            ) : (
              <span className="text-rose-500 font-medium">কোনো নম্বর নেই</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-slate-400">মোট প্রদেয় ফি</p>
          <p className="tabular text-[17px] font-extrabold text-rose-600">{taka(due)}</p>
        </div>
      </div>

      {hasGuardian && hasStudent && (
        <div className="rounded-2xl bg-slate-100 p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setRecipientTypes((prev) => ({ ...prev, [s.id]: 'guardian' }))}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[13px] font-semibold transition',
              currentRecipient === 'guardian'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 active:bg-slate-200/60',
            )}
          >
            <span>👨‍👦 অভিভাবক</span>
            <span className="tabular text-[11px] opacity-75 font-normal">({s.guardianPhone})</span>
          </button>
          <button
            type="button"
            onClick={() => setRecipientTypes((prev) => ({ ...prev, [s.id]: 'student' }))}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[13px] font-semibold transition',
              currentRecipient === 'student'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 active:bg-slate-200/60',
            )}
          >
            <span>🎓 শিক্ষার্থী</span>
            <span className="tabular text-[11px] opacity-75 font-normal">({s.studentPhone})</span>
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl bg-rose-50/70 px-4 py-3">
          <p className="mb-1.5 text-[12px] font-bold text-rose-700">কিসের বাকি</p>
          <ul className="tabular space-y-1 text-[13.5px] text-slate-700">
            {items.map((it) => (
              <li key={it.name} className="flex justify-between gap-3">
                <span>{it.name}</span>
                <b className="text-rose-600">{taka(it.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chat-style preview — edit in place */}
      <div className="rounded-3xl bg-[#efeae2] p-3">
        <div className="relative ml-auto max-w-[94%] rounded-2xl rounded-tr-md bg-[#d9fdd3] p-1 shadow-sm">
          <textarea
            value={message}
            rows={14}
            onChange={(e) => setEdits((m) => ({ ...m, [s.id]: e.target.value }))}
            className="block w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-[#111b21] outline-none"
          />
          <div className="flex items-center justify-end gap-1 px-2 pb-1 text-[11px] text-slate-500">
            {sent.has(s.id) && (
              <>
                পাঠানো <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[12px] text-slate-500">মেসেজে ট্যাপ করে সম্পাদনা করুন</p>
      </div>

      <div className="flex gap-2.5">
        {multi && (
          <Button variant="secondary" className="w-12 px-0" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} aria-label="আগের">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy} className="flex-1">
          {copied ? 'কপি হয়েছে' : 'কপি'}
        </Button>
        {multi && (
          <Button variant="secondary" className="w-12 px-0" disabled={idx === list.length - 1} onClick={() => setIdx((i) => i + 1)} aria-label="পরের">
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>

      <Button
        as="a"
        href={targetPhone ? waLink(targetPhone, message) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!targetPhone) {
            e.preventDefault();
            return;
          }
          markSent();
        }}
        disabled={!targetPhone}
        variant="success"
        size="lg"
        block
      >
        <WhatsAppIcon className="h-5 w-5" />
        {sent.has(s.id)
          ? 'আবার পাঠান'
          : currentRecipient === 'student'
          ? 'শিক্ষার্থীকে WhatsApp-এ পাঠান'
          : 'অভিভাবককে WhatsApp-এ পাঠান'}
      </Button>
      <p className="text-center text-[12px] leading-relaxed text-slate-400">
        WhatsApp খুলবে, মেসেজ তৈরি থাকবে — শুধু Send চাপুন।
        {hasGuardian && hasStudent && (
          <span className="block mt-0.5 text-slate-500 font-medium">
            অভিভাবকের WhatsApp না থাকলে উপরে "🎓 শিক্ষার্থী" নির্বাচন করুন।
          </span>
        )}
        {multi && ' পাঠানোর পর পরের জন আপনাআপনি আসবে।'}
      </p>
    </div>
  );
}
