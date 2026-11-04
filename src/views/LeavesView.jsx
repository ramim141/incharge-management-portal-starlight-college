import React, { useMemo, useState } from 'react';
import { CalendarOff, Check, X, Plus, Undo2, Clock3, MessageSquareText, Send, Trash2, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Card, Badge, Button, IconButton, RollBadge, Sheet, Field, Input, EmptyState, cx } from '../components/ui';
import { fmtDate, fmtTime, todayISO } from '../lib/format';
import { LEAVE_STATUS, LEAVE_REASONS, leaveDays, validateLeave } from '../lib/leave';
import { QUERY_STATUS } from '../lib/query';

const LEAVE_TABS = [
  { id: 'pending', bn: 'অপেক্ষায়' },
  { id: 'approved', bn: 'মঞ্জুর' },
  { id: 'rejected', bn: 'নামঞ্জুর' },
];

const QUERY_TABS = [
  { id: 'pending', bn: 'অপেক্ষায়' },
  { id: 'replied', bn: 'উত্তর দেওয়া হয়েছে' },
  { id: 'all', bn: 'সকল জিজ্ঞাসা' },
];

const range = (l) => (l.to && l.to !== l.from ? `${fmtDate(l.from, { year: false })} – ${fmtDate(l.to, { year: false })}` : fmtDate(l.from, { year: false }));

/** Leave applications & student queries management */
export const LeavesView = () => {
  const { leaves, decideLeave, queries = [], deleteQuery } = useApp();
  const { toast, confirm } = useUI();
  const [section, setSection] = useState(() => {
    if (typeof window !== 'undefined' && window.__leavesInitialSection) {
      const s = window.__leavesInitialSection;
      delete window.__leavesInitialSection;
      return s;
    }
    return 'leaves';
  });
  const [tab, setTab] = useState('pending');
  const [queryTab, setQueryTab] = useState('pending');
  const [adding, setAdding] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [replying, setReplying] = useState(null);

  const sortedLeaves = useMemo(() => [...leaves].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [leaves]);
  const leaveCount = (st) => sortedLeaves.filter((l) => l.status === st).length;
  const leaveList = sortedLeaves.filter((l) => l.status === tab);
  const pendingLeaves = leaveCount('pending');

  const sortedQueries = useMemo(() => [...queries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [queries]);
  const queryCount = (st) => (st === 'all' ? sortedQueries.length : sortedQueries.filter((q) => q.status === st).length);
  const queryList = sortedQueries.filter((q) => (queryTab === 'all' ? true : q.status === queryTab));
  const pendingQueries = sortedQueries.filter((q) => q.status === 'pending').length;

  const approve = async (l) => {
    const { converted } = await decideLeave(l.id, 'approved');
    toast(converted ? `ছুটি মঞ্জুর — ${converted} দিনের অনুপস্থিতি ছুটিতে বদলেছে` : 'ছুটি মঞ্জুর হয়েছে');
  };
  const back = async (l) => {
    await decideLeave(l.id, 'pending');
    toast('আবার অপেক্ষায় রাখা হয়েছে');
  };

  const handleDeleteQuery = async (q) => {
    const ok = await confirm({
      title: 'জিজ্ঞাসা মুছে ফেলবেন?',
      message: `${q.studentName}-এর "${q.subject}" সম্পর্কিত জিজ্ঞাসাটি মুছে ফেলতে চান?`,
      confirmText: 'মুছে ফেলুন',
      tone: 'danger',
    });
    if (ok) {
      await deleteQuery(q.id);
      toast('জিজ্ঞাসা মুছে ফেলা হয়েছে');
    }
  };

  return (
    <div>
      <PageHeader
        title={section === 'leaves' ? 'ছুটির আবেদন' : 'শিক্ষার্থীর জিজ্ঞাসা / ইনবক্স'}
        subtitle={section === 'leaves' ? 'অভিভাবকের আবেদন মঞ্জুর বা নামঞ্জুর করুন' : 'শিক্ষার্থী পোর্টাল থেকে আসা প্রশ্ন ও বার্তার উত্তর দিন'}
        actions={section === 'leaves' ? <IconButton icon={Plus} label="ছুটি যোগ করুন" onClick={() => setAdding(true)} /> : null}
      >
        {/* Main section switcher: Leaves vs Queries */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setSection('leaves')}
            className={cx(
              'press flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition',
              section === 'leaves' ? 'bg-white text-ink shadow-card' : 'text-slate-600 hover:text-ink',
            )}
          >
            <CalendarOff className="h-4 w-4" />
            <span>ছুটির আবেদন</span>
            {pendingLeaves > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {pendingLeaves}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSection('queries')}
            className={cx(
              'press flex h-10 items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition',
              section === 'queries' ? 'bg-white text-ink shadow-card' : 'text-slate-600 hover:text-ink',
            )}
          >
            <MessageSquareText className="h-4 w-4" />
            <span>শিক্ষার্থীর জিজ্ঞাসা</span>
            {pendingQueries > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {pendingQueries}
              </span>
            )}
          </button>
        </div>

        {/* Sub-tabs for Leaves */}
        {section === 'leaves' && (
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/60 p-1">
            {LEAVE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx('h-9 rounded-xl text-[13.5px] font-semibold transition', tab === t.id ? 'bg-white text-ink shadow-card' : 'text-slate-500')}
              >
                {t.bn}
                <span className={cx('tabular ml-1 text-[12px]', tab === t.id ? 'text-brand-600 font-bold' : 'text-slate-400')}>{leaveCount(t.id)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sub-tabs for Queries */}
        {section === 'queries' && (
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/60 p-1">
            {QUERY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setQueryTab(t.id)}
                className={cx('h-9 rounded-xl text-[13.5px] font-semibold transition', queryTab === t.id ? 'bg-white text-ink shadow-card' : 'text-slate-500')}
              >
                {t.bn}
                <span className={cx('tabular ml-1 text-[12px]', queryTab === t.id ? 'text-brand-600 font-bold' : 'text-slate-400')}>{queryCount(t.id)}</span>
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {/* LEAVES SECTION */}
      {section === 'leaves' && (
        <>
          {leaveList.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title={tab === 'pending' ? 'কোনো আবেদন অপেক্ষায় নেই' : 'এখানে কিছু নেই'}
              text={tab === 'pending' ? 'অভিভাবক পোর্টাল থেকে আবেদন করলে এখানে আসবে' : undefined}
            />
          ) : (
            <div className="stagger space-y-2.5">
              {leaveList.map((l) => (
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
        </>
      )}

      {/* QUERIES SECTION */}
      {section === 'queries' && (
        <>
          {queryList.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title={queryTab === 'pending' ? 'কোনো জিজ্ঞাসা অপেক্ষায় নেই' : 'এখানে কোনো জিজ্ঞাসা নেই'}
              text={queryTab === 'pending' ? 'শিক্ষার্থী পোর্টাল থেকে ইনবক্সে প্রশ্ন পাঠালে এখানে আসবে' : undefined}
            />
          ) : (
            <div className="stagger space-y-3">
              {queryList.map((q) => {
                const statusMeta = QUERY_STATUS[q.status] || { bn: q.status, tone: 'slate' };
                const isPending = q.status === 'pending';
                return (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center gap-3">
                      <RollBadge roll={q.roll} seed={q.studentId} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15.5px] font-bold text-ink">{q.studentName}</p>
                          <span className="tabular text-[12px] font-bold text-slate-500">রোল #{q.roll}</span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-brand-600">{q.subject}</p>
                      </div>
                      <Badge tone={statusMeta.tone} dot>
                        {statusMeta.bn}
                      </Badge>
                    </div>

                    {/* Student's Question */}
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-100">
                      <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-slate-400">শিক্ষার্থীর প্রশ্ন</p>
                      <p className="text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap">{q.message}</p>
                    </div>

                    {/* Replied Section if answered */}
                    {q.reply && (
                      <div className="mt-2.5 rounded-2xl bg-emerald-50/80 p-3.5 ring-1 ring-inset ring-emerald-200/60">
                        <div className="flex items-center justify-between text-[11.5px] font-bold text-emerald-800 mb-1">
                          <span>আপনার উত্তর ({q.repliedBy || 'ইনচার্জ'})</span>
                          {q.repliedAt && (
                            <span className="font-normal text-emerald-700">
                              {fmtDate(String(q.repliedAt).slice(0, 10))} {fmtTime(q.repliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] leading-relaxed text-emerald-950 whitespace-pre-wrap">{q.reply}</p>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[12px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" /> {fmtDate(String(q.createdAt).slice(0, 10))} {fmtTime(q.createdAt)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex items-center gap-2 pt-1 border-t border-slate-100">
                      {isPending ? (
                        <Button
                          variant="primary"
                          icon={Send}
                          block
                          onClick={() => setReplying(q)}
                        >
                          উত্তর দিন
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Undo2}
                          onClick={() => setReplying(q)}
                        >
                          উত্তর পরিবর্তন
                        </Button>
                      )}
                      <IconButton
                        icon={Trash2}
                        label="মুছুন"
                        onClick={() => handleDeleteQuery(q)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sheets */}
      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title="নামঞ্জুর করবেন?" subtitle={rejecting ? `${rejecting.studentName} · ${range(rejecting)}` : ''}>
        {rejecting && <RejectForm leave={rejecting} onDone={() => setRejecting(null)} />}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="ছুটি যোগ করুন" subtitle="ফোনে জানালে এখানে লিখে রাখুন — সঙ্গে সঙ্গে মঞ্জুর হবে">
        {adding && <AddForm onDone={() => setAdding(false)} />}
      </Sheet>

      <Sheet open={!!replying} onClose={() => setReplying(null)} title="শিক্ষার্থীর প্রশ্নের উত্তর দিন" subtitle={replying ? `${replying.studentName} (রোল ${replying.roll})` : ''}>
        {replying && <ReplyForm query={replying} onDone={() => setReplying(null)} />}
      </Sheet>
    </div>
  );
};

function ReplyForm({ query, onDone }) {
  const { replyQuery } = useApp();
  const { toast } = useUI();
  const [text, setText] = useState(query.reply || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await replyQuery(query.id, text.trim());
      toast('উত্তর পাঠানো হয়েছে');
      onDone();
    } catch {
      toast('উত্তর পাঠাতে সমস্যা হয়েছে');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-inset ring-slate-100">
        <div className="flex items-center justify-between text-[12px] font-semibold text-slate-500 mb-1">
          <span className="text-brand-600 font-bold">{query.subject}</span>
          <span>{fmtDate(String(query.createdAt).slice(0, 10))} {fmtTime(query.createdAt)}</span>
        </div>
        <p className="text-[14px] text-slate-800 whitespace-pre-wrap">{query.message}</p>
      </div>

      <Field label="আপনার উত্তর">
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="শিক্ষার্থীর প্রশ্নের স্পষ্ট উত্তর লিখুন। পোর্টাল খুললেই সে দেখতে পাবে…"
          className="w-full resize-none rounded-2xl bg-slate-50 p-3.5 text-[14.5px] text-ink outline-none ring-1 ring-inset ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-brand-500"
          autoFocus
        />
      </Field>

      <Button
        variant="primary"
        size="lg"
        block
        disabled={busy || !text.trim()}
        icon={Send}
        onClick={save}
      >
        {busy ? 'পাঠানো হচ্ছে…' : 'উত্তর পাঠান'}
      </Button>
    </div>
  );
}

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
