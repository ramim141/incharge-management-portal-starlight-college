import React from 'react';
import { BellRing, Clock3, PhoneOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Card, Button, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';

/**
 * Reminders at a glance: the ones that are ready now (deadline close / passed and nobody has been
 * nudged lately) and a one-tap "message everyone on this list". Guardians are messaged one after
 * another in the WhatsApp sheet; each one sent is remembered.
 */
export function ReminderPanel({ list = [] }) {
  const { reminderQueue: q } = useApp();
  const { openWhatsApp } = useUI();
  const everyone = list.filter((s) => s.guardianPhone || s.studentPhone);
  const noPhone = list.length - everyone.length;

  const Row = ({ icon: Icon, tone, title, text, students }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold leading-snug text-ink">{title}</span>
        <span className="block text-[12.5px] text-slate-500">{text}</span>
      </span>
      <Button size="sm" variant="success" onClick={() => openWhatsApp(students)}>
        <WhatsAppIcon className="h-4 w-4" /> পাঠান
      </Button>
    </div>
  );

  return (
    <Card className="mt-3 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <BellRing className="h-[18px] w-[18px] text-brand-600" />
        <p className="text-[14.5px] font-bold text-ink">রিমাইন্ডার</p>
        <p className="ml-auto text-[12px] text-slate-400">শেষ তারিখের ২ দিন আগে ও পার হলে</p>
      </div>

      <div className="divide-y divide-slate-100">
        {q.overdue.length > 0 && (
          <Row icon={BellRing} tone="bg-rose-50 text-rose-600" title={`${q.overdue.length} জনের শেষ তারিখ পার হয়েছে`} text="৩ দিনের মধ্যে আগে জানানো হয়নি" students={q.overdue} />
        )}
        {q.upcoming.length > 0 && (
          <Row icon={Clock3} tone="bg-amber-50 text-amber-600" title={`${q.upcoming.length} জনের শেষ তারিখ ২ দিনের মধ্যে`} text="আগেভাগে মনে করিয়ে দিন" students={q.upcoming} />
        )}
        {q.overdue.length === 0 && q.upcoming.length === 0 && <p className="px-4 py-3.5 text-[13.5px] text-slate-500">এখন নতুন কোনো রিমাইন্ডার পাঠানোর নেই ✓</p>}
        {q.noPhone > 0 && (
          <div className="flex items-center gap-2.5 bg-slate-50 px-4 py-2.5 text-[12.5px] text-slate-500">
            <PhoneOff className="h-4 w-4 shrink-0" /> {q.noPhone} জনের অভিভাবকের ফোন নম্বর নেই, তাদের পাঠানো যাবে না
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-3.5">
        <Button variant="success" block disabled={everyone.length === 0} onClick={() => openWhatsApp(everyone)}>
          <WhatsAppIcon className="h-5 w-5" /> তালিকার সবাইকে পাঠান ({everyone.length} জন)
        </Button>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-slate-400">
          একজনকে পাঠালে পরের অভিভাবক আপনাআপনি আসবে{noPhone > 0 ? ` · ${noPhone} জনের ফোন নেই, বাদ` : ''}
        </p>
      </div>
    </Card>
  );
}
