import React, { useState } from 'react';
import { CalendarOff, ChevronRight, CheckCircle2, Send, MessageSquareText, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { backend, errorText } from '../backend';
import { Card, Badge, Button, Sheet, Field, Input, Textarea, cx } from './ui';
import { fmtDate, fmtTime, todayISO } from '../lib/format';
import { newId, portalKey } from '../lib/hash';
import { isOffline, OFFLINE_MESSAGE, withTimeout } from '../lib/sync';
import { LEAVE_STATUS, LEAVE_REASONS, leaveDays, validateLeave, newLeave } from '../lib/leave';
import { QUERY_STATUS, QUERY_SUBJECTS, validateQuery, newQuery } from '../lib/query';

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

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        full
        title="মেসেঞ্জার · শ্রেণি ইনচার্জ"
        subtitle={snap.cls?.inchargeName ? `${snap.cls.inchargeName} · অনলাইনে উত্তর দেওয়া হয়` : 'ইনচার্জকে সরাসরি বার্তা পাঠান'}
      >
        {open && <MessengerChat snap={snap} existing={all} onSent={sent.add} />}
      </Sheet>
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

      {!onOpen && (
        <Sheet
          open={internalOpen}
          onClose={() => setInternalOpen(false)}
          full
          title="মেসেঞ্জার · শ্রেণি ইনচার্জ"
          subtitle={snap.cls?.inchargeName ? `${snap.cls.inchargeName} · অনলাইনে উত্তর দেওয়া হয়` : 'ইনচার্জকে সরাসরি বার্তা পাঠান'}
        >
          {internalOpen && <MessengerChat snap={snap} existing={all} onSent={sent.add} />}
        </Sheet>
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

/** Full Messenger chat interface for students to converse with the in-charge */
function MessengerChat({ snap, existing, onSent }) {
  const [subject, setSubject] = useState(QUERY_SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Chronological order (earliest at top, latest at bottom)
  const chatMessages = [...existing].reverse();

  const send = async () => {
    const e = validateQuery({ subject, message });
    setErrs(e);
    if (e.length || busy) return;
    if (isOffline()) return setErrs([OFFLINE_MESSAGE]);
    setBusy(true);

    const q = newQuery({
      id: newId('qry'),
      classId: snap.classId,
      student: snap.student,
      portalKey: snap.id,
      subject,
      message,
    });

    try {
      await withTimeout(backend.write([{ type: 'set', path: ['classes', snap.classId, 'queries', q.id], data: q }], { wait: true }));
      onSent(q);
      setMessage('');
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 2500);
    } catch (err) {
      setErrs([err?.code === 'permission-denied' ? 'বার্তা পাঠানো যায়নি। ইনচার্জকে জানান বা পরে আবার চেষ্টা করুন।' : err?.code === 'app/timeout' ? OFFLINE_MESSAGE : errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col pt-1">
      {/* Incharge Info Header Bar */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 p-3 ring-1 ring-blue-100/70">
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#006AFF] to-[#0084FF] text-white shadow-sm">
          <MessengerIcon className="h-5 w-5" />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink">{snap.cls?.inchargeName || 'শ্রেণি ইনচার্জ'}</p>
          <p className="text-[12px] font-medium text-emerald-700">● সরাসরি ইনবক্স · উত্তর এখানেই দেখতে পাবেন</p>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {chatMessages.length === 0 ? (
          <div className="my-8 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] text-white shadow-lg shadow-blue-500/30">
              <MessengerIcon className="h-8 w-8" />
            </div>
            <p className="text-[16px] font-bold text-ink">ইনচার্জের সাথে চ্যাট করুন</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] text-slate-500">
              বেতন, হাজিরা, জরিমানা বা পরীক্ষার কোনো প্রশ্ন থাকলে নিচে লিখে পাঠান।
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                'বেতন পরিশোধ সংক্রান্ত তথ্য',
                'হাজিরা ও ছুটির জিজ্ঞাসা',
                'পরীক্ষার ফি ও প্রবেশপত্র',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setMessage(sug)}
                  className="press rounded-full bg-slate-100 px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  💬 {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((q) => {
            const isReplied = q.status === 'replied' && !!q.reply;
            return (
              <div key={q.id} className="space-y-2">
                {/* Student's Outgoing Message */}
                <div className="flex flex-col items-end">
                  <span className="mb-1 rounded-full bg-blue-100/80 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {q.subject}
                  </span>
                  <div className="max-w-[85%] rounded-[20px] rounded-br-sm bg-gradient-to-r from-[#006AFF] to-[#0084FF] px-4 py-2.5 text-[14.5px] leading-relaxed text-white shadow-sm">
                    <p className="whitespace-pre-wrap">{q.message}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{fmtDate(q.createdAt, { year: false })} {fmtTime(q.createdAt)}</span>
                    <span>·</span>
                    <span className={cx('font-semibold', isReplied ? 'text-emerald-600' : 'text-amber-600')}>
                      {isReplied ? '✓ উত্তর এসেছে' : '🕒 অপেক্ষায়'}
                    </span>
                  </div>
                </div>

                {/* Incharge's Incoming Reply */}
                {isReplied && (
                  <div className="flex items-start gap-2 pt-1">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-sm">
                      ই
                    </span>
                    <div className="max-w-[85%]">
                      <div className="rounded-[20px] rounded-bl-sm border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[14px] leading-relaxed text-emerald-950 shadow-sm">
                        <p className="mb-0.5 text-[11.5px] font-bold text-emerald-800">
                          {q.repliedBy || 'শ্রেণি ইনচার্জ'}
                        </p>
                        <p className="whitespace-pre-wrap">{q.reply}</p>
                      </div>
                      <p className="mt-1 pl-1 text-[11px] text-slate-400">
                        {q.repliedAt && `${fmtDate(q.repliedAt, { year: false })} ${fmtTime(q.repliedAt)}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Messenger Bottom Input Dock */}
      <div className="border-t border-slate-200/80 pt-3">
        {sentSuccess && (
          <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-[12.5px] font-bold text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>বার্তা পাঠানো হয়েছে! ইনচার্জের উত্তরের জন্য অপেক্ষা করুন।</span>
          </div>
        )}

        {/* Topic Selector Pills */}
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {QUERY_SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cx(
                'press shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition',
                subject === s ? 'bg-[#0084FF] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <div className="flex items-end gap-2 rounded-[24px] bg-slate-100 p-1.5 pl-4 ring-1 ring-inset ring-slate-200/80 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084FF]">
          <textarea
            rows={1}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={600}
            placeholder="ইনচার্জকে বার্তা লিখুন…"
            className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent py-2 text-[14.5px] text-ink outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !message.trim()}
            onClick={send}
            className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#006AFF] to-[#0084FF] text-white shadow-md transition disabled:opacity-40"
            title="বার্তা পাঠান"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {errs.length > 0 && <p className="mt-1.5 px-2 text-[12.5px] font-medium text-rose-600">{errs.join(' · ')}</p>}
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
