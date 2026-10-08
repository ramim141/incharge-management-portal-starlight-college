import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, SearchBar, RollBadge, Badge, Button, Field, Input, Checkbox, EmptyState, cx } from './ui';
import { taka, monthBn, studentTags, METHODS, todayISO, ACADEMIC_MONTHS, EN_MONTHS, feeStatus } from '../lib/format';

export function PaymentSheet() {
  const { payment, closePayment } = useUI();
  return (
    <Sheet open={!!payment} onClose={closePayment} full title="টাকা আদায়" subtitle="পেমেন্ট গ্রহণ করে রশিদ তৈরি করুন">
      {payment && <PaymentBody initialStudent={payment.student} />}
    </Sheet>
  );
}

function PaymentBody({ initialStudent }) {
  const { students, fees, fines, examFees, settings, recordPayment, calculateStudentTotalDue } = useApp();
  const { closePayment, openReceipt, toast } = useUI();

  const [student, setStudent] = useState(initialStudent);
  const [query, setQuery] = useState('');

  const ctx = useMemo(() => {
    if (!student) return null;
    // Whole academic session (July → June) + any older month still unpaid: the in-charge picks
    // arrears, the current month or months in advance — several at once if needed
    const sessionStart = ACADEMIC_MONTHS.indexOf(settings.currentMonth) <= 5 ? settings.currentYear : settings.currentYear - 1;
    const yearOf = (m) => (ACADEMIC_MONTHS.indexOf(m) <= 5 ? sessionStart : sessionStart + 1);
    const curIdx = ACADEMIC_MONTHS.indexOf(settings.currentMonth);
    const own = fees.filter((f) => f.studentId === student.id);
    const rate = Number(student.monthlyFee || settings.defaultMonthlyFee);
    const keyOf = (m, y) => `${y}-${m}`;
    const admitted = String(student.admissionDate || '').slice(0, 7); // "2026-10"
    const session = ACADEMIC_MONTHS.map((m, i) => {
      const y = yearOf(m);
      const row = own.find((f) => f.month === m && Number(f.year) === y);
      // Months before admission are not owed (unless a fee row was made for them anyway)
      if (!row && admitted && `${y}-${String(EN_MONTHS.indexOf(m) + 1).padStart(2, '0')}` < admitted) return null;
      return {
        key: keyOf(m, y), month: m, year: y, row,
        due: row ? Number(row.due || 0) : rate,
        paid: row ? feeStatus(row) === 'Paid' : false,
        future: i > curIdx,
        past: i < curIdx,
        current: i === curIdx,
      };
    }).filter(Boolean);
    const older = own
      .filter((f) => Number(f.due) > 0 && !session.some((x) => x.month === f.month && x.year === Number(f.year)))
      .map((row) => ({ key: keyOf(row.month, row.year), month: row.month, year: Number(row.year), row, due: Number(row.due), paid: false, past: true }));
    const activeFines = fines.filter((fn) => fn.studentId === student.id && fn.due > 0);
    const dueExam = examFees.find((e) => e.studentId === student.id && e.status === 'Due');
    return {
      months: [...older, ...session],
      activeFines,
      dueExam,
      fine: activeFines.reduce((a, fn) => a + fn.due, 0),
      exam: dueExam ? Number(dueExam.due || dueExam.amount) : 0,
    };
  }, [student, fees, fines, examFees, settings.currentMonth, settings.currentYear, settings.defaultMonthlyFee]);

  // Starts on this month (if unpaid); the in-charge adds or removes months
  const defaultMonths = (c) => new Set((c?.months || []).filter((m) => m.current && !m.paid && m.due > 0).map((m) => m.key));
  const [months, setMonths] = useState(() => defaultMonths(ctx));
  const [sel, setSel] = useState(() => ({ fine: true, exam: false }));
  const [amount, setAmount] = useState(null); // null = follow selection
  const [method, setMethod] = useState('Cash');
  const [trxId, setTrxId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const chosen = ctx && months ? ctx.months.filter((m) => months.has(m.key)) : [];
  const monthly = chosen.reduce((a, m) => a + m.due, 0);
  const autoTotal = ctx ? monthly + (sel.fine ? ctx.fine : 0) + (sel.exam ? ctx.exam : 0) : 0;
  const total = amount ?? autoTotal;

  const pick = (s) => {
    setStudent(s);
    setMonths(null); // filled from the new student's months below
    setSel({ fine: true, exam: false });
    setAmount(null);
  };
  if (ctx && months === null) setMonths(defaultMonths(ctx));

  const toggle = (k) => {
    setSel((p) => ({ ...p, [k]: !p[k] }));
    setAmount(null);
  };
  const toggleMonth = (key) => {
    setMonths((prev) => {
      const n = new Set(prev || []);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
    setAmount(null);
  };
  const allUnpaid = () => {
    setMonths(new Set(ctx.months.filter((m) => !m.paid && !m.future && m.due > 0).map((m) => m.key)));
    setAmount(null);
  };

  const submit = async () => {
    if (!student || total <= 0 || saving) return;
    setSaving(true);
    const items = [];
    chosen.forEach((m) => m.due > 0 && items.push({ description: `${m.month} ${m.year} Monthly Fee`, amount: m.due }));
    if (sel.fine && ctx.fine > 0) items.push({ description: `Fine (${ctx.activeFines.length})`, amount: ctx.fine });
    if (sel.exam && ctx.exam > 0) items.push({ description: ctx.dueExam?.examName || 'Examination Fee', amount: ctx.exam });
    if (items.length === 0 || amount != null) {
      // Custom amount: record it as a single line so the receipt total stays honest
      items.length = 0;
      const label = chosen.map((m) => `${m.month.slice(0, 3)} ${m.year}`).join(', ');
      items.push({ description: chosen.length ? `Monthly Fee (${label})` : 'College Fee Payment', amount: total });
    }
    const [y, m, d] = date.split('-').map(Number);
    const now = new Date();
    const paidAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes());

    const created = await recordPayment({
      studentId: student.id,
      roll: student.roll,
      studentName: student.name,
      amount: total,
      items,
      method,
      trxId: method === 'Cash' ? '' : trxId,
      paymentDate: paidAt.toISOString(),
      feeMonths: chosen.map(({ month, year }) => ({ month, year })),
      fineIds: sel.fine ? ctx.activeFines.map((fn) => fn.id) : null,
      examFeeId: sel.exam && ctx.dueExam ? ctx.dueExam.id : null,
    });
    setSaving(false);
    closePayment();
    toast(`${taka(total)} গ্রহণ করা হয়েছে`);
    setTimeout(() => openReceipt(created, true), 60);
  };

  // Step 1 — pick a student
  if (!student) {
    const q = query.trim().toLowerCase();
    const list = students
      .filter((s) => s.status !== 'inactive')
      .filter(
        (s) =>
          !q ||
          String(s.roll).includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.nameEn || '').toLowerCase().includes(q) ||
          (s.guardianPhone || '').includes(q),
      )
      .map((s) => ({ s, due: calculateStudentTotalDue(s.id) }))
      .sort((a, b) => b.due - a.due || a.s.roll - b.s.roll);

    return (
      <div className="pt-1">
        <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-3">
          <SearchBar value={query} onChange={setQuery} placeholder="রোল, নাম বা ফোন নম্বর" autoFocus />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={Users} title="কাউকে পাওয়া যায়নি" text="রোল নম্বর বা নাম আবার দেখুন" />
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map(({ s, due }) => (
              <button key={s.id} type="button" onClick={() => pick(s)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
                <RollBadge roll={s.roll} seed={s.id} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold text-ink">{s.name}</p>
                  <p className="text-[13px] text-slate-500">
                    {studentTags(s) || s.guardianPhone}
                  </p>
                </div>
                {due > 0 ? <Badge tone="red">{taka(due)} বাকি</Badge> : <Badge tone="green">পরিশোধিত</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const totalDue = calculateStudentTotalDue(student.id);
  const items = [
    { k: 'fine', label: ctx.activeFines.length > 1 ? `জরিমানা (${ctx.activeFines.length}টি)` : 'জরিমানা', amt: ctx.fine },
    { k: 'exam', label: ctx.dueExam?.examName || 'পরীক্ষার ফি', amt: ctx.exam },
  ];

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
        <RollBadge roll={student.roll} seed={student.id} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-ink">{student.name}</p>
          <p className="text-[13px] text-slate-500">
            মোট বাকি <span className="font-semibold text-rose-600">{taka(totalDue)}</span>
          </p>
        </div>
        {!initialStudent && (
          <Button variant="secondary" size="xs" icon={ArrowLeftRight} onClick={() => setStudent(null)}>
            বদলান
          </Button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13.5px] font-semibold text-slate-700">কোন মাসের বেতন</p>
          {ctx.months.some((m) => !m.paid && !m.future && m.due > 0) && (
            <button type="button" onClick={allUnpaid} className="text-[13px] font-semibold text-brand-600">
              সব বাকি মাস
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ctx.months.map((m) => {
            const on = !!months?.has(m.key);
            return (
              <button
                key={m.key}
                type="button"
                disabled={m.paid}
                onClick={() => toggleMonth(m.key)}
                className={cx(
                  'press relative rounded-2xl px-2 py-2.5 text-center ring-1 ring-inset transition',
                  on ? 'bg-brand-600 text-white ring-brand-600' : m.paid ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-white ring-slate-200',
                )}
              >
                <span className={cx('block text-[14px] font-bold leading-tight', on ? 'text-white' : m.paid ? 'text-emerald-700' : 'text-ink')}>{monthBn(m.month)}</span>
                <span className={cx('tabular block text-[11.5px]', on ? 'text-white/80' : 'text-slate-500')}>
                  {m.paid ? '✓ পরিশোধিত' : `${taka(m.due)}${m.row?.fine ? '*' : ''}`}
                </span>
                {!m.paid && !on && m.row && (m.past || m.current || Number(m.row.paid) > 0) && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
                {!m.paid && (() => {
                  const partial = Number(m.row?.paid) > 0;
                  const [text, tone] = partial ? ['আংশিক বাকি', 'text-rose-600'] : m.current ? ['এই মাস', 'text-brand-600'] : m.future ? ['অগ্রিম', 'text-amber-600'] : [null];
                  return text && <span className={cx('block text-[10.5px] font-semibold', on ? 'text-white/80' : tone)}>{text}</span>;
                })()}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          {chosen.length ? `${chosen.length} মাস · ${taka(monthly)}` : 'কোনো মাস বাছা হয়নি'} · লাল বিন্দু = বকেয়া
          {ctx.months.some((m) => m.row?.fine) ? ' · * জরিমানাসহ' : ''}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">অন্যান্য</p>
        <div className="space-y-2">
          {items.map((it) => {
            const disabled = it.amt <= 0;
            const on = sel[it.k] && !disabled;
            return (
              <button
                key={it.k}
                type="button"
                disabled={disabled}
                onClick={() => toggle(it.k)}
                className={cx(
                  'press flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 ring-inset transition',
                  on ? 'bg-brand-50/70 ring-brand-300' : 'bg-white ring-slate-200',
                  disabled && 'opacity-50',
                )}
              >
                <Checkbox checked={on} />
                <span className="flex-1 text-[15px] font-semibold text-ink">{it.label}</span>
                <span className={cx('tabular text-[15px] font-bold', disabled ? 'text-slate-400' : 'text-ink')}>
                  {disabled ? 'বাকি নেই' : taka(it.amt)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-[13px] text-white/60">মোট গ্রহণ করছেন</p>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[30px] font-extrabold text-white/50">৳</span>
          <input
            type="number"
            inputMode="numeric"
            value={total || ''}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
            className="tabular w-full min-w-0 bg-transparent text-[36px] font-extrabold tracking-tight text-white outline-none placeholder:text-white/30 max-[374px]:text-[30px]"
          />
        </div>
        {amount != null && amount !== autoTotal && (
          <button type="button" onClick={() => setAmount(null)} className="mt-1 text-[13px] font-semibold text-brand-300">
            নির্বাচিত হিসাবে ফেরত যান ({taka(autoTotal)})
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">পেমেন্ট মাধ্যম</p>
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cx(
                'press flex flex-col items-center gap-1.5 rounded-2xl py-3 ring-1 ring-inset max-[374px]:py-2.5',
                method === m.id ? 'bg-white ring-2 ring-brand-500' : 'bg-white ring-slate-200',
              )}
            >
              <span className={cx('h-3 w-3 rounded-full', m.color)} />
              <span className="text-[13.5px] font-semibold text-ink max-[374px]:text-[12.5px]">{m.id}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {method !== 'Cash' && (
          <Field label="ট্রানজেকশন আইডি" className="col-span-2">
            <Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="যেমন BK98234..." className="uppercase" />
          </Field>
        )}
        <Field label="তারিখ" className="col-span-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 bg-white/95 px-5 pb-1 pt-3 backdrop-blur">
        <Button variant="success" size="lg" block disabled={total <= 0 || saving} onClick={submit}>
          {saving ? 'সংরক্ষণ হচ্ছে…' : `${taka(total)} গ্রহণ করুন`}
        </Button>
      </div>
    </div>
  );
}
