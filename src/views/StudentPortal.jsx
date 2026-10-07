import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, LogOut, Phone, CheckCircle2, AlertCircle, ReceiptText, ChevronRight,
  UserRound, Users, MapPin, Lock, ArrowRight, Hash, School, ChevronLeft, KeyRound, Eye, EyeOff,
  LayoutGrid, Wallet, CalendarCheck, Gavel,
} from 'lucide-react';
import { AppContext, useApp, normalizeFine, studentIdFor } from '../context/AppContext';
import { CLASS_INDEX_PATH } from '../lib/classIndex';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { backend } from '../backend';
import { ReceiptSheet } from '../components/ReceiptSheet';
import { RollBadge, Badge, Button, Card, Ring, InfoRow, Sheet, Logo, cx, CONTAINER, GUTTER, BLEED } from '../components/ui';
import {
  taka, monthBn, groupBn, fmtDate, feeStatus, ACADEMIC_MONTHS, EN_MONTHS, BN_MONTHS, FINE_STATUS, ATT_STATUS, ATT_ORDER, todayISO, dayNameBn,
} from '../lib/format';
import { portalKey } from '../lib/hash';

const MAX_TRIES = 5;
const LOCK_KEY = 'xi_portal_lock';
const LAST_KEY = 'xi_portal_last';

const readLock = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY)) || { tries: 0, until: 0 };
  } catch {
    return { tries: 0, until: 0 };
  }
};

/**
 * Students sign in with roll + PIN; the class is found by trying every class (class + roll = Student ID). The pair is hashed into the key of a read-only
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
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-[28px] bg-white p-1.5 shadow-xl ring-4 ring-white/20 max-[374px]:h-20 max-[374px]:w-20">
            <Logo size={84} className="max-[374px]:h-[68px] max-[374px]:w-[68px]" />
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

const readLast = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY)) || {};
  } catch {
    return {};
  }
};

const fieldCls =
  'tabular h-14 w-full rounded-2xl bg-slate-50 pl-12 pr-4 text-[18px] font-bold text-ink outline-none ring-1 ring-inset ring-slate-200 transition placeholder:text-[15px] placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500';

function LoginCard({ onSuccess }) {
  const last = useMemo(readLast, []);
  const [classes, setClasses] = useState(null); // public class list (null = still loading)
  const [indexMissing, setIndexMissing] = useState(false);
  const [cls, setCls] = useState(''); // only typed when the public class list isn't available
  const [choices, setChoices] = useState(null); // same roll + PIN found in more than one class
  const [roll, setRoll] = useState(last.roll ? String(last.roll) : '');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(readLock);
  const [now, setNow] = useState(Date.now());
  const locked = lock.until > now;

  useEffect(
    () =>
      backend.subscribeDoc(CLASS_INDEX_PATH, (d) => {
        setIndexMissing(!d);
        setClasses(d?.classes || []);
      }),
    [],
  );

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

  const typedCode = indexMissing; // principal hasn't opened the app yet → type the class code

  const enter = (doc) => {
    saveLock({ tries: 0, until: 0 });
    localStorage.setItem(LAST_KEY, JSON.stringify({ roll: Number(roll) }));
    setPin('');
    setChoices(null);
    onSuccess(doc);
  };

  /** Students give only roll + PIN; we look for that pair in every class */
  const submit = async (e) => {
    e.preventDefault();
    if (locked || busy || !classes) return;
    const codes = typedCode ? [String(cls).trim().toUpperCase()].filter(Boolean) : classes.map((c) => c.code);
    if (!codes.length && typedCode) return fail('ক্লাস কোড লেখো');
    if (!/^\d{1,6}$/.test(roll)) return fail('রোল নম্বর লেখো');
    if (!/^\d{4,6}$/.test(pin)) return fail('৪ সংখ্যার পিন দাও');
    setBusy(true);
    try {
      const docs = await Promise.all(codes.map((code) => backend.getDoc(['portal', portalKey(studentIdFor(code, Number(roll)), pin)]).catch(() => null)));
      const found = docs.filter((d) => d && d.student);
      if (found.length === 1) return enter(found[0]);
      if (found.length > 1) {
        setChoices(found);
        return undefined;
      }
      const tries = lock.tries + 1;
      setPin('');
      if (tries >= MAX_TRIES) {
        saveLock({ tries: 0, until: Date.now() + 60000 });
        setNow(Date.now());
        fail('অনেকবার ভুল হয়েছে। ১ মিনিট পর আবার চেষ্টা করো।');
      } else {
        saveLock({ tries, until: 0 });
        fail(`রোল বা পিন মেলেনি। আর ${MAX_TRIES - tries} বার চেষ্টা করা যাবে।`);
      }
    } catch {
      fail('সংযোগে সমস্যা — ইন্টারনেট দেখে আবার চেষ্টা করো');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <form onSubmit={submit} className={cx('mt-8 space-y-4 rounded-[28px] bg-white p-5 shadow-xl', shake && 'animate-shake')}>
      {typedCode && (
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-slate-700">ক্লাস কোড</span>
          <div className="relative">
            <School className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={cls}
              onChange={(e) => {
                setCls(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="যেমন XI-2026"
              autoCapitalize="characters"
              spellCheck={false}
              className={fieldCls}
            />
          </div>
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-slate-700">রোল</span>
        <div className="relative">
          <Hash className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={roll}
            onChange={(e) => {
              setRoll(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            inputMode="numeric"
            autoComplete="username"
            placeholder="যেমন 105"
            className={cx(fieldCls, 'text-[20px] tracking-wide')}
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

      <Button type="submit" size="lg" block disabled={busy || locked || !classes || !roll || pin.length < 4 || (typedCode && !cls)}>
        {busy ? 'খোঁজা হচ্ছে…' : 'আমার তথ্য দেখো'}
      </Button>
      <Sheet open={!!choices} onClose={() => setChoices(null)} title="তোমার ক্লাস কোনটি?" subtitle="এই রোল ও পিন একাধিক ক্লাসে মিলেছে">
        <div className="space-y-2 pt-1">
          {(choices || []).map((d) => (
            <button
              key={d.classId}
              type="button"
              onClick={() => enter(d)}
              className="press flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200"
            >
              <School className="h-5 w-5 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{d.cls?.sectionName || d.classId}</span>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>
          ))}
        </div>
      </Sheet>
      <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-slate-400">
        <ShieldCheck className="h-4 w-4 shrink-0" /> পিন ক্লাস ইনচার্জের কাছ থেকে নাও
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

const TABS = [
  { id: 'home', label: 'সারাংশ', icon: LayoutGrid },
  { id: 'fees', label: 'বেতন', icon: Wallet },
  { id: 'att', label: 'হাজিরা', icon: CalendarCheck },
  { id: 'fines', label: 'জরিমানা', icon: Gavel },
  { id: 'receipts', label: 'রশিদ', icon: ReceiptText },
];

function StudentProfile({ student: s, onExit }) {
  const { fees, examFees, fines, payments, attendance, settings, getStudentAttendanceStats } = useApp();
  const { openReceipt } = useUI();
  const [tab, setTab] = useState('home');

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
  const sFines = fines.filter((f) => f.studentId === s.id).map(normalizeFine);

  // A fee row's "due" already includes its late fine; split it back out for the breakdown
  const feeFineDue = sFees.reduce((a, f) => a + Math.min(Number(f.fine || 0), Number(f.due || 0)), 0);
  const monthlyDue = sFees.reduce((a, f) => a + Number(f.due || 0), 0) - feeFineDue;
  const fineDue = sFines.reduce((a, f) => a + f.due, 0);
  const lateFine = feeFineDue + fineDue;
  const examDue = sExams.filter((e) => e.status === 'Due').reduce((a, e) => a + Number(e.due || 0), 0);
  const total = monthlyDue + lateFine + examDue;

  // Day → status for this student (the calendar's data)
  const log = useMemo(() => {
    const m = {};
    Object.entries(attendance).forEach(([d, rec]) => {
      if (rec?.[s.id]) m[d] = rec[s.id];
    });
    return m;
  }, [attendance, s.id]);

  const counts = {
    fees: sFees.filter((f) => feeStatus(f) !== 'Paid').length + sExams.filter((e) => e.status === 'Due').length,
    fines: sFines.filter((f) => f.status === 'Active').length,
  };

  const go = (id) => {
    setTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className={cx('mx-auto pb-28', CONTAINER, GUTTER)}>
        <div className={cx('no-print sticky top-0 z-20 bg-canvas/95 pb-2 pt-safe backdrop-blur-xl', BLEED)}>
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-bold text-ink">
              <Logo size={32} /> আমার প্রোফাইল
            </div>
            <Button variant="secondary" size="sm" icon={LogOut} onClick={onExit} aria-label="বের হও" title="বের হও" className="w-10 px-0" />
          </div>
        </div>

        <div className="print-area mt-2 space-y-4">
          {tab === 'home' && (
            <>
              <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                <div className="relative flex items-center gap-4">
                  <RollBadge roll={s.roll} seed={s.id} size={76} rounded="rounded-[24px]" className="ring-4 ring-white/20" />
                  <div className="min-w-0 flex-1">
                    <h1 className="text-[21px] font-extrabold leading-tight">{s.name}</h1>
                    {s.nameEn && <p className="text-[13px] text-white/70">{s.nameEn}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[s.groupLabel ?? groupBn(s.group), s.sectionLabel, s.genderLabel].filter(Boolean).map((t) => (
                        <span key={t} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="relative mt-4 truncate border-t border-white/15 pt-3 text-[12.5px] text-white/75">{settings.sectionName}</p>
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
                      ['মাসিক বেতন', monthlyDue, 'fees'],
                      ['জরিমানা', lateFine, 'fines'],
                      ['পরীক্ষার ফি', examDue, 'fees'],
                    ]
                      .filter(([, v]) => v > 0)
                      .map(([k, v, to]) => (
                        <button key={k} type="button" onClick={() => go(to)} className="flex w-full items-center justify-between py-3 text-left text-[15px]">
                          <span className="text-slate-600">{k}</span>
                          <span className="flex items-center gap-1">
                            <span className="tabular font-bold text-ink">{taka(v)}</span>
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                          </span>
                        </button>
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

              <button type="button" onClick={() => go('att')} className="block w-full text-left">
                <Card className="flex items-center gap-4 p-5">
                  <Ring value={att.percentage} size={64} stroke={8} tone={att.percentage >= 75 ? 'green' : 'red'}>
                    <span className="tabular text-[15px] font-extrabold text-ink">{Math.round(att.percentage)}%</span>
                  </Ring>
                  <div className="flex-1">
                    <p className="text-[16px] font-bold text-ink">হাজিরা</p>
                    <p className="tabular text-[13px] text-slate-500">
                      উপস্থিত {att.present} · অনুপস্থিত {att.absent} · মোট {att.totalClasses}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </Card>
              </button>

              <Card className="px-5 py-2">
                <div className="divide-y divide-slate-100">
                  <InfoRow icon={UserRound} label="পিতার নাম" value={s.fatherName} />
                  <InfoRow icon={Users} label="মাতার নাম" value={s.motherName} />
                  <InfoRow icon={Phone} label="অভিভাবকের ফোন" value={s.guardianPhone} mono />
                  <InfoRow icon={MapPin} label="ঠিকানা" value={s.address} />
                </div>
              </Card>

              <a href={`tel:${settings.inchargePhone}`} className="no-print press flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Phone className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] text-slate-500">কোনো প্রশ্ন? ক্লাস ইনচার্জকে কল করো</span>
                  <span className="block truncate text-[15px] font-bold text-ink">{settings.inchargeName}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-slate-300" />
              </a>
            </>
          )}

          {tab === 'fees' && (
            <>
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
            </>
          )}

          {tab === 'att' && <AttendanceTab att={att} log={log} />}

          {tab === 'fines' && (
            <>
              <Card className="grid grid-cols-3 divide-x divide-slate-100 py-4 text-center">
                {[
                  ['বাকি', fineDue, 'text-rose-600'],
                  ['মওকুফ', sFines.reduce((a, f) => a + f.waived, 0), 'text-slate-500'],
                  ['পরিশোধ', sFines.reduce((a, f) => a + f.paid, 0), 'text-emerald-600'],
                ].map(([k, v, c]) => (
                  <div key={k}>
                    <p className={cx('tabular text-[19px] font-extrabold', c)}>{taka(v)}</p>
                    <p className="text-[12px] text-slate-500">{k}</p>
                  </div>
                ))}
              </Card>
              <Card className="px-5 py-1">
                {sFines.length === 0 && <p className="py-6 text-center text-[14px] text-slate-400">কোনো জরিমানা নেই 🎉</p>}
                <div className="divide-y divide-slate-100">
                  {sFines.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ink">{f.reason}</p>
                        <p className="tabular text-[12.5px] text-slate-500">
                          {fmtDate(f.date)}
                          {f.waived > 0 ? ` · মওকুফ ${taka(f.waived)}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cx('tabular text-[15px] font-bold', f.status === 'Active' ? 'text-rose-600' : 'text-slate-400 line-through')}>
                          {taka(f.status === 'Active' ? f.due : f.amount)}
                        </p>
                        <Badge tone={FINE_STATUS[f.status].tone}>{FINE_STATUS[f.status].bn}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {tab === 'receipts' && (
            <Card className="px-5 py-1">
              {sPays.length === 0 && <p className="py-6 text-center text-[14px] text-slate-400">এখনো কোনো পেমেন্ট নেই</p>}
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
        </div>
      </div>
      {/* Bottom tab bar — within thumb reach */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/95 backdrop-blur-xl"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className={cx('mx-auto grid grid-cols-5 gap-1 pt-1.5', CONTAINER, GUTTER)}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            const n = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                className={cx('press relative flex flex-col items-center gap-0.5 rounded-xl py-2 transition', on ? 'bg-brand-50 text-brand-600' : 'text-slate-500')}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11.5px] font-semibold leading-tight max-[374px]:text-[10.5px]">{t.label}</span>
                {n > 0 && !on && <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-rose-500" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

const ATT_CELL = {
  Present: 'bg-emerald-500 text-white',
  Absent: 'bg-rose-500 text-white',
  Late: 'bg-amber-400 text-white',
  Leave: 'bg-sky-500 text-white',
};
const WEEK = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র'];

/** Month calendar: each class day coloured by whether the student came */
function AttendanceTab({ att, log }) {
  const months = useMemo(() => {
    const set = new Set(Object.keys(log).map((d) => d.slice(0, 7)));
    set.add(todayISO().slice(0, 7));
    return [...set].sort();
  }, [log]);
  const [idx, setIdx] = useState(months.length - 1);
  const ym = months[Math.min(idx, months.length - 1)];
  const [y, m] = ym.split('-').map(Number);

  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // weeks start on Saturday
  const today = todayISO();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${ym}-${String(i + 1).padStart(2, '0')}`;
    return { d: i + 1, iso, st: log[iso], future: iso > today };
  });
  const monthCount = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  days.forEach((x) => x.st && (monthCount[x.st] += 1));
  const missed = days.filter((x) => x.st && x.st !== 'Present');

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Ring value={att.percentage} size={72} stroke={8} tone={att.percentage >= 75 ? 'green' : 'red'}>
            <span className="tabular text-[16px] font-extrabold text-ink">{Math.round(att.percentage)}%</span>
          </Ring>
          <div className="flex-1">
            <p className="text-[16px] font-bold text-ink">মোট হাজিরা</p>
            <p className="text-[13px] text-slate-500">মোট {att.totalClasses} ক্লাসের মধ্যে</p>
            {att.percentage < 75 && att.totalClasses > 0 && <p className="mt-1 text-[12.5px] font-semibold text-rose-600">⚠ হাজিরা ৭৫% এর কম</p>}
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

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" aria-label="আগের মাস" disabled={idx <= 0} onClick={() => setIdx((i) => i - 1)} className="press grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[16px] font-bold text-ink">
              {BN_MONTHS[m - 1]} {y}
            </p>
            <p className="tabular text-[12px] text-slate-500">
              উপস্থিত {monthCount.Present + monthCount.Late} · অনুপস্থিত {monthCount.Absent}
            </p>
          </div>
          <button type="button" aria-label="পরের মাস" disabled={idx >= months.length - 1} onClick={() => setIdx((i) => i + 1)} className="press grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEK.map((w) => (
            <p key={w} className="pb-1 text-[11.5px] font-semibold text-slate-400">
              {w}
            </p>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map((x) => (
            <span
              key={x.iso}
              title={x.st ? ATT_STATUS[x.st].bn : ''}
              className={cx(
                'tabular grid aspect-square place-items-center rounded-xl text-[13.5px] font-bold',
                x.st ? ATT_CELL[x.st] : x.future ? 'text-slate-300' : 'bg-slate-50 text-slate-400',
                x.iso === today && 'ring-2 ring-brand-500 ring-offset-1',
              )}
            >
              {x.d}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] text-slate-600">
          {ATT_ORDER.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cx('h-3 w-3 rounded', ATT_CELL[k].split(' ')[0])} />
              {ATT_STATUS[k].bn}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-slate-100" />
            ক্লাস হয়নি
          </span>
        </div>
      </Card>

      <Card className="px-5 py-1">
        <p className="pt-3 text-[15px] font-bold text-ink">যেদিন আসোনি / দেরি / ছুটি</p>
        {missed.length === 0 ? (
          <p className="py-4 text-[14px] text-slate-400">এই মাসে প্রতিদিন উপস্থিত ✓</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {missed.map((x) => (
              <div key={x.iso} className="flex items-center justify-between py-3">
                <span className="text-[14.5px] text-ink">
                  {fmtDate(x.iso)} <span className="text-slate-400">· {dayNameBn(x.iso)}</span>
                </span>
                <Badge tone={ATT_STATUS[x.st].tone} dot>
                  {ATT_STATUS[x.st].bn}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
