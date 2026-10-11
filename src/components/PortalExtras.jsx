import React, { useState } from 'react';
import { CalendarOff, ChevronRight, CheckCircle2, Send } from 'lucide-react';
import { backend, errorText } from '../backend';
import { Card, Badge, Button, Sheet, Field, Input, cx } from './ui';
import { fmtDate, todayISO } from '../lib/format';
import { newId } from '../lib/hash';
import { isOffline, OFFLINE_MESSAGE, withTimeout } from '../lib/sync';
import { LEAVE_STATUS, LEAVE_REASONS, leaveDays, validateLeave, newLeave } from '../lib/leave';

const range = (l) => (l.to && l.to !== l.from ? `${fmtDate(l.from, { year: false })} – ${fmtDate(l.to, { year: false })}` : fmtDate(l.from, { year: false }));

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
              {last ? `${range(last)} · ${LEAVE_STATUS[last.status].bn}` : 'ছুটি লাগলে এখান থেকেই জানান'}
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

// What was just sent from this screen shows at once, before the class's server record catches up
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
      const { portalKey: _key, classId: _c, studentId: _s, studentName: _n, roll: _r, ...mine } = leave; // the screen needs only these
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
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="যেমন জ্বর, বিয়ের অনুষ্ঠান" />
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
              <div key={l.id} className="rounded-2xl bg-slate-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="tabular text-[14px] font-bold text-ink">
                    {range(l)} <span className="font-medium text-slate-500">· {leaveDays(l)} দিন</span>
                  </p>
                  <Badge tone={LEAVE_STATUS[l.status].tone} dot>
                    {LEAVE_STATUS[l.status].bn}
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
