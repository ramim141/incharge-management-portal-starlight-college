import React, { useMemo, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SelectPill, MultiSelectPill, Card, Badge, Button, Progress, RollBadge, cx } from '../components/ui';
import { taka, monthBn, studentTags, fmtDate, todayISO, feeBadge, feeStatus, METHODS, downloadCSV } from '../lib/format';
import { periodOf } from '../lib/classLogic';
import { YearSummary } from '../components/YearSummary';
import { yearSummary, availableSessions, sessionStartOf, sessionLabel } from '../lib/summary';

export const ReportsView = () => {
  const { students, fees, fines, payments, attendance, settings, getStudentAttendanceStats, feeMonths, feeStartMonth, examFees } = useApp();
  const { toast, openStudent } = useUI();
  const [type, setType] = useState('sheet');
  const nowD = new Date();
  const currentSession = sessionStartOf(nowD.getFullYear(), nowD.getMonth());
  const [session, setSession] = useState(currentSession);
  const sessions = useMemo(() => availableSessions({ fees, payments, attendance, current: currentSession }), [fees, payments, attendance, currentSession]);
  const ys = useMemo(() => yearSummary({ fees, payments, attendance, fines, startYear: session }), [fees, payments, attendance, fines, session]);
  const [picked, setPicked] = useState([]); // periods like 2026-03; empty = all months (sheet) / this month (monthly)

  // Every month that has a fee column (fee start → this month, plus any month with a fee row)
  const currentPeriod = periodOf(settings.currentMonth, settings.currentYear);
  // Before the class's fee start (earlier months were taken at admission) the first fee month is the one to show
  const upto = feeStartMonth && feeStartMonth > currentPeriod ? feeStartMonth : currentPeriod;
  const monthList = (() => {
    const cols = new Map();
    feeMonths.filter((m) => m.period <= upto).forEach((m) => cols.set(m.period, { month: m.month, year: m.year }));
    fees.filter((f) => !f.beforeStart).forEach((f) => cols.set(periodOf(f.month, Number(f.year)), { month: f.month, year: Number(f.year) }));
    return [...cols.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, m]) => ({ period, ...m }));
  })();
  const valid = picked.filter((p) => monthList.some((m) => m.period === p));
  const isAll = type === 'sheet' && valid.length === 0;
  const effective = valid.length ? valid : type === 'monthly' ? [currentPeriod] : [];
  const selMonths = isAll ? monthList : monthList.filter((m) => effective.includes(m.period));
  const multi = selMonths.length > 1;
  const monthLabel = selMonths.length === 0 ? `${monthBn(settings.currentMonth)} ${settings.currentYear}` : selMonths.length <= 3 ? selMonths.map((m) => `${monthBn(m.month)} ${m.year}`).join(', ') : `${selMonths.length}টি মাস`;
  const rangeKey = selMonths.length ? `${selMonths[0].period}${multi ? `_to_${selMonths[selMonths.length - 1].period}` : ''}` : currentPeriod;

  // A month with no fee row yet (e.g. the coming November) is owed at the student's full rate, transport included
  const admittedOf = (s) => (feeStartMonth ? '' : String(s.admissionDate || '').slice(0, 7));
  const rateOf = (s) => Number(s.monthlyFee || settings.defaultMonthlyFee) || 0;
  const transportOf = (s) => (s.transport ? Number(s.transportFee) || 0 : 0);
  const virtualFee = (s, m) => {
    const amount = rateOf(s);
    return { id: `virtual-${s.id}-${m.period}`, studentId: s.id, roll: s.roll, month: m.month, year: m.year, amount, transport: transportOf(s), paid: 0, due: amount, fine: 0, status: 'Due', reason: '', note: '', virtual: true };
  };
  const feeCell = (s, m, own) => {
    const row = own.find((f) => periodOf(f.month, Number(f.year)) === m.period);
    if (row) return row;
    if (m.period > upto || s.status === 'inactive') return null;
    if (admittedOf(s) && m.period < admittedOf(s)) return null;
    return virtualFee(s, m);
  };

  const monthFees = [
    ...fees.filter((f) => selMonths.some((m) => m.period === periodOf(f.month, Number(f.year)))),
    ...students.flatMap((s) => {
      const own = fees.filter((f) => f.studentId === s.id);
      return selMonths.map((m) => (own.some((f) => periodOf(f.month, Number(f.year)) === m.period) ? null : feeCell(s, m, own))).filter(Boolean);
    }),
  ]
    .map((f) => ({ f, s: students.find((x) => x.id === f.studentId || x.roll === Number(f.roll)), st: feeStatus(f) }))
    .sort((a, b) => Number(a.f.roll) - Number(b.f.roll) || periodOf(a.f.month, Number(a.f.year)).localeCompare(periodOf(b.f.month, Number(b.f.year))));
  const expected = monthFees.reduce((a, { f }) => a + Number(f.amount || 0) + Number(f.fine || 0), 0);
  const collected = monthFees.reduce((a, { f }) => a + Number(f.paid || 0), 0);
  const outstanding = monthFees.reduce((a, { f }) => a + Number(f.due || 0), 0);
  const paidN = monthFees.filter((x) => x.st === 'Paid').length;

  const byMethod = METHODS.map((m) => ({
    ...m,
    total: payments.filter((p) => p.method === m.id).reduce((a, p) => a + Number(p.amount), 0),
  }));
  const methodMax = Math.max(1, ...byMethod.map((m) => m.total));

  // Dues per student: every unpaid fee month (earlier months taken at admission are never owed), with its
  // transport part shown separately, plus fines and exam fees
  const defaulters = students
    .filter((s) => s.status !== 'inactive')
    .map((s) => {
      const own = fees.filter((f) => f.studentId === s.id);
      const rows = [
        ...own.filter((f) => !f.beforeStart),
        ...monthList.filter((m) => !own.some((f) => periodOf(f.month, Number(f.year)) === m.period)).map((m) => feeCell(s, m, own)).filter(Boolean),
      ]
        .map((f) => {
          const due = Number(f.due || 0);
          const transport = Math.min(Number(f.transport ?? transportOf(s)) || 0, due);
          return { month: f.month, year: Number(f.year), due, transport, tuition: due - transport };
        })
        .filter((r) => r.due > 0)
        .sort((x, y) => periodOf(x.month, x.year).localeCompare(periodOf(y.month, y.year)));
      const other =
        fines.filter((f) => f.studentId === s.id).reduce((a, f) => a + Number(f.due || 0), 0) +
        (examFees || []).filter((e) => e.studentId === s.id && e.status === 'Due').reduce((a, e) => a + Number(e.due || 0), 0);
      return { s, rows, due: rows.reduce((a, r) => a + r.due, 0) + other };
    })
    .filter((x) => x.due > 0)
    .sort((a, b) => b.due - a.due);
  const lowAtt = students
    .map((s) => ({ s, st: getStudentAttendanceStats(s.id) }))
    .filter((x) => x.st.totalClasses > 0 && x.st.percentage < 75)
    .sort((a, b) => a.st.percentage - b.st.percentage);

  const fineRows = students
    .map((s) => {
      const list = fines.filter((f) => f.studentId === s.id);
      const sum = (k) => list.reduce((a, f) => a + Number(f[k] || 0), 0);
      return { s, count: list.length, absent: list.filter((f) => f.kind === 'absent').length, amount: sum('amount'), waived: sum('waived'), paid: sum('paid'), due: sum('due') };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.due - a.due || a.s.roll - b.s.roll);
  const fineTotal = (k) => fineRows.reduce((a, r) => a + r[k], 0);

  // Fee sheet: one row per student, one column per month (what was paid in that month)
  const sheet = (() => {
    const months = type === 'sheet' ? selMonths : monthList;
    const lateFine = (f) => Math.max(0, Number(f.fine || 0) - Number(f.fineWaived || 0));
    const rows = students
      .filter((s) => s.status !== 'inactive')
      .sort((a, b) => Number(a.roll) - Number(b.roll))
      .map((s) => {
        const own = fees.filter((f) => f.studentId === s.id);
        const transport = s.transport ? Number(s.transportFee) || 0 : 0;
        const tuition = Number(s.tuitionFee ?? (s.monthlyFee || settings.defaultMonthlyFee)) || 0;
        const cell = Object.fromEntries(monthList.map((m) => [m.period, feeCell(s, m, own)]).filter(([, f]) => f));
        const counted = months.map((m) => cell[m.period]).filter((f) => f && !f.beforeStart);
        return {
          s,
          tuition,
          transport,
          cell,
          fine: counted.reduce((a, f) => a + lateFine(f), 0),
          payable: counted.reduce((a, f) => a + Number(f.amount || 0) + lateFine(f), 0),
          paid: counted.reduce((a, f) => a + Number(f.paid || 0), 0),
          due: counted.reduce((a, f) => a + Number(f.due || 0), 0),
        };
      });
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    const monthTotals = Object.fromEntries(months.map((m) => [m.period, rows.reduce((a, r) => a + Number(r.cell[m.period]?.paid || 0), 0)]));
    return { months, rows, totals: { tuition: sum('tuition'), transport: sum('transport'), fine: sum('fine'), payable: sum('payable'), paid: sum('paid'), due: sum('due') }, monthTotals };
  })();

  // "নভেম্বর: বেতন ৳1,000 + পরিবহন ৳500" (transport only when the student has it)
  const dueText = (r, bn) =>
    bn
      ? `${monthBn(r.month)}: ${r.transport > 0 ? `বেতন ${taka(r.tuition)} + পরিবহন ${taka(r.transport)}` : taka(r.due)}`
      : `${r.month} ${r.year} ${r.transport > 0 ? `${r.tuition} + transport ${r.transport}` : r.due}`;

  const TITLES = {
    sheet: isAll ? 'ফি শিট — শিক্ষার্থী ও মাস অনুযায়ী' : `ফি শিট — ${monthLabel}`,
    fines: 'জরিমানার রিপোর্ট',
    monthly: `${monthLabel} ফি রিপোর্ট`,
    defaulters: 'বকেয়া শিক্ষার্থীর তালিকা',
    attendance: 'কম হাজিরার তালিকা (75% এর নিচে)',
    year: `বছরের সারাংশ — সেশন ${sessionLabel(session)}`,
  };

  const exportCSV = () => {
    if (type === 'year') {
      downloadCSV(
        `${settings.classCode}_Year_${ys.label}.csv`,
        ['Month', 'Target', 'Collected', 'Due', 'Collection %', 'Cash received', 'Class days', 'Absent marks', 'Attendance %', 'Fines', 'Fine amount'],
        [
          ...ys.months.map((m) => [`${m.month} ${m.year}`, m.target, m.collected, m.due, m.rate ?? '', m.cashIn, m.days, m.absent, m.attPct ?? '', m.fines, m.fineTotal]),
          ['Total', ys.totals.target, ys.totals.collected, ys.totals.due, ys.totals.rate ?? '', ys.totals.cashIn, ys.totals.days, ys.totals.absent, ys.totals.attPct ?? '', ys.totals.fines, ys.totals.fineTotal],
        ],
      );
    } else if (type === 'sheet') {
      downloadCSV(
        `${settings.classCode}_Fee_Sheet${isAll ? '' : `_${rangeKey}`}.csv`,
        ['Roll', 'Name', 'Monthly Fee', 'Transport Fee', ...sheet.months.map((m) => `${m.month} ${m.year}`), 'Fine', 'Total Payable', 'Total Paid', 'Due'],
        [
          ...sheet.rows.map((r) => [r.s.roll, r.s.name, r.tuition, r.transport, ...sheet.months.map((m) => (r.cell[m.period] ? (r.cell[m.period].beforeStart ? 'Admission' : r.cell[m.period].paid || 0) : '')), r.fine, r.payable, r.paid, r.due]),
          ['', 'Total', sheet.totals.tuition, sheet.totals.transport, ...sheet.months.map((m) => sheet.monthTotals[m.period]), sheet.totals.fine, sheet.totals.payable, sheet.totals.paid, sheet.totals.due],
        ],
      );
    } else if (type === 'monthly') {
      downloadCSV(
        `${rangeKey}_Fee_Report.csv`,
        ['Month', 'Roll', 'Name', 'Group', 'Monthly Fee', 'Fine', 'Paid', 'Due', 'Status', 'Reason', 'Note'],
        monthFees.map(({ f, s, st }) => [`${f.month} ${f.year}`, f.roll, s?.name, s?.group, f.amount, f.fine || 0, f.paid || 0, f.due || 0, st, f.reason || '', f.note || '']),
      );
    } else if (type === 'fines') {
      downloadCSV(
        `${settings.classCode}_Fine_Report.csv`,
        ['Roll', 'Name', 'Fines', 'Absence Fines', 'Total Fine', 'Waived', 'Paid', 'Due'],
        fineRows.map((r) => [r.s.roll, r.s.name, r.count, r.absent, r.amount, r.waived, r.paid, r.due]),
      );
    } else if (type === 'defaulters') {
      downloadCSV(`${settings.classCode}_Defaulters.csv`, ['Roll', 'Name', 'Group', 'Guardian Phone', 'Due Months', 'Total Due'], defaulters.map(({ s, due, rows }) => [s.roll, s.name, s.group, s.guardianPhone, rows.map(dueText).join('; '), due]));
    } else {
      downloadCSV(
        `${settings.classCode}_Low_Attendance.csv`,
        ['Roll', 'Name', 'Group', 'Classes', 'Present', 'Absent', 'Late', 'Leave', 'Attendance %'],
        lowAtt.map(({ s, st }) => [s.roll, s.name, s.group, st.totalClasses, st.present, st.absent, st.late, st.leave, st.percentage]),
      );
    }
    toast('Excel (CSV) ফাইল ডাউনলোড হয়েছে');
  };

  return (
    <div>
      <PageHeader title="রিপোর্ট" subtitle="হিসাব ও হাজিরার প্রতিবেদন">
        <SelectPill
          label="রিপোর্ট"
          value={type}
          onChange={setType}
          options={[
            { value: 'year', label: 'বছরের সারাংশ' },
            { value: 'sheet', label: 'ফি শিট' },
            { value: 'monthly', label: 'মাসিক ফি' },
            { value: 'defaulters', label: 'বকেয়া', count: defaulters.length },
            { value: 'attendance', label: 'কম হাজিরা', count: lowAtt.length },
            { value: 'fines', label: 'জরিমানা', count: fineRows.filter((r) => r.due > 0).length },
          ]}
        />
        {(type === 'sheet' || type === 'monthly') && (
          <MultiSelectPill
            label="মাস"
            value={type === 'sheet' ? valid : effective}
            onChange={(v) => setPicked(v)}
            allLabel={type === 'sheet' ? 'সব মাস' : undefined}
            options={[...monthList].reverse().map((m) => ({ value: m.period, label: `${monthBn(m.month)} ${m.year}` }))}
          />
        )}
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
          PDF / প্রিন্ট
        </Button>
        <Button variant="secondary" icon={Download} onClick={exportCSV}>
          Excel (CSV)
        </Button>
      </div>

      <div className="print-area space-y-4">
        <div className="print-only mb-4 border-b border-slate-300 pb-3 text-center">
          <p className="text-[18px] font-bold">{settings.institutionName}</p>
          <p className="text-[13px]">{settings.sectionName}</p>
          <p className="mt-1 text-[15px] font-bold">{TITLES[type]}</p>
          <p className="text-[12px]">তৈরির তারিখ: {fmtDate(todayISO())}</p>
        </div>

        {type === 'year' && <YearSummary ys={ys} sessions={sessions} session={session} onSession={setSession} currentPeriod={periodOf(settings.currentMonth, settings.currentYear)} />}

        {type === 'sheet' && (
          <>
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-slate-500">{TITLES.sheet}</p>
              <div className="mt-3 grid grid-cols-3 gap-y-4">
                <Kpi label="মোট প্রদেয়" value={taka(sheet.totals.payable)} />
                <Kpi label="মোট আদায়" value={taka(sheet.totals.paid)} cls="text-emerald-600" />
                <Kpi label="মোট বাকি" value={taka(sheet.totals.due)} cls="text-rose-600" />
              </div>
              <Progress value={sheet.totals.payable ? (sheet.totals.paid / sheet.totals.payable) * 100 : 0} className="mt-4" />
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tabular w-max min-w-full border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr className="text-[11.5px] font-bold text-slate-500">
                      <Th sticky="left-0 w-11 min-w-[2.75rem]">রোল</Th>
                      <Th sticky="left-11 min-w-[8.5rem]" left>নাম</Th>
                      <Th>মাসিক ফি</Th>
                      <Th>পরিবহন</Th>
                      {sheet.months.map((m) => (
                        <Th key={m.period}>
                          {monthBn(m.month)}
                          <span className="block text-[10.5px] font-medium text-slate-400">{m.year}</span>
                        </Th>
                      ))}
                      {sheet.totals.fine > 0 && <Th>জরিমানা</Th>}
                      <Th strong>মোট প্রদেয়</Th>
                      <Th strong>মোট আদায়</Th>
                      <Th strong>বাকি</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((r) => (
                      <tr key={r.s.id}>
                        <Td sticky="left-0 w-11 min-w-[2.75rem]" cls="font-bold text-slate-400">{r.s.roll}</Td>
                        <Td sticky="left-11 min-w-[8.5rem]" left>
                          <button type="button" onClick={() => openStudent(r.s)} className="max-w-[9.5rem] truncate text-left font-semibold text-ink">
                            {r.s.name}
                          </button>
                        </Td>
                        <Td>{taka(r.tuition)}</Td>
                        <Td>{r.transport ? taka(r.transport) : <span className="text-slate-300">—</span>}</Td>
                        {sheet.months.map((m) => {
                          const f = r.cell[m.period];
                          if (!f) return <Td key={m.period}><span className="text-slate-300">—</span></Td>;
                          if (f.beforeStart) return <Td key={m.period}><span className="text-[11px] text-slate-400">ভর্তিতে</span></Td>;
                          const paid = Number(f.paid || 0);
                          const full = Number(f.due || 0) <= 0;
                          return (
                            <Td key={m.period}>
                              <span className={cx('font-bold', full ? 'text-emerald-600' : paid > 0 ? 'text-amber-600' : 'text-rose-500')}>{paid > 0 ? taka(paid) : '০'}</span>
                            </Td>
                          );
                        })}
                        {sheet.totals.fine > 0 && <Td>{r.fine ? taka(r.fine) : <span className="text-slate-300">—</span>}</Td>}
                        <Td strong>{taka(r.payable)}</Td>
                        <Td strong cls="text-emerald-600">{taka(r.paid)}</Td>
                        <Td strong cls={r.due > 0 ? 'text-rose-600' : 'text-emerald-600'}>{r.due > 0 ? taka(r.due) : '✓'}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-extrabold text-ink">
                      <Td sticky="left-0 w-11 min-w-[2.75rem]" foot />
                      <Td sticky="left-11 min-w-[8.5rem]" left foot>মোট</Td>
                      <Td foot>{taka(sheet.totals.tuition)}</Td>
                      <Td foot>{taka(sheet.totals.transport)}</Td>
                      {sheet.months.map((m) => (
                        <Td key={m.period} foot>{taka(sheet.monthTotals[m.period])}</Td>
                      ))}
                      {sheet.totals.fine > 0 && <Td foot>{taka(sheet.totals.fine)}</Td>}
                      <Td foot>{taka(sheet.totals.payable)}</Td>
                      <Td foot cls="text-emerald-600">{taka(sheet.totals.paid)}</Td>
                      <Td foot cls="text-rose-600">{taka(sheet.totals.due)}</Td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
            <p className="px-1 text-[12px] leading-relaxed text-slate-500">
              মাসের ঘরে সেই মাসে যত টাকা দিয়েছে তা দেখাচ্ছে। <b className="text-emerald-600">সবুজ</b> = পুরো পরিশোধ, <b className="text-amber-600">হলুদ</b> = আংশিক, <b className="text-rose-500">লাল ০</b> = কিছুই দেয়নি।
              মোট প্রদেয়তে মাসিক ফি, পরিবহন ও (থাকলে) জরিমানা ধরা হয়েছে।
            </p>
          </>
        )}

        {type === 'fines' && (
          <>
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-slate-500">{TITLES.fines}</p>
              <div className="mt-3 grid grid-cols-2 gap-y-4">
                <Kpi label="মোট জরিমানা" value={taka(fineTotal('amount'))} />
                <Kpi label="মওকুফ" value={taka(fineTotal('waived'))} cls="text-slate-500" />
                <Kpi label="আদায়" value={taka(fineTotal('paid'))} cls="text-emerald-600" />
                <Kpi label="বাকি" value={taka(fineTotal('due'))} cls="text-rose-600" />
              </div>
            </Card>
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {fineRows.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-slate-400">কোনো জরিমানা নেই</p>}
              {fineRows.map((r) => (
                <button key={r.s.id} type="button" onClick={() => openStudent(r.s)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <RollBadge roll={r.s.roll} seed={r.s.id} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{r.s.name}</span>
                    <span className="tabular block truncate text-[12px] text-slate-500">
                      {r.count}টি{r.absent ? ` (অনুপস্থিতি ${r.absent})` : ''} · মোট {taka(r.amount)}
                      {r.waived ? ` · মওকুফ ${taka(r.waived)}` : ''}
                    </span>
                  </span>
                  <span className={cx('tabular text-[14px] font-bold', r.due > 0 ? 'text-rose-600' : 'text-emerald-600')}>{r.due > 0 ? taka(r.due) : 'পরিশোধিত'}</span>
                </button>
              ))}
            </Card>
          </>
        )}

        {type === 'monthly' && (
          <>
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-slate-500">{TITLES.monthly}</p>
              <div className="mt-3 grid grid-cols-3 gap-y-4">
                <Kpi label={multi ? 'মোট ফি-এর ঘর' : 'মোট শিক্ষার্থী'} value={multi ? monthFees.length : students.length} />
                <Kpi label="পরিশোধিত" value={paidN} cls="text-emerald-600" />
                <Kpi label="বাকি" value={monthFees.length - paidN} cls="text-rose-600" />
                <Kpi label="প্রত্যাশিত" value={taka(expected)} />
                <Kpi label="আদায়" value={taka(collected)} cls="text-emerald-600" />
                <Kpi label="বকেয়া" value={taka(outstanding)} cls="text-rose-600" />
              </div>
              <Progress value={expected ? (collected / expected) * 100 : 0} className="mt-4" />
            </Card>

            <Card className="p-5">
              <p className="mb-3 text-[15px] font-bold text-ink">মাধ্যম অনুযায়ী আদায় (সব সময়)</p>
              <div className="space-y-3">
                {byMethod.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-14 text-[13.5px] font-semibold text-slate-600">{m.id}</span>
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                      <div className={cx('h-full rounded-lg', m.color)} style={{ width: `${(m.total / methodMax) * 100}%` }} />
                    </div>
                    <span className="tabular w-20 text-right text-[13.5px] font-bold text-ink">{taka(m.total)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="divide-y divide-slate-100 overflow-hidden">
              <p className="px-4 py-3 text-[15px] font-bold text-ink">শিক্ষার্থী অনুযায়ী</p>
              {monthFees.map(({ f, s, st }) => (
                <button key={f.id} type="button" onClick={() => s && openStudent(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="tabular min-w-[2.25rem] text-[13px] font-bold text-slate-400">{f.roll}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{s?.name}</span>
                    {multi && <span className="block truncate text-[12px] text-slate-500">{monthBn(f.month)} {f.year}</span>}
                    {f.reason && <span className="block truncate text-[12px] text-amber-700">{f.reason}</span>}
                  </span>
                  <span className="text-right">
                    <span className={cx('tabular block text-[14px] font-bold', Number(f.due) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {Number(f.due) > 0 ? taka(f.due) : taka(f.paid)}
                    </span>
                    <Badge tone={feeBadge(f, st).tone} className="mt-0.5">
                      {feeBadge(f, st).bn}
                    </Badge>
                  </span>
                </button>
              ))}
            </Card>
          </>
        )}

        {type === 'defaulters' && (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[15px] font-bold text-ink">{defaulters.length} জন</p>
              <p className="tabular text-[15px] font-extrabold text-rose-600">{taka(defaulters.reduce((a, x) => a + x.due, 0))}</p>
            </div>
            {defaulters.map(({ s, due, rows }) => (
              <button key={s.id} type="button" onClick={() => openStudent(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <RollBadge roll={s.roll} seed={s.id} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                  <span className="tabular block text-[12.5px] text-slate-500">
                    {[studentTags(s), s.guardianPhone].filter(Boolean).join(' · ')}
                  </span>
                  {rows.length > 0 && (
                    <span className="tabular block text-[12px] text-rose-500">{rows.map((r) => dueText(r, true)).join(' · ')}</span>
                  )}
                </span>
                <span className="tabular text-[15px] font-bold text-rose-600">{taka(due)}</span>
              </button>
            ))}
            {defaulters.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-slate-400">কোনো বকেয়া নেই 🎉</p>}
          </Card>
        )}

        {type === 'attendance' && (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {lowAtt.map(({ s, st }) => (
              <button key={s.id} type="button" onClick={() => openStudent(s)} className="w-full px-4 py-3 text-left">
                <div className="flex items-center gap-3">
                  <RollBadge roll={s.roll} seed={s.id} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                    <span className="tabular block text-[12.5px] text-slate-500">
                      উপস্থিত {st.present}/{st.totalClasses} · অনুপস্থিত {st.absent}
                    </span>
                  </span>
                  <Badge tone="red">{st.percentage}%</Badge>
                </div>
                <Progress value={st.percentage} tone="red" className="mt-2 h-1.5" />
              </button>
            ))}
            {lowAtt.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-slate-400">সবার হাজিরা 75% বা তার বেশি 🎉</p>}
          </Card>
        )}

        <div className="print-only mt-10 text-right text-[12px]">
          <p className="inline-block border-t border-slate-400 px-6 pt-1">{settings.inchargeName}</p>
          <p>ক্লাস ইনচার্জের স্বাক্ষর</p>
        </div>
      </div>
    </div>
  );
};

// Fee-sheet table cells; the roll + name columns stay pinned while the months scroll sideways
const Th = ({ children, sticky, left, strong }) => (
  <th className={cx('whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5', left ? 'text-left' : 'text-right', strong && 'text-ink', sticky && `sticky z-10 ${sticky}`)}>{children}</th>
);
const Td = ({ children, sticky, left, strong, foot, cls }) => (
  <td className={cx('whitespace-nowrap px-3 py-2.5', foot ? 'border-t border-slate-200 bg-slate-50' : 'border-b border-slate-100 bg-white', left ? 'text-left' : 'text-right', strong && 'font-bold', sticky && `sticky z-[1] ${sticky}`, cls)}>{children}</td>
);

const Kpi = ({ label, value, cls }) => (
  <div>
    <p className={cx('tabular text-[18px] font-extrabold text-ink', cls)}>{value}</p>
    <p className="text-[12px] text-slate-500">{label}</p>
  </div>
);
