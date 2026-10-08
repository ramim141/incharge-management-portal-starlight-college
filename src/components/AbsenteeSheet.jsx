import React, { useState, useMemo } from 'react';
import { Phone, Copy, Check, CheckCheck, AlertCircle, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, RollBadge, Badge, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { fmtDate, waLink } from '../lib/format';

export function AbsenteeSheet({ open, onClose, date, absentStudents = [] }) {
  const { settings, profile } = useApp();
  const { toast } = useUI();
  const [sentIds, setSentIds] = useState(() => new Set());
  const [customNote, setCustomNote] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const teacherName = profile?.name || settings.inchargeName || 'শ্রেণি ইনচার্জ';
  const className = settings.className || 'ক্লাস';
  const collegeName = settings.institutionName || 'স্টারলাইট কলেজ';

  const makeMessage = (student) => {
    const lines = [
      'শ্রদ্ধেয় অভিভাবক,',
      `আপনার সন্তান ${student.name} (রোল: ${student.roll}) আজ ${fmtDate(date, { year: false })} তারিখে ক্লাসে অনুপস্থিত ছিল।`,
    ];
    if (customNote.trim()) {
      lines.push(`\nবিশেষ বার্তা: ${customNote.trim()}`);
    }
    lines.push('\nশিক্ষার্থীর নিয়মিত উপস্থিতি নিশ্চিত করার জন্য অনুরোধ করা হলো।');
    lines.push(`— ${teacherName}`);
    lines.push(`শ্রেণি ইনচার্জ, ${className} (${collegeName})`);
    return lines.join('\n');
  };

  const handleSend = (student) => {
    if (!student.guardianPhone) {
      toast('অভিভাবকের ফোন নম্বর যুক্ত করা নেই', 'error');
      return;
    }
    const msg = makeMessage(student);
    setSentIds((prev) => new Set(prev).add(student.id));
    window.open(waLink(student.guardianPhone, msg), '_blank');
  };

  const handleCopy = async (student) => {
    const msg = makeMessage(student);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(student.id);
      setTimeout(() => setCopiedId(null), 1800);
      toast('মেসেজ কপি হয়েছে');
    } catch {
      toast('কপি করা যায়নি', 'error');
    }
  };

  const sentCount = absentStudents.filter((s) => sentIds.has(s.id)).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full={absentStudents.length > 2}
      title="অনুপস্থিতির WhatsApp নোটিফিকেশন"
      subtitle={`${fmtDate(date, { year: false })} · ${absentStudents.length} জন অনুপস্থিত`}
    >
      <div className="space-y-4 pt-1">
        {/* Progress & counter */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
          <div>
            <p className="text-[13px] font-semibold text-slate-700">
              মেসেজ পাঠানো হয়েছে {sentCount}/{absentStudents.length}
            </p>
            <p className="text-[11.5px] text-slate-500">এক ক্লিকে WhatsApp চ্যাট ওপেন হবে</p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditor((v) => !v)}
            className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-600 ring-1 ring-slate-200 shadow-sm"
          >
            <MessageSquare className="h-3.5 w-3.5" /> {showEditor ? 'বার্তা বন্ধ' : 'বার্তা পরিবর্তন'}
          </button>
        </div>

        {/* Optional custom note editor */}
        {showEditor && (
          <div className="rounded-2xl bg-amber-50/80 p-3 ring-1 ring-amber-200/80">
            <label className="block text-[12.5px] font-bold text-amber-900">
              মেসেজের সাথে অতিরিক্ত কোনো বার্তা যোগ করতে চান? (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="যেমন: কাল ক্লাসে আসার সময় অভিভাবকের স্বাক্ষর আনবে..."
              className="mt-1.5 w-full rounded-xl bg-white px-3 py-2 text-[13px] text-ink ring-1 ring-amber-300 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {/* Student list */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          {absentStudents.map((s) => {
            const isSent = sentIds.has(s.id);
            const isCopied = copiedId === s.id;
            const hasPhone = Boolean(s.guardianPhone);

            return (
              <div key={s.id} className={cx('flex items-center gap-3 p-3.5 transition-colors', isSent && 'bg-emerald-50/40')}>
                <RollBadge roll={s.roll} seed={s.id} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14.5px] font-bold text-ink">{s.name}</p>
                    {isSent && (
                      <Badge tone="green" dot>
                        পাঠানো হয়েছে
                      </Badge>
                    )}
                  </div>
                  <p className="tabular text-[12.5px] text-slate-500">
                    {hasPhone ? s.guardianPhone : <span className="text-rose-500 font-medium">ফোন নম্বর নেই</span>}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(s)}
                    aria-label="মেসেজ কপি করুন"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 active:bg-slate-200"
                    title="মেসেজ কপি করুন"
                  >
                    {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>

                  {hasPhone ? (
                    <>
                      <a
                        href={`tel:${s.guardianPhone}`}
                        aria-label="কল করুন"
                        className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600 active:bg-sky-100"
                        title="অভিভাবককে সরাসরি কল করুন"
                      >
                        <Phone className="h-4 w-4" />
                      </a>

                      <Button
                        size="xs"
                        variant={isSent ? 'soft' : 'success'}
                        icon={isSent ? CheckCheck : WhatsAppIcon}
                        onClick={() => handleSend(s)}
                      >
                        {isSent ? 'আবার' : 'পাঠান'}
                      </Button>
                    </>
                  ) : (
                    <span className="text-[12px] text-slate-400">অপ্রাপ্য</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button block variant="secondary" onClick={onClose}>
          সম্পন্ন হয়েছে
        </Button>
      </div>
    </Sheet>
  );
}
