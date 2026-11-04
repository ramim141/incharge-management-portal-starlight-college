import React, { useState, useMemo, useEffect } from 'react';
import { Phone, Copy, Check, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, RollBadge, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { fmtDate, waLink, todayISO } from '../lib/format';

export function AbsenteeSheet({ open, onClose, date, absentStudents = [] }) {
  const { settings, profile, classId } = useApp();
  const { toast } = useUI();
  const [customNote, setCustomNote] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const targetDate = date || todayISO();
  const storageKey = useMemo(() => {
    return `absent_wa_sent_${classId || 'default'}_${targetDate}`;
  }, [classId, targetDate]);

  // Load sent status persisted for today's date
  const [sentIds, setSentIds] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Re-sync when date / classId changes (e.g. next day naturally starts empty)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setSentIds(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setSentIds(new Set());
    }
  }, [storageKey]);

  const markAsSent = (studentId) => {
    setSentIds((prev) => {
      const next = new Set(prev).add(studentId);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        window.dispatchEvent(new CustomEvent('absent_wa_sent_updated'));
      } catch (e) {
        console.error('Failed to save sent IDs', e);
      }
      return next;
    });
  };


  const teacherName = profile?.name || settings.inchargeName || 'শ্রেণি ইনচার্জ';
  const className = settings.className || 'ক্লাস';
  const collegeName = settings.institutionName || 'স্টারলাইট কলেজ';

  const makeMessage = (student) => {
    const lines = [
      'শ্রদ্ধেয় অভিভাবক,',
      `আপনার সন্তান ${student.name} (রোল: ${student.roll}) আজ ${fmtDate(targetDate, { year: false })} তারিখে ক্লাসে অনুপস্থিত ছিল।`,
    ];
    if (customNote.trim()) {
      lines.push(`\nবিশেষ বার্তা: ${customNote.trim()}`);
    }
    lines.push('\nশিক্ষার্থীর নিয়মিত উপস্থিতি নিশ্চিত করার জন্য অনুরোধ করা হলো।');
    lines.push(`— ${teacherName}`);
    lines.push(`শ্রেণি ইনচার্জ, ${className} (${collegeName})`);
    return lines.join('\n');
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

  const sentCount = absentStudents.filter((s) => sentIds.has(s.id) || (!s.guardianPhone && !s.studentPhone)).length;

  const handleClose = () => {
    try {
      window.dispatchEvent(new CustomEvent('absent_wa_sent_updated'));
    } catch {}
    onClose?.();
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      full={absentStudents.length > 2}
      title="অনুপস্থিতির WhatsApp নোটিফিকেশন"
      subtitle={`${fmtDate(targetDate, { year: false })} · ${absentStudents.length} জন অনুপস্থিত`}
    >
      <div className="space-y-3 pt-0.5">
        {/* Progress & counter - compact single-row bar */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12.5px] font-semibold text-slate-700 truncate">মেসেজ পাঠানো হয়েছে:</span>
            <span className="tabular text-[12.5px] font-extrabold text-brand-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-xs">
              {sentCount}/{absentStudents.length}
            </span>
            {sentCount === absentStudents.length && absentStudents.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 shrink-0">
                <Check className="h-3 w-3" /> সব সম্পন্ন
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowEditor((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-[11.5px] font-bold text-brand-600 shadow-xs hover:bg-slate-50 transition"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{showEditor ? 'বন্ধ' : 'বার্তা পরিবর্তন'}</span>
          </button>
        </div>

        {/* Optional custom note editor */}
        {showEditor && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-3 shadow-xs">
            <label className="block text-[12.5px] font-bold text-amber-900">
              মেসেজের সাথে অতিরিক্ত কোনো বার্তা যোগ করতে চান? (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="যেমন: কাল ক্লাসে আসার সময় অভিভাবকের স্বাক্ষর আনবে..."
              className="mt-1.5 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-[13px] text-ink outline-none placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        )}

        {/* Student list */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          {absentStudents.map((s) => {
            const isSent = sentIds.has(s.id);
            const isCopied = copiedId === s.id;
            const phone = s.guardianPhone || s.studentPhone;
            const hasPhone = Boolean(phone);

            return (
              <div
                key={s.id}
                className={cx(
                  'flex items-center gap-2.5 p-3 sm:p-3.5 transition-colors',
                  isSent ? 'bg-emerald-50/30' : 'hover:bg-slate-50/60',
                )}
              >
                <RollBadge roll={s.roll} seed={s.id} size={38} rounded="rounded-xl" className="shrink-0 shadow-xs" />
                
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink leading-tight" title={s.name}>
                    {s.name}
                  </p>
                  
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {hasPhone ? (
                      <>
                        <span className="tabular text-[12px] font-semibold text-slate-500">
                          {phone}
                        </span>
                        {!s.guardianPhone && s.studentPhone && (
                          <span className="rounded bg-sky-50 px-1 py-0.2 text-[10.5px] font-semibold text-sky-700">
                            শিক্ষার্থী
                          </span>
                        )}
                        {s.guardianPhone && s.studentPhone && (
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[10.5px] text-slate-500" title={`শিক্ষার্থী: ${s.studentPhone}`}>
                            +ছাত্র
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopy(s)}
                          aria-label="মেসেজ কপি করুন"
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                          title="মেসেজ কপি করুন"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-[12px] font-medium text-rose-500">ফোন নম্বর নেই</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Dedicated call button */}
                  {hasPhone && (
                    <a
                      href={`tel:${phone}`}
                      aria-label="কল করুন"
                      className="press grid h-9 w-9 place-items-center rounded-xl border border-sky-200/80 bg-sky-50 text-sky-600 shadow-xs hover:bg-sky-100 active:scale-95 transition"
                      title={s.guardianPhone ? 'অভিভাবককে সরাসরি কল করুন' : 'শিক্ষার্থীকে সরাসরি কল করুন'}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}

                  {/* WhatsApp send button or Done state */}
                  {isSent ? (
                    <span
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-bold text-emerald-700 shadow-xs select-none"
                      title="মেসেজ পাঠানো সম্পন্ন হয়েছে"
                    >
                      সম্পন্ন
                    </span>
                  ) : hasPhone ? (
                    <a
                      href={waLink(phone, makeMessage(s))}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp-এ বার্তা পাঠান"
                      onClick={() => {
                        markAsSent(s.id);
                        toast(`${s.name}-এর জন্য WhatsApp ওপেন হয়েছে`);
                      }}
                      className="press grid h-9 w-9 place-items-center rounded-xl border border-emerald-200/90 bg-emerald-50 shadow-xs hover:bg-emerald-100 active:scale-95 transition"
                      title="WhatsApp-এ বার্তা পাঠান"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </a>
                  ) : (
                    <span
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-[12px] font-semibold text-slate-500 select-none"
                      title="ফোন নম্বর নেই"
                    >
                      সম্পন্ন
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button block variant="secondary" onClick={handleClose}>
          সম্পন্ন হয়েছে
        </Button>
      </div>
    </Sheet>
  );
}
