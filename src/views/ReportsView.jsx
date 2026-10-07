import React, { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SelectPill, Card, Badge, Button, Progress, RollBadge, cx } from '../components/ui';
import { taka, monthBn, studentTags, fmtDate, todayISO, FEE_STATUS, feeStatus, METHODS, downloadCSV } from '../lib/format';

export const ReportsView = () => {
  const { students, fees, fines, payments, settings, getStudentAttendanceStats, calculateStudentTotalDue } = useApp();
  const { toast, openStudent } = useUI();
  const [type, setType] = useState('monthly');

  const monthFees = fees
    .filter((f) => f.month.toLowerCase() === settings.currentMonth.toLowerCase() && f.year === settings.currentYear)
    .map((f) => ({ f, s: students.find((x) => x.id === f.studentId || x.roll === Number(f.roll)), st: feeStatus(f) }))
    .sort((a, b) => Number(a.f.roll) - Number(b.f.roll));
  const expected = monthFees.reduce((a, { f }) => a + Number(f.amount || 0) + Number(f.fine || 0), 0);
  const collected = monthFees.reduce((a, { f }) => a + Number(f.paid || 0), 0);
  const outstanding = monthFees.reduce((a, { f }) => a + Number(f.due || 0), 0);
  const paidN = monthFees.filter((x) => x.st === 'Paid').length;

  const byMethod = METHODS.map((m) => ({
    ...m,
    total: payments.filter((p) => p.method === m.id).reduce((a, p) => a + Number(p.amount), 0),
  }));
  const methodMax = Math.max(1, ...byMethod.map((m) => m.total));

  const defaulters = students
    .map((s) => ({ s, due: calculateStudentTotalDue(s.id) }))
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

  const TITLES = {
    fines: 'জরিমানার রিপোর্ট',
    monthly: `${monthBn(settings.currentMonth)} ${settings.currentYear} ফি রিপোর্ট`,
    defaulters: 'বকেয়া শিক্ষার্থীর তালিকা',
    attendance: 'কম হাজিরার তালিকা (৭৫% এর নিচে)',
  };

  const exportCSV = () => {
    if (type === 'monthly') {
      downloadCSV(
        `${settings.currentMonth}_${settings.currentYear}_Fee_Report.csv`,
        ['Roll', 'Name', 'Group', 'Monthly Fee', 'Fine', 'Paid', 'Due', 'Status', 'Reason', 'Note'],
        monthFees.map(({ f, s, st }) => [f.roll, s?.name, s?.group, f.amount, f.fine || 0, f.paid || 0, f.due || 0, st, f.reason || '', f.note || '']),
      );
    } else if (type === 'fines') {
      downloadCSV(
        `${settings.classCode}_Fine_Report.csv`,
        ['Roll', 'Name', 'Fines', 'Absence Fines', 'Total Fine', 'Waived', 'Paid', 'Due'],
        fineRows.map((r) => [r.s.roll, r.s.name, r.count, r.absent, r.amount, r.waived, r.paid, r.due]),
      );
    } else if (type === 'defaulters') {
      downloadCSV(`${settings.classCode}_Defaulters.csv`, ['Roll', 'Name', 'Group', 'Guardian Phone', 'Total Due'], defaulters.map(({ s, due }) => [s.roll, s.name, s.group, s.guardianPhone, due]));
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
            { value: 'monthly', label: 'মাসিক ফি' },
            { value: 'defaulters', label: 'বকেয়া', count: defaulters.length },
            { value: 'attendance', label: 'কম হাজিরা', count: lowAtt.length },
            { value: 'fines', label: 'জরিমানা', count: fineRows.filter((r) => r.due > 0).length },
          ]}
        />
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
                <Kpi label="মোট শিক্ষার্থী" value={students.length} />
                <Kpi label="পরিশোধিত" value={paidN} cls="text-emerald-600" />
                <Kpi label="বাকি" value={monthFees.length - paidN} cls="text-rose-600" />
                <Kpi label="প্রত্যাশিত" value={taka(expected)} />
                <Kpi label="আদায়" value={taka(collected)} cls="text-emerald-600" />
                <Kpi label="বকেয়া" value={taka(outstanding)} cls="text-rose-600" />
              </div>
              <Progress value={expected ? (collected / expected) * 100 : 0} className="mt-4" />
            </Card>

            <Card className="p-5">
              <p className="mb-3 text-[15px] font-bold text-ink">মাধ্যম অনুযায়ী আদায়</p>
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
                    {f.reason && <span className="block truncate text-[12px] text-amber-700">{f.reason}</span>}
                  </span>
                  <span className="text-right">
                    <span className={cx('tabular block text-[14px] font-bold', Number(f.due) > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {Number(f.due) > 0 ? taka(f.due) : taka(f.paid)}
                    </span>
                    <Badge tone={FEE_STATUS[st]?.tone} className="mt-0.5">
                      {FEE_STATUS[st]?.bn}
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
            {defaulters.map(({ s, due }) => (
              <button key={s.id} type="button" onClick={() => openStudent(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <RollBadge roll={s.roll} seed={s.id} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                  <span className="tabular block text-[12.5px] text-slate-500">
                    {[studentTags(s), s.guardianPhone].filter(Boolean).join(' · ')}
                  </span>
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
            {lowAtt.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-slate-400">সবার হাজিরা ৭৫% বা তার বেশি 🎉</p>}
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

const Kpi = ({ label, value, cls }) => (
  <div>
    <p className={cx('tabular text-[18px] font-extrabold text-ink', cls)}>{value}</p>
    <p className="text-[12px] text-slate-500">{label}</p>
  </div>
);
