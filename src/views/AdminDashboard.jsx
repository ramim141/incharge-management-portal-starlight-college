import React, { useMemo, useState } from 'react';
import {
  Bell, Search, UserPlus, CalendarCheck, TriangleAlert, ChartColumn, ArrowRight, ReceiptText, Users, Wallet,
  ChevronRight, ShieldAlert, BellRing, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Card, IconButton, Avatar, RollBadge, Badge, Button, Progress, SectionTitle, Sheet, SearchBar, EmptyState, cx } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { taka, monthBn, fmtDate, fmtTime, dayNameBn, greetingBn, todayISO, studentTags, feeStatus, shiftISODate } from '../lib/format';

export const AdminDashboard = () => {
  const {
    students, totalStudentsCount, activeStudentsCount, thisMonthCollection, thisMonthDue, totalDueAcrossAll,
    paidCount, attendance, payments, settings, fees, examFees, setActiveTab, getStudentAttendanceStats, missingFeeCount, generateMonthFees, profile,
  } = useApp();
  const { openWhatsApp, openReceipt, openStudentForm, toast } = useUI();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const today = todayISO();
  const todayRecord = attendance[today];
  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  Object.values(todayRecord || {}).forEach((st) => {
    if (counts[st] != null) counts[st] += 1;
  });
  const attTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  const monthFees = fees.filter((f) => f.month === settings.currentMonth && f.year === settings.currentYear);
  const overdueStudents = students.filter((s) => {
    const f = monthFees.find((x) => x.studentId === s.id);
    return f && feeStatus(f) === 'Overdue';
  });
  const pendingStudents = students.filter((s) => {
    const f = monthFees.find((x) => x.studentId === s.id);
    return f && feeStatus(f) !== 'Paid';
  });
  const lowAttendance = students.filter((s) => {
    const st = getStudentAttendanceStats(s.id);
    return st.totalClasses > 0 && st.percentage < 75;
  });

  const expected = thisMonthCollection + thisMonthDue;
  const pct = expected > 0 ? Math.round((thisMonthCollection / expected) * 100) : 0;

  const tomorrow = shiftISODate(today, 1);
  const examTomorrow = [...new Set(examFees.filter((e) => e.status === 'Due' && e.deadline === tomorrow).map((e) => e.examName))];

  const notifications = [
    overdueStudents.length > 0 && {
      id: 'overdue', tone: 'red', icon: TriangleAlert,
      title: `${overdueStudents.length} জন শিক্ষার্থী বেতনের সময়সীমা পার করেছে`,
      text: `${monthBn(settings.currentMonth)} মাসের বেতন দেওয়ার শেষ তারিখ ছিল ${settings.defaultFeeDeadlineDay} ${monthBn(settings.currentMonth)}`,
      action: () => openWhatsApp(overdueStudents), actionLabel: 'রিমাইন্ডার',
    },
    pendingStudents.length > 0 && {
      id: 'pending', tone: 'amber', icon: BellRing,
      title: `${pendingStudents.length} জনের ${monthBn(settings.currentMonth)} মাসের বেতন বাকি`,
      text: 'তালিকা দেখে একসাথে WhatsApp রিমাইন্ডার পাঠান',
      action: () => setActiveTab('due'), actionLabel: 'তালিকা',
    },
    lowAttendance.length > 0 && {
      id: 'low', tone: 'amber', icon: ShieldAlert,
      title: `${lowAttendance.length} জনের হাজিরা ৭৫% এর কম`,
      text: 'অভিভাবককে জানানো প্রয়োজন',
      action: () => setActiveTab('reports'), actionLabel: 'দেখুন',
    },
    ...examTomorrow.map((name) => ({
      id: `exam-${name}`, tone: 'brand', icon: ClipboardList,
      title: `${name} — ফি দেওয়ার শেষ দিন আগামীকাল`,
      action: () => setActiveTab('exams'), actionLabel: 'দেখুন',
    })),
  ].filter(Boolean);

  return (
    <div className="pt-safe">
      {/* Greeting */}
      <div className="flex items-center gap-3 pb-4 pt-5 md:pt-7">
        <Avatar name={profile?.name || settings.inchargeName} seed={profile?.uid || "incharge"} size={46} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-slate-500">
            {greetingBn()} · {dayNameBn(today)}, {fmtDate(today, { year: false })}
          </p>
          <p className="truncate text-[17px] font-extrabold text-ink">{profile?.name || settings.inchargeName}</p>
        </div>
        <IconButton icon={Bell} label="নোটিফিকেশন" badge={notifications.length || null} onClick={() => setNotifOpen(true)} />
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="press flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[15px] text-slate-400 ring-1 ring-slate-200/80 shadow-card"
      >
        <Search className="h-5 w-5" /> রোল, নাম বা ফোন দিয়ে খুঁজুন
      </button>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-5">
      <div>
      {/* Collection hero */}
      <div className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] font-semibold text-white/75">{monthBn(settings.currentMonth)} মাসের আদায়</p>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-bold">{pct}%</span>
          </div>
          <p className="tabular mt-1 text-[34px] font-extrabold leading-tight tracking-tight max-[374px]:text-[28px]">{taka(thisMonthCollection)}</p>
          <p className="tabular text-[13px] text-white/70">
            লক্ষ্য {taka(expected)} · বাকি {taka(thisMonthDue)}
          </p>
          <Progress value={pct} tone="white" track="bg-white/20" className="mt-3" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'পরিশোধিত', value: paidCount, to: 'fees' },
              { label: 'বাকি', value: pendingStudents.length - overdueStudents.length, to: 'due' },
              { label: 'মেয়াদোত্তীর্ণ', value: overdueStudents.length, to: 'due', hot: true },
            ].map((x) => (
              <button
                key={x.label}
                type="button"
                onClick={() => setActiveTab(x.to)}
                className="press rounded-2xl bg-white/10 px-3 py-2.5 text-left ring-1 ring-inset ring-white/10 max-[374px]:px-2.5"
              >
                <p className={cx('tabular text-[20px] font-extrabold', x.hot && x.value > 0 && 'text-rose-200')}>{x.value}</p>
                <p className="truncate text-[12px] text-white/70 max-[374px]:text-[11px]">{x.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {missingFeeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100 max-[374px]:p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold leading-snug text-ink">{monthBn(settings.currentMonth)} মাসের বেতন তৈরি হয়নি</p>
            <p className="text-[12.5px] text-slate-600">{missingFeeCount} জন শিক্ষার্থী</p>
          </div>
          <Button
            size="sm"
            className="max-[374px]:w-full"
            onClick={async () => {
              const n = await generateMonthFees();
              toast(`${n} জনের বেতন তৈরি হয়েছে`);
            }}
          >
            তৈরি করুন
          </Button>
        </div>
      )}

      {/* Deadline alert */}
      {overdueStudents.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-100 max-[374px]:p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-500 text-white">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold leading-snug text-rose-900">{overdueStudents.length} জন সময়সীমা পার করেছে</p>
            <p className="text-[12.5px] text-rose-700">এক ট্যাপে অভিভাবকদের জানান</p>
          </div>
          <Button variant="success" size="sm" className="max-[374px]:w-full" onClick={() => openWhatsApp(overdueStudents)}>
            <WhatsAppIcon className="h-4 w-4" /> পাঠান
          </Button>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[
          { label: 'হাজিরা', icon: CalendarCheck, cls: 'bg-emerald-50 text-emerald-600', onClick: () => setActiveTab('attendance') },
          { label: 'নতুন ভর্তি', icon: UserPlus, cls: 'bg-brand-50 text-brand-600', onClick: () => openStudentForm() },
          { label: 'বকেয়া', icon: Wallet, cls: 'bg-rose-50 text-rose-600', onClick: () => setActiveTab('due') },
          { label: 'রিপোর্ট', icon: ChartColumn, cls: 'bg-sky-50 text-sky-600', onClick: () => setActiveTab('reports') },
        ].map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} className="press flex flex-col items-center gap-1.5 rounded-3xl bg-white py-3.5 ring-1 ring-slate-200/70 shadow-card max-[374px]:rounded-2xl max-[374px]:py-3">
            <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', a.cls)}>
              <a.icon className="h-[22px] w-[22px]" />
            </span>
            <span className="text-[12.5px] font-semibold text-slate-700 max-[374px]:text-[11.5px]">{a.label}</span>
          </button>
        ))}
      </div>

      </div>

      <div className="md:-mt-2">
      {/* Today's attendance */}
      <SectionTitle title="আজকের হাজিরা" action={<LinkBtn onClick={() => setActiveTab('attendance')}>{todayRecord ? 'আপডেট' : 'নিন'}</LinkBtn>} />
      <Card className="p-4">
        {todayRecord ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="tabular text-[28px] font-extrabold leading-none text-ink">
                  {counts.Present + counts.Late}
                  <span className="text-[16px] font-semibold text-slate-400">/{attTotal}</span>
                </p>
                <p className="mt-1 text-[13px] text-slate-500">উপস্থিত (দেরি সহ)</p>
              </div>
              <Badge tone="green" dot>
                সংরক্ষিত
              </Badge>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
              {[
                ['Present', 'bg-emerald-500'],
                ['Late', 'bg-amber-400'],
                ['Leave', 'bg-sky-400'],
                ['Absent', 'bg-rose-500'],
              ].map(([k, c]) => (
                <div key={k} className={c} style={{ width: `${attTotal ? (counts[k] / attTotal) * 100 : 0}%` }} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 text-center text-[12.5px]">
              {[
                ['উপস্থিত', counts.Present, 'bg-emerald-500'],
                ['অনুপস্থিত', counts.Absent, 'bg-rose-500'],
                ['দেরি', counts.Late, 'bg-amber-400'],
                ['ছুটি', counts.Leave, 'bg-sky-400'],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <p className="tabular text-[16px] font-bold text-ink">{v}</p>
                  <p className="flex items-center justify-center gap-1 text-slate-500">
                    <span className={cx('h-2 w-2 rounded-full', c)} />
                    {k}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-ink">এখনো হাজিরা নেওয়া হয়নি</p>
              <p className="text-[13px] text-slate-500">{activeStudentsCount} জন শিক্ষার্থী</p>
            </div>
            <Button size="sm" onClick={() => setActiveTab('attendance')}>
              শুরু করুন
            </Button>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setActiveTab('students')} className="press rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/70 shadow-card">
          <Users className="h-5 w-5 text-brand-600" />
          <p className="tabular mt-3 text-[24px] font-extrabold text-ink">{totalStudentsCount}</p>
          <p className="text-[12.5px] text-slate-500">মোট শিক্ষার্থী · {activeStudentsCount} সক্রিয়</p>
        </button>
        <button type="button" onClick={() => setActiveTab('due')} className="press rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/70 shadow-card">
          <Wallet className="h-5 w-5 text-rose-500" />
          <p className="tabular mt-3 text-[24px] font-extrabold text-rose-600 max-[374px]:text-[20px]">{taka(totalDueAcrossAll)}</p>
          <p className="text-[12.5px] text-slate-500">মোট বকেয়া (সব মিলিয়ে)</p>
        </button>
      </div>

      {/* Recent payments */}
      <SectionTitle title="সাম্প্রতিক লেনদেন" action={<LinkBtn onClick={() => setActiveTab('payments')}>সব দেখুন</LinkBtn>} />
      <Card className="divide-y divide-slate-100 px-4">
        {payments.length === 0 && <p className="py-6 text-center text-[14px] text-slate-400">এখনো কোনো লেনদেন নেই</p>}
        {payments.slice(0, 5).map((p) => (
          <button key={p.id} type="button" onClick={() => openReceipt(p)} className="flex w-full items-center gap-3 py-3.5 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ReceiptText className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{p.studentName}</span>
              <span className="block text-[12.5px] text-slate-500">
                রোল {p.roll} · {fmtDate(p.paymentDate, { year: false })} · {p.method}
              </span>
            </span>
            <span className="tabular text-[15.5px] font-bold text-emerald-600">+{taka(p.amount)}</span>
          </button>
        ))}
      </Card>

      </div>
      </div>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Sheet open={notifOpen} onClose={() => setNotifOpen(false)} title="নোটিফিকেশন" subtitle={`${notifications.length}টি সতর্কবার্তা`}>
        {notifications.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="সব ঠিক আছে" text="এই মুহূর্তে কোনো সতর্কবার্তা নেই" />
        ) : (
          <div className="space-y-2.5 pt-1">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
                <span
                  className={cx(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
                    { red: 'bg-rose-100 text-rose-600', amber: 'bg-amber-100 text-amber-600', brand: 'bg-brand-100 text-brand-600' }[n.tone],
                  )}
                >
                  <n.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold leading-snug text-ink">{n.title}</p>
                  {n.text && <p className="mt-0.5 text-[12.5px] text-slate-500">{n.text}</p>}
                  <Button
                    variant="secondary"
                    size="xs"
                    className="mt-2.5"
                    onClick={() => {
                      setNotifOpen(false);
                      n.action();
                    }}
                  >
                    {n.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
};

const LinkBtn = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-0.5 text-[13.5px] font-semibold text-brand-600">
    {children}
    <ChevronRight className="h-4 w-4" />
  </button>
);

function SearchSheet({ open, onClose }) {
  const { students, calculateStudentTotalDue } = useApp();
  const { openStudent } = useUI();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return students
      .filter(
        (s) =>
          String(s.roll) === t ||
          String(s.roll).startsWith(t) ||
          s.name.toLowerCase().includes(t) ||
          (s.nameEn || '').toLowerCase().includes(t) ||
          (s.studentId || '').toLowerCase().includes(t) ||
          (s.guardianPhone || '').includes(t),
      )
      .slice(0, 30);
  }, [q, students]);

  return (
    <Sheet open={open} onClose={onClose} full title="খুঁজুন">
      <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-3">
        <SearchBar value={q} onChange={setQ} placeholder="রোল, নাম, আইডি বা ফোন" autoFocus />
      </div>
      {!q && <p className="py-10 text-center text-[14px] text-slate-400">যেমন: 105, Rahim, 0171…</p>}
      {q && results.length === 0 && <EmptyState icon={Search} title="কিছু পাওয়া যায়নি" text={`"${q}" এর সাথে মেলে এমন কেউ নেই`} />}
      <div className="divide-y divide-slate-100">
        {results.map((s) => {
          const due = calculateStudentTotalDue(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onClose();
                setTimeout(() => openStudent(s), 80);
              }}
              className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50"
            >
              <RollBadge roll={s.roll} seed={s.id} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-semibold text-ink">{s.name}</span>
                <span className="block text-[12.5px] text-slate-500">
                  {[studentTags(s), s.guardianPhone].filter(Boolean).join(' · ')}
                </span>
              </span>
              {due > 0 ? <Badge tone="red">{taka(due)}</Badge> : <Badge tone="green">✓</Badge>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
