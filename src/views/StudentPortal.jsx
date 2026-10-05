import React, { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, ShieldCheck, LogOut, Printer, Phone, CheckCircle2, AlertCircle, ReceiptText, ChevronRight,
  UserRound, Users, MapPin, Lock, ArrowRight, IdCard, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { AppContext, useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { backend } from '../backend';
import { ReceiptSheet } from '../components/ReceiptSheet';
import { Avatar, Badge, Button, Card, Ring, InfoRow, cx, CONTAINER, GUTTER, BLEED } from '../components/ui';
import { taka, monthBn, groupBn, fmtDate, feeStatus, ACADEMIC_MONTHS, EN_MONTHS } from '../lib/format';
import { portalKey, normalizeStudentId } from '../lib/hash';

const MAX_TRIES = 5;
const LOCK_KEY = 'xi_portal_lock';
const LAST_ID_KEY = 'xi_portal_last_id';

const readLock = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY)) || { tries: 0, until: 0 };
  } catch {
    return { tries: 0, until: 0 };
  }
};

/**
 * Students sign in with Student ID + PIN. The pair is hashed into the key of a read-only
 * record the in-charge's app keeps up to date, so a student can only ever open their own data.
 */
export const StudentPortal = ({ onStaffLogin }) => {
  const { institution } = useAuth();
  const [snap, setSnap] = useState(null);

  if (snap) return <PortalSession snap={snap} onExit={() => setSnap(null)} />;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="absolute inset-x-0 top-0 h-[52dvh] rounded-b-[48px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

      <div className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pb-8 pt-safe">
        <div className="mt-12 text-center text-white max-[374px]:mt-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <GraduationCap className="h-8 w-8" />
          </div>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-white/70">Student Portal</p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight max-[374px]:text-[23px]">শিক্ষার্থী তথ্য পোর্টাল</h1>
          {institution?.name && <p className="mx-auto mt-1.5 max-w-xs text-[14px] text-white/75">{institution.name}</p>}
        </div>

        <LoginCard onSuccess={setSnap} />

        <div className="mt-auto pt-8 text-center">
          <button type="button" onClick={onStaffLogin} className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 shadow-card">
            <Lock className="h-4 w-4 text-brand-600" /> শিক্ষক / অধ্যক্ষ লগইন
          </button>
        </div>
      </div>
    </div>
  );
};

function LoginCard({ onSuccess }) {
  const [sid, setSid] = useState(() => localStorage.getItem(LAST_ID_KEY) || '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(readLock);
  const [now, setNow] = useState(Date.now());
  const locked = lock.until > now;

  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [locked]);

  const saveLock = (l) => {
    setLock(l);
    localStorage.setItem(LOCK_KEY, JSON.stringify(l));
  };

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (locked || busy) return;
    const id = normalizeStudentId(sid);
    if (!id) return fail('স্টুডেন্ট আইডি লেখো');
    if (!/^\d{4,6}$/.test(pin)) return fail('৪ সংখ্যার পিন দাও');
    setBusy(true);
    try {
      const doc = await backend.getDoc(['portal', portalKey(id, pin)]);
      if (doc && doc.student) {
        saveLock({ tries: 0, until: 0 });
        localStorage.setItem(LAST_ID_KEY, id);
        setPin('');
        onSuccess(doc);
        return;
      }
      const tries = lock.tries + 1;
      setPin('');
      if (tries >= MAX_TRIES) {
        saveLock({ tries: 0, until: Date.now() + 60000 });
        setNow(Date.now());
        fail('অনেকবার ভুল হয়েছে। ১ মিনিট পর আবার চেষ্টা করো।');
      } else {
        saveLock({ tries, until: 0 });
        fail(`আইডি বা পিন মেলেনি। আর ${MAX_TRIES - tries} বার চেষ্টা করা যাবে।`);
      }
    } catch {
      fail('সংযোগে সমস্যা — ইন্টারনেট দেখে আবার চেষ্টা করো');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cx('mt-8 space-y-4 rounded-[28px] bg-white p-5 shadow-xl', shake && 'animate-shake')}>
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-slate-700">স্টুডেন্ট আইডি</span>
        <div className="relative">
          <IdCard className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={sid}
            onChange={(e) => {
              setSid(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="যেমন XI-2026-0105"
            autoCapitalize="characters"
            autoComplete="username"
            spellCheck={false}
            className="tabular h-14 w-full rounded-2xl bg-slate-50 pl-12 pr-4 text-[18px] font-bold tracking-wide text-ink outline-none ring-1 ring-inset ring-slate-200 transition placeholder:text-[15px] placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-slate-700">পিন</span>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            value={pin}
            disabled={locked}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="••••"
            className="tabular h-14 w-full rounded-2xl bg-slate-50 pl-12 pr-12 text-[22px] font-bold tracking-[0.4em] text-ink outline-none ring-1 ring-inset ring-slate-200 transition placeholder:tracking-[0.3em] placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-brand-500"
          />
          <button type="button" onClick={() => setShowPin((v) => !v)} aria-label="পিন দেখুন" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-slate-500">
            {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </label>

      {(error || locked) && (
        <p className="flex items-start gap-1.5 text-[13.5px] font-medium text-rose-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {locked ? `${Math.ceil((lock.until - now) / 1000)} সেকেন্ড অপেক্ষা করো` : error}
        </p>
      )}

      <Button type="submit" size="lg" block disabled={busy || locked || !sid || pin.length < 4}>
        {busy ? 'খোঁজা হচ্ছে…' : 'আমার তথ্য দেখো'}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-slate-400">
        <ShieldCheck className="h-4 w-4 shrink-0" /> আইডি ও পিন ক্লাস ইনচার্জের কাছ থেকে নাও
      </p>
    </form>
  );
}

/** Feeds the read-only portal record to the same profile + receipt screens staff use */
function PortalSession({ snap, onExit }) {
  const value = useMemo(() => {
    const s = snap.student;
    const now = new Date();
    const attendance = {};
    (snap.attLog || []).forEach((r) => {
      attendance[r.date] = { [s.id]: r.status };
    });
    return {
      userRole: 'student',
      students: [s],
      fees: snap.fees || [],
      examFees: snap.exams || [],
      fines: snap.fines || [],
      payments: snap.payments || [],
      attendance,
      settings: {
        ...snap.cls,
        className: snap.cls?.sectionName,
        currentMonth: EN_MONTHS[now.getMonth()],
        currentYear: now.getFullYear(),
      },
      getStudentAttendanceStats: () => snap.att || { totalClasses: 0, present: 0, absent: 0, late: 0, leave: 0, percentage: 100 },
      calculateStudentTotalDue: () => snap.totalDue || 0,
    };
  }, [snap]);

  return (
    <AppContext.Provider value={value}>
      <StudentProfile student={snap.student} onExit={onExit} />
      <ReceiptSheet />
    </AppContext.Provider>
  );
}

function StudentProfile({ student: s, onExit }) {
  const { fees, examFees, fines, payments, settings, getStudentAttendanceStats } = useApp();
  const { openReceipt } = useUI();

  const att = getStudentAttendanceStats(s.id);
  const sFees = useMemo(
    () =>
      fees
        .filter((f) => f.studentId === s.id)
        .sort((a, b) => a.year - b.year || ACADEMIC_MONTHS.indexOf(a.month) - ACADEMIC_MONTHS.indexOf(b.month)),
    [fees, s.id],
  );
  const sExams = examFees.filter((e) => e.studentId === s.id);
  const sPays = payments.filter((p) => p.studentId === s.id);

  // A fee row's "due" already includes its late fine; split it back out for the breakdown
  const feeFineDue = sFees.reduce((a, f) => a + Math.min(Number(f.fine || 0), Number(f.due || 0)), 0);
  const monthlyDue = sFees.reduce((a, f) => a + Number(f.due || 0), 0) - feeFineDue;
  const lateFine = feeFineDue + fines.filter((f) => f.studentId === s.id && f.status === 'Active').reduce((a, f) => a + Number(f.amount || 0), 0);
  const examDue = sExams.filter((e) => e.status === 'Due').reduce((a, e) => a + Number(e.due || 0), 0);
  const total = monthlyDue + lateFine + examDue;

  return (
    <div className="min-h-dvh bg-canvas">
      <div className={cx('mx-auto pb-10', CONTAINER, GUTTER)}>
        <div className={cx('no-print sticky top-0 z-20 flex items-center justify-between bg-canvas/95 pb-2 pt-safe backdrop-blur-xl', BLEED)}>
          <div className="flex h-14 items-center gap-2 text-[15px] font-bold text-ink">
            <GraduationCap className="h-5 w-5 text-brand-600" /> আমার প্রোফাইল
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()} aria-label="প্রিন্ট" className="w-10 px-0" />
            <Button variant="secondary" size="sm" icon={LogOut} onClick={onExit}>
              বের হও
            </Button>
          </div>
        </div>

        <div className="print-area space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift md:col-span-2">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <Avatar src={s.avatar} name={s.nameEn || s.name} seed={s.id} size={76} rounded="rounded-[24px]" className="ring-4 ring-white/20" />
              <div className="min-w-0 flex-1">
                <h1 className="text-[21px] font-extrabold leading-tight">{s.name}</h1>
                {s.nameEn && <p className="text-[13px] text-white/70">{s.nameEn}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold">রোল {s.roll}</span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold">{groupBn(s.group)}</span>
                </div>
              </div>
            </div>
            <div className="relative mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-[12.5px] text-white/75">
              <span className="tabular shrink-0 whitespace-nowrap">{s.studentId}</span>
              <span className="truncate pl-3">{settings.sectionName}</span>
            </div>
          </div>

          {total > 0 ? (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 bg-rose-50 px-5 py-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-500 text-white">
                  <AlertCircle className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-rose-700">মোট বকেয়া</p>
                  <p className="tabular text-[28px] font-extrabold leading-none text-rose-600 max-[374px]:text-[24px]">{taka(total)}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 px-5">
                {[
                  ['মাসিক বেতন', monthlyDue],
                  ['বিলম্ব জরিমানা', lateFine],
                  ['পরীক্ষার ফি', examDue],
                ]
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-3 text-[15px]">
                      <span className="text-slate-600">{k}</span>
                      <span className="tabular font-bold text-ink">{taka(v)}</span>
                    </div>
                  ))}
              </div>
              <p className="border-t border-slate-100 px-5 py-3 text-[13px] text-slate-500">
                প্রতি মাসের {settings.defaultFeeDeadlineDay} তারিখের মধ্যে বেতন দিতে হবে। বিকাশ/নগদ বা কলেজ অফিসে পরিশোধ করো।
              </p>
            </Card>
          ) : (
            <Card className="flex items-center gap-3 bg-emerald-50 p-5 ring-emerald-100">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div>
                <p className="text-[17px] font-extrabold text-emerald-800">সব ফি পরিশোধিত</p>
                <p className="text-[13.5px] text-emerald-700">কোনো বকেয়া নেই — ধন্যবাদ!</p>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Ring value={att.percentage} size={84} stroke={9} tone={att.percentage >= 75 ? 'green' : 'red'}>
                <span className="tabular text-[18px] font-extrabold text-ink">{Math.round(att.percentage)}%</span>
              </Ring>
              <div className="flex-1">
                <p className="text-[16px] font-bold text-ink">হাজিরা</p>
                <p className="text-[13px] text-slate-500">মোট {att.totalClasses} ক্লাসের মধ্যে</p>
                {att.percentage < 75 && att.totalClasses > 0 && (
                  <p className="mt-1 text-[12.5px] font-semibold text-rose-600">⚠ হাজিরা ৭৫% এর কম</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ['উপস্থিত', att.present, 'text-emerald-600'],
                ['অনুপস্থিত', att.absent, 'text-rose-600'],
                ['দেরি', att.late, 'text-amber-600'],
                ['ছুটি', att.leave, 'text-sky-600'],
              ].map(([k, v, c]) => (
                <div key={k} className="rounded-2xl bg-slate-50 py-2.5">
                  <p className={cx('tabular text-[19px] font-extrabold', c)}>{v}</p>
                  <p className="text-[12px] text-slate-500">{k}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-2 text-[16px] font-bold text-ink">মাসিক বেতন</p>
            <ol className="relative">
              {sFees.map((f, i) => {
                const paid = feeStatus(f) === 'Paid';
                return (
                  <li key={f.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < sFees.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-24px)] w-0.5 bg-slate-100" />}
                    <span className={cx('relative mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', paid ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600')}>
                      {paid ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[14px] font-extrabold">!</span>}
                    </span>
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <div>
                        <p className="text-[15px] font-semibold text-ink">
                          {monthBn(f.month)} {f.year}
                        </p>
                        <p className="tabular text-[12.5px] text-slate-500">
                          {taka(f.amount)}
                          {f.fine ? ` + জরিমানা ${taka(f.fine)}` : ''}
                        </p>
                      </div>
                      {paid ? (
                        <Badge tone="green">পরিশোধিত</Badge>
                      ) : (
                        <div className="text-right">
                          <Badge tone="red">বাকি</Badge>
                          <p className="tabular mt-1 text-[13px] font-bold text-rose-600">{taka(f.due)}</p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {sFees.length === 0 && <p className="text-[14px] text-slate-400">কোনো রেকর্ড নেই</p>}
            </ol>
          </Card>

          {sExams.length > 0 && (
            <Card className="p-5">
              <p className="mb-1 text-[16px] font-bold text-ink">পরীক্ষার ফি</p>
              <div className="divide-y divide-slate-100">
                {sExams.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">{e.examName}</p>
                      <p className="text-[12.5px] text-slate-500">{e.status === 'Paid' ? `পরিশোধ: ${fmtDate(e.paymentDate)}` : 'পরিশোধ বাকি'}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[15px] font-bold text-ink">{taka(e.amount)}</p>
                      <Badge tone={e.status === 'Paid' ? 'green' : 'red'}>{e.status === 'Paid' ? 'পরিশোধিত' : 'বাকি'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {sPays.length > 0 && (
            <Card className="no-print p-5">
              <p className="mb-1 text-[16px] font-bold text-ink">পেমেন্ট রশিদ</p>
              <div className="divide-y divide-slate-100">
                {sPays.map((p) => (
                  <button key={p.id} type="button" onClick={() => openReceipt(p)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                      <ReceiptText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold text-ink">{fmtDate(p.paymentDate)}</span>
                      <span className="tabular block text-[12.5px] text-slate-500">
                        {p.receiptNo} · {p.method}
                      </span>
                    </span>
                    <span className="tabular text-[15px] font-bold text-emerald-600">{taka(p.amount)}</span>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="px-5 py-2">
            <div className="divide-y divide-slate-100">
              <InfoRow icon={UserRound} label="পিতার নাম" value={s.fatherName} />
              <InfoRow icon={Users} label="মাতার নাম" value={s.motherName} />
              <InfoRow icon={Phone} label="অভিভাবকের ফোন" value={s.guardianPhone} mono />
              <InfoRow icon={MapPin} label="ঠিকানা" value={s.address} />
            </div>
          </Card>

          <a
            href={`tel:${settings.inchargePhone}`}
            className="no-print press flex items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200/70 shadow-card md:col-span-2"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Phone className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-slate-500">কোনো প্রশ্ন? ক্লাস ইনচার্জকে কল করো</span>
              <span className="block truncate text-[15px] font-bold text-ink">{settings.inchargeName}</span>
            </span>
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </a>
        </div>
      </div>
    </div>
  );
}
