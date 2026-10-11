import React, { useMemo } from 'react';
import { BellRing, Clock3, CalendarCheck, UserX, Wallet, ClipboardList, Bus, Gavel, ShieldAlert, PhoneOff, ChevronRight, CheckCircle2, Lock, HardDriveDownload, CalendarOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Card, cx } from './ui';
import { monthBn, todayISO, shiftISODate, studentDueItems, taka } from '../lib/format';
import { dayCloseSummary } from '../lib/dayClose';
import { lastBackupAt, daysSince } from '../lib/backup';

const TONES = {
  red: { tile: 'bg-rose-50 text-rose-600', pill: 'bg-rose-50 text-rose-700' },
  amber: { tile: 'bg-amber-50 text-amber-600', pill: 'bg-amber-50 text-amber-700' },
  brand: { tile: 'bg-brand-50 text-brand-600', pill: 'bg-brand-50 text-brand-700' },
  green: { tile: 'bg-emerald-50 text-emerald-600', pill: 'bg-emerald-50 text-emerald-700' },
  slate: { tile: 'bg-slate-100 text-slate-600', pill: 'bg-slate-100 text-slate-600' },
};

/**
 * "আজকের কাজ": what needs doing right now, most urgent first. Every line is one tap away from
 * doing it — nothing to hunt for in the menus.
 */
export function TodoCard({ onAbsent }) {
  const {
    students, fees, fines, examFees, attendance, payments, closings, leaves, classId, settings, reminderQueue: q, missingFeeCount, generateMonthFees, setActiveTab, getStudentAttendanceStats,
  } = useApp();
  const { openWhatsApp, openDayClose, toast } = useUI();

  const items = useMemo(() => {
    const today = todayISO();
    const active = students.filter((s) => s.status !== 'inactive');
    const rec = attendance[today];
    const absentToday = rec ? active.filter((s) => rec[s.id] === 'Absent').length : 0;
    const isFriday = new Date().getDay() === 5; // weekly holiday: no attendance nudge
    const examTomorrow = [...new Set(examFees.filter((e) => e.status === 'Due' && e.deadline === shiftISODate(today, 1)).map((e) => e.examName))];
    const transport = active.filter((s) => studentDueItems(s.id, { fees }).some((i) => i.kind === 'transport'));
    const transportSum = transport.reduce((a, s) => a + studentDueItems(s.id, { fees }).filter((i) => i.kind === 'transport').reduce((x, i) => x + i.amount, 0), 0);
    const activeFines = fines.filter((f) => f.status === 'Active');
    const low = active.filter((s) => {
      const st = getStudentAttendanceStats(s.id);
      return st.totalClasses > 0 && st.percentage < 75;
    }).length;
    const noPhone = active.filter((s) => !s.guardianPhone).length;
    // Cash of the day: nothing to close on a day without receipts; a closed day whose money later changed needs closing again
    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    const backupAge = daysSince(lastBackupAt(classId));
    const day = dayCloseSummary(payments, today);
    const closed = closings[today];
    const closeStale = closed && (Number(closed.total) !== day.total || Number(closed.expectedCash) !== day.expectedCash);

    return [
      pendingLeaves > 0 && { id: 'leaves', tone: 'brand', icon: CalendarOff, title: `${pendingLeaves}টি ছুটির আবেদন অপেক্ষায়`, text: 'মঞ্জুর বা নামঞ্জুর করুন', act: 'দেখুন', go: () => setActiveTab('leaves') },
      day.count > 0 && (!closed || closeStale) && { id: 'close', tone: 'green', icon: Lock, title: closeStale ? 'ক্লোজের পর আজকের হিসাব বদলেছে' : 'আজকের ক্যাশ ক্লোজ করা হয়নি', text: `${day.count}টি রশিদ · ${taka(day.total)}`, act: 'ক্লোজ', go: () => openDayClose(today) },
      q.overdue.length > 0 && { id: 'overdue', tone: 'red', icon: BellRing, title: `${q.overdue.length} জনের শেষ তারিখ পার হয়েছে`, text: 'অভিভাবককে রিমাইন্ডার পাঠান', act: 'পাঠান', go: () => openWhatsApp(q.overdue) },
      q.upcoming.length > 0 && { id: 'upcoming', tone: 'amber', icon: Clock3, title: `${q.upcoming.length} জনের শেষ তারিখ ২ দিনের মধ্যে`, text: 'আগেভাগে মনে করিয়ে দিন', act: 'পাঠান', go: () => openWhatsApp(q.upcoming) },
      !rec && !isFriday && { id: 'att', tone: 'brand', icon: CalendarCheck, title: 'আজকের হাজিরা নেওয়া হয়নি', text: `${active.length} জন শিক্ষার্থী`, act: 'নিন', go: () => setActiveTab('attendance') },
      absentToday > 0 && { id: 'absent', tone: 'red', icon: UserX, title: `আজ ${absentToday} জন অনুপস্থিত`, text: 'অভিভাবককে জানান', act: 'জানান', go: onAbsent },
      missingFeeCount > 0 && {
        id: 'missing', tone: 'brand', icon: Wallet, title: `${monthBn(settings.currentMonth)} মাসের বেতন তৈরি হয়নি`, text: `${missingFeeCount} জন শিক্ষার্থী`, act: 'তৈরি করুন',
        go: async () => toast(`${await generateMonthFees()} জনের বেতন তৈরি হয়েছে`),
      },
      examTomorrow.length > 0 && { id: 'exam', tone: 'brand', icon: ClipboardList, title: `${examTomorrow[0]}${examTomorrow.length > 1 ? ` ও আরও ${examTomorrow.length - 1}টি` : ''} — ফি দেওয়ার শেষ দিন কাল`, text: 'পরীক্ষার ফি আদায়', act: 'দেখুন', go: () => setActiveTab('exams') },
      transport.length > 0 && { id: 'transport', tone: 'amber', icon: Bus, title: `${transport.length} জনের পরিবহন ফি বাকি`, text: `মোট ${taka(transportSum)}`, act: 'দেখুন', go: () => setActiveTab('due') },
      activeFines.length > 0 && { id: 'fines', tone: 'slate', icon: Gavel, title: `${activeFines.length}টি জরিমানা বাকি`, text: `মোট ${taka(activeFines.reduce((a, f) => a + Number(f.due || 0), 0))}`, act: 'দেখুন', go: () => setActiveTab('exams') },
      low > 0 && { id: 'low', tone: 'amber', icon: ShieldAlert, title: `${low} জনের হাজিরা 75% এর কম`, text: 'অভিভাবককে জানানো প্রয়োজন', act: 'দেখুন', go: () => setActiveTab('reports') },
      active.length > 0 && backupAge > 14 && { id: 'backup', tone: 'slate', icon: HardDriveDownload, title: backupAge === Infinity ? 'এখনো ব্যাকআপ নেওয়া হয়নি' : `${backupAge} দিন ধরে ব্যাকআপ নেওয়া হয়নি`, text: 'সব তথ্যের একটা কপি নামিয়ে রাখুন', act: 'নামান', go: () => setActiveTab('settings') },
      noPhone > 0 && { id: 'phone', tone: 'slate', icon: PhoneOff, title: `${noPhone} জনের অভিভাবকের ফোন নম্বর নেই`, text: 'রিমাইন্ডার পাঠাতে নম্বর লাগবে', act: 'দেখুন', go: () => setActiveTab('students') },
    ].filter(Boolean);
  }, [students, fees, fines, examFees, attendance, payments, closings, leaves, classId, openDayClose, settings.currentMonth, q, missingFeeCount, generateMonthFees, setActiveTab, getStudentAttendanceStats, openWhatsApp, onAbsent, toast]);

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h2 className="text-[17px] font-extrabold text-ink">আজকের কাজ</h2>
        {items.length > 0 && <span className="tabular rounded-full bg-brand-50 px-2.5 py-0.5 text-[12.5px] font-bold text-brand-700">{items.length}টি</span>}
      </div>
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-[15px] font-bold text-ink">সব কাজ শেষ</span>
              <span className="block text-[13px] text-slate-500">আজ আর কিছু বাকি নেই</span>
            </span>
          </div>
        ) : (
          <div className="stagger divide-y divide-slate-100">
            {items.map((it) => {
              const t = TONES[it.tone];
              return (
                <button key={it.id} type="button" onClick={it.go} className="press flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                  <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', t.tile)}>
                    <it.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold leading-snug text-ink">{it.title}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">{it.text}</span>
                  </span>
                  <span className={cx('flex shrink-0 items-center gap-0.5 rounded-full py-1 pl-3 pr-2 text-[12.5px] font-bold', t.pill)}>
                    {it.act}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
