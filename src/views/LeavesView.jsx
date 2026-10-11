import React, { useMemo, useState } from 'react';
import { CalendarOff, Check, X, Plus, Undo2, Clock3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Card, Badge, Button, IconButton, RollBadge, Sheet, Field, Input, EmptyState, cx } from '../components/ui';
import { fmtDate, fmtTime, todayISO } from '../lib/format';
import { LEAVE_STATUS, LEAVE_REASONS, leaveDays, validateLeave } from '../lib/leave';

const TABS = [
  { id: 'pending', bn: 'অপেক্ষায়' },
  { id: 'approved', bn: 'মঞ্জুর' },
  { id: 'rejected', bn: 'নামঞ্জুর' },
];

const range = (l) => (l.to && l.to !== l.from ? `${fmtDate(l.from, { year: false })} – ${fmtDate(l.to, { year: false })}` : fmtDate(l.from, { year: false }));

/** Leave applications from guardians (and ones the in-charge enters): decide each, and see the history */
export const LeavesView = () => {
  const { leaves, decideLeave } = useApp();
  const { toast } = useUI();
  const [tab, setTab] = useState('pending');
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const sorted = useMemo(() => [...leaves].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [leaves]);
  const count = (st) => sorted.filter((l) => l.status === st).length;
  const list = sorted.filter((l) => l.status === tab);

  const approve = async (l) => {
    const { converted } = await decideLeave(l.id, 'approved');
    toast(converted ? `ছুটি মঞ্জুর — ${converted} দিনের অনুপস্থিতি ছুটিতে বদলেছে` : 'ছুটি মঞ্জুর হয়েছে');
  };
  const back = async (l) => {
    await decideLeave(l.id, 'pending');
    toast('আবার অপেক্ষায় রাখা হয়েছে');
  };

  return (
    <div>
      <PageHeader
        title="ছুটির আবেদন"
        subtitle="অভিভাবকের আবেদন মঞ্জুর বা নামঞ্জুর করুন"
        actions={<IconButton icon={Plus} label="ছুটি যোগ করুন" onClick={() => setAdding(true)} />}
      >
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx('h-10 rounded-xl text-[14px] font-semibold transition', tab === t.id ? 'bg-white text-ink shadow-card' : 'text-slate-500')}
            >
              {t.bn}
              <span className={cx('tabular ml-1 text-[12.5px]', tab === t.id ? 'text-brand-600' : 'text-slate-400')}>{count(t.id)}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      {list.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title={tab === 'pending' ? 'কোনো আবেদন অপেক্ষায় নেই' : 'এখানে কিছু নেই'}
          text={tab === 'pending' ? 'অভিভাবক পোর্টাল থেকে আবেদন করলে এখানে আসবে' : undefined}
        />
      ) : (
        <div className="stagger space-y-2.5">
          {list.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center gap-3">
                <RollBadge roll={l.roll} seed={l.studentId} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-bold text-ink">{l.studentName}</p>
                  <p className="tabular text-[12.5px] text-slate-500">
                    {range(l)} · {leaveDays(l)} দিন
                  </p>
                </div>
                <Badge tone={LEAVE_STATUS[l.status].tone} dot>
                  {LEAVE_STATUS[l.status].bn}
                </Badge>
              </div>

              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[13.5px] leading-snug text-slate-700">{l.reason}</p>
              <p className="mt-2 flex items-center gap-1 text-[12px] text-slate-400">
                <Clock3 className="h-3.5 w-3.5" /> {fmtDate(String(l.createdAt).slice(0, 10))} {fmtTime(l.createdAt)}
                {l.decidedBy ? ` · ${l.decidedBy}` : ''}
              </p>
              {l.note && <p className="mt-1 text-[12.5px] text-slate-500">নোট: {l.note}</p>}

              {l.status === 'pending' ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Button variant="soft-danger" icon={X} onClick={() => setRejecting(l)}>
                    নামঞ্জুর
                  </Button>
                  <Button variant="success" icon={Check} onClick={() => approve(l)}>
                    মঞ্জুর
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" icon={Undo2} className="mt-3" onClick={() => back(l)}>
                  সিদ্ধান্ত ফেরান
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title="নামঞ্জুর করবেন?" subtitle={rejecting ? `${rejecting.studentName} · ${range(rejecting)}` : ''}>
        {rejecting && <RejectForm leave={rejecting} onDone={() => setRejecting(null)} />}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="ছুটি যোগ করুন" subtitle="ফোনে জানালে এখানে লিখে রাখুন — সঙ্গে সঙ্গে মঞ্জুর হবে">
        {adding && <AddForm onDone={() => setAdding(false)} />}
      </Sheet>
    </div>
  );
};

function RejectForm({ leave, onDone }) {
  const { decideLeave } = useApp();
  const { toast } = useUI();
  const [note, setNote] = useState('');
  const run = async () => {
    await decideLeave(leave.id, 'rejected', note.trim());
    toast('ছুটি নামঞ্জুর হয়েছে');
    onDone();
  };
  return (
    <div className="space-y-4 pt-1">
      <Field label="কারণ (অভিভাবক দেখতে পাবেন, ঐচ্ছিক)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন পরীক্ষা চলছে" />
      </Field>
      <Button variant="danger" size="lg" block onClick={run}>
        নামঞ্জুর করুন
      </Button>
    </div>
  );
}

function AddForm({ onDone }) {
  const { students, addLeave } = useApp();
  const { toast } = useUI();
  const today = todayISO();
  const [roll, setRoll] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState([]);
  const student = students.find((s) => String(s.roll) === String(roll).trim() && s.status !== 'inactive');

  const save = async () => {
    const e = validateLeave({ from, to, reason }, today);
    if (!student) e.unshift('এই রোলে কোনো শিক্ষার্থী নেই');
    setErrs(e);
    if (e.length) return;
    await addLeave({ student, from, to, reason });
    toast('ছুটি যোগ হয়েছে');
    onDone();
  };

  return (
    <div className="space-y-4 pt-1">
      <Field label="শিক্ষার্থীর রোল">
        <Input type="number" inputMode="numeric" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="যেমন 11001" autoFocus />
      </Field>
      {roll && <p className={cx('-mt-2 text-[13.5px] font-semibold', student ? 'text-emerald-600' : 'text-rose-600')}>{student ? student.name : 'এই রোলে কেউ নেই'}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="শুরুর তারিখ">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="শেষ তারিখ (ঐচ্ছিক)">
          <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field label="কারণ">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-2">
        {LEAVE_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="press rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
            {r}
          </button>
        ))}
      </div>
      {errs.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{errs.join(' · ')}</p>}
      <Button size="lg" block onClick={save}>
        ছুটি যোগ করুন
      </Button>
    </div>
  );
}
