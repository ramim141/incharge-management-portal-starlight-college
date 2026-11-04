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

/* ───────────────────────── Query / Inquiries Card ───────────────────────── */

/** Home-screen card: ask question or send message directly to the class in-charge */
export function QueryCard({ snap, sent }) {
  const [open, setOpen] = useState(false);
  const all = mergeQueries(snap.queries, sent);
  const last = all[0];
  const pending = all.filter((q) => q.status === 'pending').length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press block w-full text-left">
        <Card className="flex items-center gap-3 !p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">ইনচার্জকে জিজ্ঞাসা / বার্তা</span>
            <span className="block truncate text-[12.5px] text-slate-500">
              {last ? `${last.subject} · ${QUERY_STATUS[last.status]?.bn || last.status}` : 'ফি বা হাজিরা নিয়ে প্রশ্ন থাকলে জানান'}
            </span>
          </span>
          {pending > 0 && <Badge tone="amber">{pending}টি অপেক্ষায়</Badge>}
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
        </Card>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} full title="ইনচার্জের সাথে বার্তা" subtitle="আপনার বার্তা বা প্রশ্নের উত্তর ইনচার্জ এখানেই দেবেন">
        {open && <QueryForm snap={snap} existing={all} onSent={sent.add} />}
      </Sheet>
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

function QueryForm({ snap, existing, onSent }) {
  const [subject, setSubject] = useState(QUERY_SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
      setMessage('');
    } catch (err) {
      setErrs([err?.code === 'permission-denied' ? 'বার্তা পাঠানো যায়নি। ইনচার্জকে জানান বা পরে আবার চেষ্টা করুন।' : err?.code === 'app/timeout' ? OFFLINE_MESSAGE : errorText(err)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {done ? (
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">বার্তা সফলভাবে পাঠানো হয়েছে</p>
            <p className="text-[13px]">শ্রেণি ইনচার্জ আপনার বার্তা দেখে উত্তর দিলে এখানেই দেখতে পাবেন।</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDone(false)}>
              আরেকটি বার্তা পাঠান
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-[13.5px] font-semibold text-slate-700">বিষয়ের ধরণ</label>
            <div className="flex flex-wrap gap-2">
              {QUERY_SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cx(
                    'press rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
                    subject === s ? 'bg-indigo-600 text-white shadow-lift' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Field label="আপনার বার্তা বা প্রশ্ন" hint="সর্বোচ্চ ৬০০ অক্ষর">
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={600}
              placeholder="ইনচার্জের কাছে কী জানতে চান লিখুন (যেমন: ফি সংক্রান্ত, প্রবেশপত্র, বা কোনো তথ্যে ভুল থাকলে)..."
            />
          </Field>

          {errs.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{errs.join(' · ')}</p>}

          <Button size="lg" block icon={Send} disabled={busy || !message.trim()} onClick={send}>
            {busy ? 'পাঠানো হচ্ছে…' : 'ইনচার্জকে পাঠান'}
          </Button>
        </>
      )}

      {existing.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 text-[13.5px] font-semibold text-slate-600">পূর্ববর্তী বার্তা ও উত্তর</p>
          <div className="space-y-3">
            {existing.map((q) => {
              const isReplied = q.status === 'replied' && !!q.reply;
              return (
                <div key={q.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-800">{q.subject}</span>
                    <Badge tone={isReplied ? 'green' : 'amber'} dot>
                      {QUERY_STATUS[q.status]?.bn || (isReplied ? 'উত্তর দেওয়া হয়েছে' : 'অপেক্ষায়')}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13.5px] text-slate-700 leading-relaxed">{q.message}</p>
                  <p className="mt-1 text-[11.5px] text-slate-400">পাঠানো: {fmtDate(q.createdAt)} {fmtTime(q.createdAt)}</p>

                  {/* Incharge Reply */}
                  {isReplied && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-[13px] text-emerald-900">
                      <div className="flex items-center justify-between text-[11.5px] font-bold text-emerald-700">
                        <span>ইনচার্জের উত্তর ({q.repliedBy || 'ইনচার্জ'})</span>
                        {q.repliedAt && <span>{fmtDate(q.repliedAt)}</span>}
                      </div>
                      <p className="mt-1 leading-relaxed font-medium">{q.reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
