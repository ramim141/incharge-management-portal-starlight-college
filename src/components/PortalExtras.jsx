import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarOff, ChevronRight, CheckCircle2, Send, MessageSquareText,
  KeyRound, Eye, EyeOff, AlertCircle, ArrowLeft, X, Clock, CheckCheck, ThumbsUp, Phone,
} from 'lucide-react';
import { backend, errorText } from '../backend';
import { Card, Badge, Button, Sheet, Field, Input, Textarea, cx } from './ui';
import { fmtDate, fmtTime, todayISO } from '../lib/format';
import { newId, portalKey } from '../lib/hash';
import { isOffline, OFFLINE_MESSAGE, withTimeout } from '../lib/sync';
import { LEAVE_STATUS, LEAVE_REASONS, leaveDays, validateLeave, newLeave } from '../lib/leave';
import { QUERY_STATUS, QUERY_SUBJECTS, validateQuery, newQuery, toChatMessages } from '../lib/query';

const range = (l) => (l.to && l.to !== l.from ? `${fmtDate(l.from, { year: false })} – ${fmtDate(l.to, { year: false })}` : fmtDate(l.from, { year: false }));

/* ───────────────────────── Leave Application Card ───────────────────────── */

/** Home-screen card: the latest leave application and its answer, and a button to apply */
export function LeaveCard({ snap, sent }) {
  const [open, setOpen] = useState(false);
  const all = mergeLeaves(snap.leaves, sent);
  const last = all[0];
  const pending = all.filter((l) => l.status === 'pending').length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press block w-full text-left">
        <Card className="flex items-center gap-3 !p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600">
            <CalendarOff className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">ছুটির আবেদন</span>
            <span className="block truncate text-[12.5px] text-slate-500">
              {last ? `${range(last)} · ${LEAVE_STATUS[last.status]?.bn || last.status}` : 'ছুটি লাগলে এখান থেকেই জানান'}
            </span>
          </span>
          {pending > 0 && <Badge tone="amber">{pending}টি অপেক্ষায়</Badge>}
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </Card>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} full title="ছুটির আবেদন" subtitle="আবেদন করলে ইনচার্জ মঞ্জুর বা নামঞ্জুর করবেন">
        {open && <LeaveForm snap={snap} existing={all} onSent={sent.add} />}
      </Sheet>
    </>
  );
}

export const useSentLeaves = () => {
  const [list, setList] = useState([]);
  return { list, add: (l) => setList((x) => [l, ...x]) };
};

const mergeLeaves = (fromSnap = [], sent) => {
  const seen = new Set(fromSnap.map((l) => l.id));
  return [...sent.list.filter((l) => !seen.has(l.id)), ...fromSnap].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

function LeaveForm({ snap, existing, onSent }) {
  const today = todayISO();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    const e = validateLeave({ from, to, reason }, today);
    setErrs(e);
    if (e.length || busy) return;
    if (isOffline()) return setErrs([OFFLINE_MESSAGE]);
    setBusy(true);
    const leave = newLeave({ id: newId('lv'), classId: snap.classId, student: snap.student, portalKey: snap.id, from, to, reason });
    try {
      await withTimeout(backend.write([{ type: 'set', path: ['classes', snap.classId, 'leaves', leave.id], data: leave }], { wait: true }));
      const { portalKey: _key, classId: _c, studentId: _s, studentName: _n, roll: _r, ...mine } = leave;
      onSent({ ...mine, to: leave.to });
      setDone(true);
      setReason('');
      setTo('');
    } catch (err) {
      setErrs([err?.code === 'permission-denied' ? 'আবেদন পাঠানো যায়নি। ইনচার্জকে জানান বা পরে আবার চেষ্টা করুন।' : err?.code === 'app/timeout' ? OFFLINE_MESSAGE : errorText(err)]);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-5 pt-1">
      {done ? (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="text-[15px] font-bold">আবেদন পাঠানো হয়েছে</p>
            <p className="text-[13px]">ইনচার্জ দেখে সিদ্ধান্ত জানাবেন। এখানেই অবস্থা দেখতে পাবেন।</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="শুরুর তারিখ">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="শেষ তারিখ" hint="এক দিন হলে খালি রাখুন">
              <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field label="ছুটির কারণ">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="যেমন জ্বর, পারিবারিক কারণ" />
          </Field>
          <div className="-mt-3 flex flex-wrap gap-2">
            {LEAVE_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="press rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
                {r}
              </button>
            ))}
          </div>
          {errs.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{errs.join(' · ')}</p>}
          <Button size="lg" block icon={Send} disabled={busy} onClick={send}>
            {busy ? 'পাঠানো হচ্ছে…' : 'আবেদন পাঠান'}
          </Button>
        </>
      )}

      {existing.length > 0 && (
        <div>
          <p className="mb-2 text-[13.5px] font-semibold text-slate-600">আগের আবেদন</p>
          <div className="space-y-2">
            {existing.map((l) => (
              <div key={l.id} className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-2">
                  <p className="tabular text-[14px] font-bold text-ink">
                    {range(l)} <span className="font-medium text-slate-500">· {leaveDays(l)} দিন</span>
                  </p>
                  <Badge tone={LEAVE_STATUS[l.status]?.tone || 'slate'} dot>
                    {LEAVE_STATUS[l.status]?.bn || l.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-slate-600">{l.reason}</p>
                {l.status === 'rejected' && l.note && <p className={cx('mt-1 text-[12.5px] font-medium text-rose-600')}>কারণ: {l.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Messenger & Inquiries ───────────────────────── */

export function MessengerIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.513 3.735 7.185V22l3.418-1.875c.91.252 1.868.39 2.847.39 5.523 0 10-4.145 10-9.257C22 6.145 17.523 2 12 2zm1.066 12.443l-2.583-2.756-5.041 2.756 5.546-5.887 2.65 2.756 4.974-2.756-5.546 5.887z" />
    </svg>
  );
}

/** Floating Messenger bubble at bottom-right of the student portal */
export function FloatingMessenger({ snap, sent, open: controlledOpen, onOpen, onClose }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v) => {
    if (v) {
      if (onOpen) onOpen();
      else setInternalOpen(true);
    } else {
      if (onClose) onClose();
      else setInternalOpen(false);
    }
  };

  const all = mergeQueries(snap.queries, sent);
  const pending = all.filter((q) => q.status === 'pending').length;
  const replied = all.filter((q) => q.status === 'replied').length;

  return (
    <>
      <aside aria-label="ইনচার্জ মেসেঞ্জার চ্যাট" className="no-print fixed bottom-20 right-4 z-40 flex flex-col items-end sm:bottom-24 sm:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] text-white shadow-2xl shadow-blue-500/40 ring-4 ring-white transition-all hover:scale-105 active:scale-95"
          title="ইনচার্জ মেসেঞ্জার"
        >
          <MessengerIcon className="h-7 w-7 drop-shadow-sm transition-transform group-hover:scale-110" />

          {/* Pending or replied notification badge */}
          {pending > 0 ? (
            <span className="tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white ring-2 ring-white">
              {pending}
            </span>
          ) : replied > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            </span>
          ) : null}
        </button>
      </aside>

      {open && (
        <MessengerChatModal
          snap={snap}
          existing={all}
          onSent={sent.add}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Home-screen Messenger card: taps to open the same floating messenger chat */
export function QueryCard({ snap, sent, onOpen }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const all = mergeQueries(snap.queries, sent);
  const last = all[0];
  const pending = all.filter((q) => q.status === 'pending').length;

  const handleClick = () => {
    if (onOpen) onOpen();
    else setInternalOpen(true);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className="press block w-full text-left">
        <Card className="flex items-center gap-3.5 !p-4 transition hover:ring-blue-200">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] text-white shadow-md shadow-blue-500/25">
            <MessengerIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-bold text-ink">ইনচার্জ মেসেঞ্জার / বার্তা</span>
            <span className="block truncate text-[12.5px] text-slate-500">
              {last ? `${last.subject} · ${QUERY_STATUS[last.status]?.bn || last.status}` : 'মেসেঞ্জারের মতো সরাসরি ইনবক্সে কথা বলুন'}
            </span>
          </span>
          {pending > 0 ? (
            <Badge tone="amber">{pending}টি অপেক্ষায়</Badge>
          ) : (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-bold text-[#0084FF]">
              চ্যাট করুন
            </span>
          )}
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </Card>
      </button>

      {!onOpen && internalOpen && (
        <MessengerChatModal
          snap={snap}
          existing={all}
          onSent={sent.add}
          onClose={() => setInternalOpen(false)}
        />
      )}
    </>
  );
}

export const useSentQueries = () => {
  const [list, setList] = useState([]);
  return { list, add: (q) => setList((x) => [q, ...x]) };
};

const mergeQueries = (fromSnap = [], sent) => {
  const seen = new Set(fromSnap.map((q) => q.id));
  return [...sent.list.filter((q) => !seen.has(q.id)), ...fromSnap].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

/** Full Messenger native-feeling chat modal with real-time conversations */
function MessengerChatModal({ snap, existing, onSent, onClose }) {
  const [message, setMessage] = useState('');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef(null);

  // Chronologically linear message stream (earliest at top, latest at bottom)
  const chatMessages = useMemo(() => toChatMessages(existing), [existing]);

  // Prevent background body scrolling while chat is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [chatMessages.length]);

  const send = async (textOverride = null) => {
    const textToSend = String(textOverride != null ? textOverride : message).trim();
    if (!textToSend || busy) return;

    const e = validateQuery({ message: textToSend });
    if (e.length) {
      setErrs(e);
      return;
    }
    setErrs([]);
    if (isOffline()) return setErrs([OFFLINE_MESSAGE]);
    setBusy(true);

    const targetClassId = snap.classId || snap.cls?.code || (snap.student?.studentId ? snap.student.studentId.replace(/-\d+$/, '') : '');

    const q = newQuery({
      id: newId('qry'),
      classId: targetClassId,
      student: snap.student,
      portalKey: snap.id,
      subject: 'মেসেজ',
      message: textToSend,
      sender: 'student',
      senderName: snap.student?.name || 'শিক্ষার্থী',
    });

    try {
      if (textOverride == null) setMessage('');
      onSent(q);
      setTimeout(() => scrollToBottom('smooth'), 60);
      await withTimeout(backend.write([{ type: 'set', path: ['classes', targetClassId, 'queries', q.id], data: q }], { wait: true }));
    } catch (err) {
      setErrs([err?.code === 'permission-denied' ? 'বার্তা পাঠানো যায়নি। ইনচার্জকে জানান বা পরে আবার চেষ্টা করুন।' : err?.code === 'app/timeout' ? OFFLINE_MESSAGE : errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  const inchargePhone = snap.cls?.inchargePhone || snap.settings?.inchargePhone;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[#F0F2F5] shadow-2xl">
        {/* Messenger Header with safe-area notch padding */}
        <header
          className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-3.5 pb-2.5 pt-3 shadow-xs"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className="press -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95"
              title="ফিরে যান"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="relative">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] text-[15px] font-bold text-white shadow-xs ring-2 ring-blue-100">
                {snap.cls?.inchargeName ? snap.cls.inchargeName.charAt(0) : 'ই'}
              </span>
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900">
                {snap.cls?.inchargeName || 'শ্রেণি ইনচার্জ'}
              </p>
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium leading-tight text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> সক্রিয় এখন (Active)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {inchargePhone && (
              <a
                href={`tel:${inchargePhone}`}
                title="কল করুন"
                className="press flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="press flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
              title="বন্ধ করুন"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Messenger Chat Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-2 bg-[#F0F2F5] overscroll-contain">
          {chatMessages.length === 0 ? (
            <div className="my-auto py-8 text-center">
              <div className="mx-auto mb-3.5 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] text-white shadow-lg shadow-blue-500/30">
                <MessengerIcon className="h-8 w-8" />
              </div>
              <p className="text-[17px] font-extrabold text-slate-900">ইনচার্জ মেসেঞ্জারে স্বাগতম!</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500">
                বেতন, জরিমানা, হাজিরা বা যেকোনো বিষয়ে ইনচার্জকে সরাসরি মেসেজ পাঠান।
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'আসসালামু আলাইকুম স্যার',
                  'বেতন পরিশোধ সংক্রান্ত তথ্য',
                  'পরীক্ষার ফি ও প্রবেশপত্র',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => send(sug)}
                    className="press rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    💬 {sug}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="my-1.5 flex justify-center">
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-semibold text-slate-500 shadow-xs border border-slate-200/60">
                  কথোপকথন
                </span>
              </div>

              {chatMessages.map((msg) => {
                const isStudent = msg.sender === 'student';
                const isThumb = msg.text === '👍';

                return (
                  <div key={msg.id} className={cx('flex flex-col', isStudent ? 'items-end' : 'items-start')}>
                    {isThumb ? (
                      /* Big Thumbs Up like real Messenger */
                      <div className="my-1 px-1">
                        <span className="text-[34px] leading-none select-none animate-in zoom-in-50 duration-150">
                          👍
                        </span>
                        <p className={cx('mt-0.5 text-[10px] text-slate-400', isStudent ? 'text-right' : 'text-left')}>
                          {fmtTime(msg.createdAt)}
                        </p>
                      </div>
                    ) : isStudent ? (
                      /* Outgoing Bubble (Student - Messenger Blue) */
                      <div className="group relative max-w-[80%] rounded-[18px] rounded-br-[4px] bg-[#0084FF] px-3.5 py-2 text-[14px] leading-relaxed text-white shadow-xs">
                        <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-blue-100/90">
                          <span>{fmtTime(msg.createdAt)}</span>
                          {msg.status === 'seen' ? (
                            <CheckCheck className="h-3.5 w-3.5 text-cyan-200" title="দেখা হয়েছে" />
                          ) : (
                            <Clock className="h-2.5 w-2.5 text-white/70" title="পাঠানো হয়েছে" />
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Incoming Bubble (Teacher - Messenger Gray) */
                      <div className="flex items-end gap-1.5 max-w-[85%]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] text-[11px] font-bold text-white shadow-xs">
                          {msg.senderName ? msg.senderName.charAt(0) : 'ই'}
                        </span>
                        <div className="rounded-[18px] rounded-bl-[4px] bg-[#E4E6EB] px-3.5 py-2 text-[14px] leading-relaxed text-slate-900 shadow-xs">
                          <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                          <p className="mt-0.5 text-right text-[10px] text-slate-500">
                            {fmtTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Messenger Footer Input Bar */}
        <footer
          className="shrink-0 border-t border-slate-200/80 bg-white px-3 pt-2 shadow-lg"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
        >
          <div className="flex items-end gap-2">
            <div className="flex min-h-[40px] flex-1 items-center rounded-full bg-[#F0F2F5] px-4 py-1.5 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084FF]">
              <textarea
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={600}
                placeholder="একটি মেসেজ লিখুন…"
                className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14.5px] text-slate-800 outline-none placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
            </div>

            {message.trim() ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => send()}
                className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0084FF] text-white shadow-md transition hover:bg-[#0073e6] active:scale-95 disabled:opacity-40"
                title="পাঠান"
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => send('👍')}
                className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0084FF] transition hover:bg-blue-50 active:scale-90"
                title="Thumbs Up"
              >
                <ThumbsUp className="h-6 w-6 fill-current" />
              </button>
            )}
          </div>

          {errs.length > 0 && <p className="mt-1 px-2 text-[12px] font-medium text-rose-600">{errs.join(' · ')}</p>}
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── Student Change PIN Sheet ───────────────────────── */

export function ChangePinSheet({ snap, open, onClose, onPinChanged }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    setErr('');
    const cur = String(currentPin).trim();
    const next = String(newPin).trim();
    const conf = String(confirmPin).trim();

    if (!cur) return setErr('বর্তমান পিন দিন');
    const stdId = snap.student.studentId || snap.student.id;
    if (portalKey(stdId, cur) !== snap.id) {
      return setErr('বর্তমান পিনটি সঠিক নয়');
    }
    if (!/^\d{4,8}$/.test(next)) {
      return setErr('নতুন পিন ৪ থেকে ৮ সংখ্যার হতে হবে');
    }
    if (next === cur) {
      return setErr('নতুন পিনটি বর্তমান পিনের চেয়ে আলাদা হতে হবে');
    }
    if (next !== conf) {
      return setErr('নতুন পিন দুটি মেলেনি');
    }

    setBusy(true);
    try {
      const newKey = portalKey(stdId, next);
      const ops = [
        {
          type: 'set',
          path: ['portal', newKey],
          data: { ...snap, id: newKey, prevPortalKey: snap.id, updatedAt: new Date().toISOString() },
        },
        {
          type: 'delete',
          path: ['portal', snap.id],
        },
        {
          type: 'merge',
          path: ['classes', snap.classId, 'students', snap.student.id],
          data: { pin: next, portalKey: newKey },
        },
      ];
      await backend.write(ops, { wait: true });

      try {
        const last = JSON.parse(localStorage.getItem('xi_portal_last') || '{}');
        localStorage.setItem('xi_portal_last', JSON.stringify({ ...last, pin: next }));
      } catch {}

      setSuccess(true);
      onPinChanged?.(newKey, next);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      }, 1500);
    } catch (err) {
      setErr(errorText(err) || 'পিন পরিবর্তন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="পিন পরিবর্তন" subtitle="নিরাপত্তার স্বার্থে ৪ সংখ্যার গোপন পিন সেট করুন">
      <form onSubmit={save} className="space-y-4 pt-1">
        {success ? (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[15px] font-bold">পিন সফলভাবে পরিবর্তন হয়েছে!</p>
              <p className="text-[13px]">পরবর্তীতে এই নতুন পিন দিয়ে লগইন করতে হবে।</p>
            </div>
          </div>
        ) : (
          <>
            <Field label="বর্তমান পিন">
              <div className="relative">
                <Input
                  type={showPins ? 'text' : 'password'}
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="বর্তমান ৪ সংখ্যার পিন"
                  maxLength={8}
                  className="tabular pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPins(!showPins)}
                  className="press absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Field label="নতুন পিন" hint="৪ থেকে ৮টি সংখ্যা দিন">
              <Input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="যেমন: ৪৭২৯"
                maxLength={8}
                className="tabular"
              />
            </Field>

            <Field label="নতুন পিন নিশ্চিত করুন">
              <Input
                type={showPins ? 'text' : 'password'}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="নতুন পিনটি আবার লিখুন"
                maxLength={8}
                className="tabular"
              />
            </Field>

            {err && (
              <p className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {err}
              </p>
            )}

            <Button type="submit" size="lg" block icon={KeyRound} disabled={busy || !currentPin || !newPin || !confirmPin}>
              {busy ? 'সংরক্ষণ হচ্ছে…' : 'পিন সংরক্ষণ করুন'}
            </Button>
          </>
        )}
      </form>
    </Sheet>
  );
}
