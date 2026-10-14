import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell, Search, UserPlus, CalendarCheck, TriangleAlert, ChartColumn, ArrowRight, ReceiptText, Users, Wallet,
  ChevronRight, ShieldAlert, BellRing, ClipboardList, CheckCircle2, CreditCard, Phone, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Card, IconButton, Avatar, RollBadge, Badge, Button, SectionTitle, Sheet, SearchBar, EmptyState, cx } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { AbsenteeSheet } from '../components/AbsenteeSheet';
import { MonthHistory } from '../components/MonthHistory';
import { MonthHero } from '../components/MonthHero';
import { TodoCard } from '../components/TodoCard';
import { taka, monthBn, fmtDate, dayNameBn, greetingBn, todayISO, studentTags, feeStatus, shiftISODate, waLink } from '../lib/format';

export const AdminDashboard = () => {
  const {
    students, totalStudentsCount, activeStudentsCount, totalDueAcrossAll,
    attendance, payments, settings, fees, examFees, setActiveTab, getStudentAttendanceStats, profile, classId,
  } = useApp();
  const { openWhatsApp, openReceipt, openStudentForm, openDayClose } = useUI();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [absentSheetOpen, setAbsentSheetOpen] = useState(false);

  const [waTick, setWaTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setWaTick((t) => t + 1);
    window.addEventListener('absent_wa_sent_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('absent_wa_sent_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const today = todayISO();
  const dayOf = (p) => (p.paymentDate ? String(p.paymentDate).slice(0, 10) : '');
  const todayPayments = useMemo(
    () => payments.filter((p) => dayOf(p) === today && p.status !== 'void'),
    [payments, today],
  );
  const todayCollected = useMemo(
    () => todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [todayPayments],
  );

  const todayRecord = attendance[today];
  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  Object.values(todayRecord || {}).forEach((st) => {
    if (counts[st] != null) counts[st] += 1;
  });
  const attTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  const absentStudentsToday = useMemo(() => {
    if (!todayRecord) return [];
    return students.filter((s) => todayRecord[s.id] === 'Absent' && s.status !== 'inactive');
  }, [students, todayRecord]);

  const isAbsentMsgDoneToday = useMemo(() => {
    if (!absentStudentsToday.length) return false;
    let sentSet = new Set();
    try {
      const stored = localStorage.getItem(`absent_wa_sent_${classId || 'default'}_${today}`);
      if (stored) sentSet = new Set(JSON.parse(stored));
    } catch {}
    const reachable = absentStudentsToday.filter((s) => s.guardianPhone);
    return reachable.length === 0 || reachable.every((s) => sentSet.has(s.id));
  }, [absentStudentsToday, classId, today, waTick]);

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
      title: `${lowAttendance.length} জনের হাজিরা 75% এর কম`,
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
      <div className="flex items-center gap-3.5 pb-4 pt-5 md:pt-7">
        <span className="shrink-0 rounded-full p-[3px] ring-2 ring-brand-200 ring-offset-2 ring-offset-canvas">
          <Avatar name={profile?.name || settings.inchargeName} seed={profile?.uid || 'incharge'} size={50} rounded="rounded-full" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-brand-600">{greetingBn()}</p>
          <p className="truncate text-[20px] font-extrabold leading-tight tracking-tight text-ink">{profile?.name || settings.inchargeName}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
            {dayNameBn(today)}, {fmtDate(today, { year: false })}
            {settings.className ? ` · ${settings.className}` : ''}
          </p>
        </div>
        <IconButton icon={Bell} label="নোটিফিকেশন" badge={notifications.length || null} onClick={() => setNotifOpen(true)} className="ring-1 ring-slate-100" />
      </div>

      {/* Quick Search */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="press flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[14.5px] text-slate-400 shadow-card transition hover:bg-slate-50/70"
      >
        <Search className="h-5 w-5 text-slate-400" />
        <span className="flex-1">রোল, নাম বা ফোন দিয়ে খুঁজুন</span>
      </button>

      {/* Today's cash in hand */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-emerald-50/80 p-3 ring-1 ring-emerald-200/70 shadow-card">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-700/25">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-950">
            আজকের ক্যাশ
            <span className="rounded bg-emerald-100 px-1.5 py-px text-[10.5px] font-semibold text-emerald-800">{dayNameBn(today)}</span>
          </p>
          <p className="tabular flex flex-wrap items-baseline gap-x-2 text-[12px] text-emerald-700">
            <span className="text-[19px] font-extrabold leading-tight text-emerald-950">{taka(todayCollected)}</span>
            <span>{todayPayments.length > 0 ? `${todayPayments.length}টি রশিদ` : 'এখনো কোনো আদায় হয়নি'}</span>
          </p>
        </div>
        <Button variant={todayPayments.length > 0 ? 'success' : 'secondary'} size="xs" className="shrink-0" onClick={() => openDayClose(today)}>
          দিনের হিসাব
        </Button>
      </div>

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-5">
      <div>
      {/* Collection: one card per month, swipe for earlier / advance months */}
      <MonthHero />

      {/* What needs doing today */}
      <TodoCard onAbsent={() => setAbsentSheetOpen(true)} />

      {/* Quick actions */}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[
          { label: 'হাজিরা', icon: CalendarCheck, cls: 'bg-emerald-50 text-emerald-600', onClick: () => setActiveTab('attendance') },
          { label: 'নতুন ভর্তি', icon: UserPlus, cls: 'bg-brand-50 text-brand-600', onClick: () => openStudentForm() },
          { label: 'বকেয়া', icon: Wallet, cls: 'bg-rose-50 text-rose-600', onClick: () => setActiveTab('due') },
          { label: 'রিপোর্ট', icon: ChartColumn, cls: 'bg-sky-50 text-sky-600', onClick: () => setActiveTab('reports') },
        ].map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} className="press flex flex-col items-center gap-1.5 rounded-3xl bg-white py-3.5 shadow-card max-[374px]:rounded-2xl max-[374px]:py-3">
            <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', a.cls)}>
              <a.icon className="h-[22px] w-[22px]" />
            </span>
            <span className="text-[12.5px] font-semibold text-slate-700 max-[374px]:text-[11.5px]">{a.label}</span>
          </button>
        ))}
      </div>

      <MonthHistory />

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
            {counts.Absent > 0 && (
              <div className="mt-3.5 border-t border-slate-100 pt-3">
                <Button
                  block
                  size="sm"
                  variant={isAbsentMsgDoneToday ? 'soft-success' : 'soft-danger'}
                  icon={isAbsentMsgDoneToday ? Check : WhatsAppIcon}
                  className="h-auto min-h-10 py-2.5 px-3 whitespace-normal text-center leading-snug"
                  onClick={() => setAbsentSheetOpen(true)}
                >
                  {isAbsentMsgDoneToday
                    ? 'মেসেজ পাঠানো সম্পন্ন'
                    : `অনুপস্থিত ${counts.Absent} জনকে WhatsApp নোটিফিকেশন পাঠান`}
                </Button>
              </div>
            )}
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
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className="press flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center ring-1 ring-slate-200/80 shadow-card transition hover:shadow-md"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Users className="h-5 w-5" />
          </span>
          <p className="tabular mt-2.5 text-[24px] font-extrabold leading-tight text-ink">{totalStudentsCount}</p>
          <p className="mt-1 text-[12px] font-medium text-slate-500">মোট শিক্ষার্থী · {activeStudentsCount} সক্রিয়</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('due')}
          className="press flex flex-col items-center justify-center rounded-3xl bg-white p-4 text-center ring-1 ring-slate-200/80 shadow-card transition hover:shadow-md"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <Wallet className="h-5 w-5" />
          </span>
          <p className="tabular mt-2.5 text-[24px] font-extrabold leading-tight text-rose-600 max-[374px]:text-[20px]">
            {taka(totalDueAcrossAll)}
          </p>
          <p className="mt-1 text-[12px] font-medium text-slate-500">মোট বকেয়া (সব মিলিয়ে)</p>
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

      <AbsenteeSheet
        open={absentSheetOpen}
        onClose={() => setAbsentSheetOpen(false)}
        date={today}
        absentStudents={absentStudentsToday}
      />

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
  const { openStudent, openPayment, toast } = useUI();
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
          (s.guardianPhone || '').includes(t) ||
          (s.studentPhone || '').includes(t),
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

      <div className="space-y-3 pt-1">
        {results.map((s) => {
          const due = calculateStudentTotalDue(s.id);
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl bg-white shadow-card transition"
            >
              {/* Student Header & Info (tap to view profile) */}
              <div
                onClick={() => {
                  onClose();
                  setTimeout(() => openStudent(s), 80);
                }}
                className="flex cursor-pointer items-center gap-3 p-3.5 transition active:bg-slate-50/70"
              >
                <RollBadge roll={s.roll} seed={s.id} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-bold text-ink">
                    {s.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                    {[studentTags(s), s.guardianPhone || s.studentPhone].filter(Boolean).join(' · ') || 'তথ্য নেই'}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {due > 0 ? (
                    <Badge tone="red">{taka(due)}</Badge>
                  ) : (
                    <Badge tone="green">পরিশোধিত</Badge>
                  )}
                </div>
              </div>

              {/* Bottom action bar */}
              {(() => {
                const phone = s.guardianPhone || s.studentPhone;
                return (
                  <div className="flex items-center border-t border-slate-100 bg-slate-50/60 divide-x divide-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        setTimeout(() => openPayment(s), 80);
                      }}
                      className="press flex h-10 flex-1 items-center justify-center gap-1.5 text-[13.5px] font-bold text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition"
                    >
                      <CreditCard className="h-4 w-4" /> টাকা আদায়
                    </button>

                    <a
                      href={phone ? `tel:${phone}` : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!phone) {
                          e.preventDefault();
                          toast('মোবাইল নম্বর দেওয়া নেই', 'error');
                        }
                      }}
                      title={s.guardianPhone ? 'অভিভাবককে কল করুন' : 'শিক্ষার্থীকে কল করুন'}
                      className={cx(
                        'press flex h-10 w-12 shrink-0 items-center justify-center transition',
                        phone ? 'text-sky-600 hover:bg-sky-50 active:bg-sky-100' : 'text-slate-300 pointer-events-none',
                      )}
                    >
                      <Phone className="h-[18px] w-[18px]" />
                    </a>

                    <a
                      href={phone ? waLink(phone) : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!phone) {
                          e.preventDefault();
                          toast('মোবাইল নম্বর দেওয়া নেই', 'error');
                        }
                      }}
                      title="WhatsApp"
                      className={cx(
                        'press flex h-10 w-12 shrink-0 items-center justify-center transition',
                        phone ? 'text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100' : 'text-slate-300 pointer-events-none',
                      )}
                    >
                      <WhatsAppIcon className="h-[18px] w-[18px]" />
                    </a>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
