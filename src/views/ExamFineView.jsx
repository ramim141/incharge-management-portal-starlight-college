import React, { useMemo, useState } from 'react';
import { Plus, ClipboardList, Gavel, ChevronDown, CheckCircle2, Undo2, CalendarDays, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Segmented, Card, RollBadge, Badge, Button, IconButton, Progress, Sheet, Field, Input, EmptyState, SearchBar, FilterButton, cx, CARD_GRID } from '../components/ui';
import { taka, fmtDate, studentTags, FINE_STATUS } from '../lib/format';

export const ExamFineView = () => {
  const [tab, setTab] = useState('exams');
  const [newExam, setNewExam] = useState(false);
  const [newFine, setNewFine] = useState(false);

  return (
    <div>
      <PageHeader
        title="পরীক্ষা ও জরিমানা"
        subtitle={tab === 'exams' ? 'পরীক্ষার ফি আদায়ের অবস্থা' : 'জরিমানা দিন, বদলান বা মওকুফ করুন'}
        actions={<IconButton icon={Plus} label={tab === 'exams' ? 'নতুন পরীক্ষা' : 'নতুন জরিমানা'} onClick={() => (tab === 'exams' ? setNewExam(true) : setNewFine(true))} />}
      >
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'exams', label: 'পরীক্ষার ফি' },
            { value: 'fines', label: 'জরিমানা' },
          ]}
        />
      </PageHeader>

      {tab === 'exams' ? <Exams onNew={() => setNewExam(true)} /> : <Fines onNew={() => setNewFine(true)} />}

      <Sheet open={newExam} onClose={() => setNewExam(false)} title="নতুন পরীক্ষার ফি" subtitle="সব শিক্ষার্থীর জন্য ফি তৈরি হবে">
        {newExam && <NewExamForm onDone={() => setNewExam(false)} />}
      </Sheet>
      <Sheet open={newFine} onClose={() => setNewFine(false)} title="জরিমানা দিন" subtitle="নির্দিষ্ট শিক্ষার্থীর জন্য">
        {newFine && <NewFineForm onDone={() => setNewFine(false)} />}
      </Sheet>
    </div>
  );
};

function Exams({ onNew }) {
  const { examFees, students, recordPayment } = useApp();
  const { confirm, toast, openReceipt } = useUI();
  const [open, setOpen] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    examFees.forEach((e) => {
      if (!map.has(e.examName)) map.set(e.examName, []);
      map.get(e.examName).push(e);
    });
    return [...map.entries()].map(([name, items]) => ({
      name,
      items: items.sort((a, b) => Number(a.roll) - Number(b.roll)),
      paid: items.filter((i) => i.status === 'Paid').length,
      collected: items.reduce((a, i) => a + Number(i.paid || 0), 0),
      due: items.reduce((a, i) => a + Number(i.due || 0), 0),
      amount: items[0]?.amount,
      deadline: items[0]?.deadline,
    }));
  }, [examFees]);

  const collect = async (e) => {
    const s = students.find((x) => x.id === e.studentId || x.roll === Number(e.roll));
    if (!s) return;
    const ok = await confirm({ title: `${taka(e.amount)} নগদ গ্রহণ করবেন?`, message: `${s.name} (রোল ${s.roll}) — ${e.examName}`, confirmText: 'গ্রহণ করুন' });
    if (!ok) return;
    const p = await recordPayment({
      studentId: s.id,
      roll: s.roll,
      studentName: s.name,
      amount: e.amount,
      items: [{ description: e.examName, amount: e.amount }],
      method: 'Cash',
      examFeeId: e.id,
    });
    toast('পরীক্ষার ফি গ্রহণ করা হয়েছে');
    openReceipt(p, true);
  };

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="কোনো পরীক্ষার ফি নেই"
        text="নতুন পরীক্ষা যোগ করলে সব শিক্ষার্থীর জন্য ফি তৈরি হবে"
        action={
          <Button icon={Plus} onClick={onNew}>
            নতুন পরীক্ষা
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
      {groups.map((g) => {
        const expanded = open === g.name;
        const pct = g.items.length ? (g.paid / g.items.length) * 100 : 0;
        return (
          <Card key={g.name} className="overflow-hidden">
            <button type="button" onClick={() => setOpen(expanded ? null : g.name)} className="w-full p-4 text-left">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-bold leading-snug text-ink">{g.name}</p>
                  <p className="text-[12.5px] text-slate-500">
                    ফি {taka(g.amount)}
                    {g.deadline ? ` · শেষ তারিখ ${fmtDate(g.deadline, { year: false })}` : ''}
                  </p>
                </div>
                <ChevronDown className={cx('mt-1 h-5 w-5 text-slate-400 transition', expanded && 'rotate-180')} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="tabular font-semibold text-ink">
                  {g.paid}/{g.items.length} জন দিয়েছে
                </span>
                <span className="tabular text-slate-500">
                  <span className="font-semibold text-emerald-600">{taka(g.collected)}</span> · বাকি <span className="font-semibold text-rose-600">{taka(g.due)}</span>
                </span>
              </div>
              <Progress value={pct} className="mt-2" />
            </button>

            {expanded && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {g.items.map((e) => {
                  const s = students.find((x) => x.id === e.studentId || x.roll === Number(e.roll));
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <RollBadge roll={s?.roll ?? e.roll} seed={e.studentId} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-ink">{s?.name || e.studentName || `রোল ${e.roll}`}</p>
                      </div>
                      {e.status === 'Paid' ? (
                        <span className="flex items-center gap-1 text-[13px] font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> পরিশোধিত
                        </span>
                      ) : (
                        <Button size="xs" variant="soft" onClick={() => collect(e)}>
                          আদায় {taka(e.due || e.amount)}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const FINE_FILTER_TITLE = { Active: 'বাকি জরিমানা', Waived: 'মওকুফ করা জরিমানা', Paid: 'পরিশোধিত জরিমানা', All: 'সব জরিমানা' };

function Fines({ onNew }) {
  const { fines, students, waiveFine, settings } = useApp();
  const { confirm, toast, openFine } = useUI();
  const [filters, setFilters] = useState({ status: 'Active' });
  const filter = filters.status;
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const active = fines.filter((f) => f.status === 'Active');
  const activeTotal = active.reduce((a, f) => a + f.due, 0);
  const waivedTotal = fines.reduce((a, f) => a + f.waived, 0);

  const q = query.trim().toLowerCase();
  const list = fines
    .filter((f) => filter === 'All' || f.status === filter)
    .filter((f) => {
      if (!q) return true;
      const s = byId.get(f.studentId);
      return String(s?.roll ?? f.roll).includes(q) || (s?.name || '').toLowerCase().includes(q) || (s?.nameEn || '').toLowerCase().includes(q);
    });

  const waive = async (f, s) => {
    const ok = await confirm({
      title: 'জরিমানা মওকুফ করবেন?',
      message: `${s?.name || `রোল ${f.roll}`} — ${taka(f.due)} (${f.reason}) · পরে এডিট করে ফেরানো যাবে`,
      confirmText: 'মওকুফ করুন',
      icon: Undo2,
    });
    if (!ok) return;
    await waiveFine(f.id);
    toast('জরিমানা মওকুফ হয়েছে');
  };

  if (fines.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="কোনো জরিমানা নেই"
        text={`হাজিরায় কাউকে অনুপস্থিত দিলে আপনাআপনি ${taka(settings.absentFine)} জরিমানা হবে`}
        action={
          <Button icon={Plus} variant="danger" onClick={onNew}>
            জরিমানা দিন
          </Button>
        }
      />
    );
  }

  const count = (st) => fines.filter((f) => st === 'All' || f.status === st).length;

  return (
    <>
      <Card className="mb-3 flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-[12.5px] text-slate-500">বাকি জরিমানা · {active.length}টি</p>
          <p className="tabular text-[22px] font-extrabold text-rose-600">{taka(activeTotal)}</p>
        </div>
        {waivedTotal > 0 && (
          <div className="text-right">
            <p className="text-[12px] text-slate-500">মোট মওকুফ</p>
            <p className="tabular text-[15px] font-bold text-slate-600">{taka(waivedTotal)}</p>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <SearchBar className="flex-1" value={query} onChange={setQuery} placeholder="রোল বা নাম দিয়ে খুঁজুন" />
        <FilterButton
          value={filters}
          defaults={{ status: 'Active' }}
          onChange={setFilters}
          groups={[
            {
              key: 'status',
              label: 'অবস্থা',
              options: [
                { value: 'Active', label: 'বাকি', count: count('Active') },
                { value: 'Waived', label: 'মওকুফ', count: count('Waived') },
                { value: 'Paid', label: 'পরিশোধিত', count: count('Paid') },
                { value: 'All', label: 'সব', count: count('All') },
              ],
            },
          ]}
        />
      </div>
      <p className="mb-2 mt-3 text-[12.5px] text-slate-500">
        {FINE_FILTER_TITLE[filter]} · ট্যাপ করে বদলান বা মওকুফ করুন
      </p>

      {list.length === 0 ? (
        <EmptyState icon={Gavel} title="এই তালিকায় কিছু নেই" />
      ) : (
        <div className={CARD_GRID}>
          {list.map((f) => {
            const s = byId.get(f.studentId);
            const isActive = f.status === 'Active';
            return (
              <Card key={f.id} className={cx('p-4', !isActive && 'opacity-75')}>
                <button type="button" onClick={() => openFine(f.id)} className="flex w-full items-center gap-3 text-left">
                  <RollBadge roll={s?.roll ?? f.roll} seed={f.studentId} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{s?.name || `রোল ${f.roll}`}</p>
                    <p className="text-[12.5px] text-slate-500">
                      {fmtDate(f.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cx('tabular text-[17px] font-extrabold', isActive ? 'text-rose-600' : 'text-slate-400 line-through')}>
                      {taka(isActive ? f.due : f.amount)}
                    </p>
                    {f.waived > 0 && isActive && <p className="tabular text-[11.5px] text-slate-500">মওকুফ {taka(f.waived)}</p>}
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate rounded-xl bg-slate-50 px-3 py-2 text-[13.5px] text-slate-600">{f.reason}</p>
                  <Button size="sm" variant="ghost" icon={Pencil} className="w-10 px-0" aria-label="এডিট" onClick={() => openFine(f.id)} />
                  {isActive ? (
                    <Button size="sm" variant="secondary" icon={Undo2} onClick={() => waive(f, s)}>
                      মওকুফ
                    </Button>
                  ) : (
                    <Badge tone={FINE_STATUS[f.status].tone}>{FINE_STATUS[f.status].bn}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

const EXAM_PRESETS = ['অর্ধবার্ষিক পরীক্ষা', 'বার্ষিক পরীক্ষা', 'প্রাক-নির্বাচনী পরীক্ষা', 'মডেল টেস্ট'];

function NewExamForm({ onDone }) {
  const { createExam, students, settings } = useApp();
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('500');
  const [deadline, setDeadline] = useState('');
  const [err, setErr] = useState('');

  const save = async () => {
    if (!name.trim()) return setErr('পরীক্ষার নাম দিন');
    if (!Number(amount)) return setErr('ফি এর পরিমাণ দিন');
    await createExam({ examName: name.trim(), amount: Number(amount), deadline });
    toast(`${students.length} জনের জন্য "${name.trim()}" ফি তৈরি হয়েছে`);
    onDone();
  };

  return (
    <div className="space-y-5 pt-1">
      <Field label="পরীক্ষার নাম" error={err}>
        <Input value={name} onChange={(e) => (setName(e.target.value), setErr(''))} placeholder="যেমন অর্ধবার্ষিক পরীক্ষা ২০২৬" />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-2">
        {EXAM_PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setName(`${p} ${settings.currentYear}`)} className="press rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
            {p}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ফি (৳)">
          <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="শেষ তারিখ">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-[13.5px] text-brand-800">
        <CalendarDays className="h-4 w-4 shrink-0" />
        {students.length} জন শিক্ষার্থীর প্রত্যেকের জন্য {taka(amount)} বকেয়া যোগ হবে
      </div>
      <Button size="lg" block onClick={save}>
        তৈরি করুন
      </Button>
    </div>
  );
}

function NewFineForm({ onDone }) {
  const { students, addFine } = useApp();
  const { toast } = useUI();
  const [roll, setRoll] = useState('');
  const [amount, setAmount] = useState('100');
  const [reason, setReason] = useState('বিলম্ব জরিমানা');
  const s = students.find((x) => Number(x.roll) === Number(roll));

  const save = async () => {
    if (!s || !Number(amount) || !reason.trim()) return;
    await addFine({ studentId: s.id, roll: s.roll, amount: Number(amount), reason: reason.trim() });
    toast(`${s.name} — ${taka(amount)} জরিমানা যোগ হয়েছে`);
    onDone();
  };

  return (
    <div className="space-y-5 pt-1">
      <Field label="শিক্ষার্থীর রোল">
        <Input type="number" inputMode="numeric" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="যেমন 105" autoFocus />
      </Field>
      {roll && (
        <div className={cx('-mt-2 flex items-center gap-3 rounded-2xl p-3', s ? 'bg-slate-50' : 'bg-rose-50')}>
          {s ? (
            <>
              <RollBadge roll={s.roll} seed={s.id} size={40} />
              <div>
                <p className="text-[15px] font-semibold text-ink">{s.name}</p>
                <p className="text-[12.5px] text-slate-500">{studentTags(s) || `রোল ${s.roll}`}</p>
              </div>
            </>
          ) : (
            <p className="text-[13.5px] font-medium text-rose-600">এই রোলে কেউ নেই</p>
          )}
        </div>
      )}
      <Field label="পরিমাণ (৳)">
        <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <div className="-mt-2 flex gap-2">
        {[50, 100, 200, 500].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className={cx('press flex-1 rounded-xl py-2 text-[14px] font-bold', Number(amount) === v ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}
          >
            ৳{v}
          </button>
        ))}
      </div>
      <Field label="কারণ">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-2">
        {['বিলম্ব জরিমানা', 'অনুপস্থিতি জরিমানা', 'দেরিতে উপস্থিতি', 'ইউনিফর্ম নেই', 'শৃঙ্খলা ভঙ্গ'].map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="press rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
            {r}
          </button>
        ))}
      </div>
      <Button size="lg" variant="danger" block disabled={!s || !Number(amount)} onClick={save}>
        জরিমানা যোগ করুন
      </Button>
    </div>
  );
}
