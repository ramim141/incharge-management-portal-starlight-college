import React, { useEffect, useMemo, useState } from 'react';
import { CLASS_INDEX_PATH, buildClassIndex } from '../../lib/classIndex';
import {
  House, School, Users, Settings, Plus, ChevronRight, TriangleAlert, CalendarX, UserPlus, Copy, Check, Mail, KeyRound,
  Trash2, Pencil, LogOut, UserRound, Building2, Database, RotateCcw, Phone, ArrowRight, Power, Eye, IdCard, Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { backend, isLocal, errorText } from '../../backend';
import { DEFAULT_CLASS_SETTINGS } from '../../lib/defaults';
import {
  STAFF_COUNTER_PATH, DEFAULT_STAFF_PREFIX, loginIdPath, staffEmail, isStaffEmail, formatStaffId, nextStaffSerial, generateStaffPassword,
} from '../../lib/staffLogin';
import { AccountSheet } from '../../components/AccountSheets';
import { StudentImport } from './StudentImport';
import { useBackHandler } from '../../lib/backstack';
import { taka, monthBn, EN_MONTHS, waLink } from '../../lib/format';
import {
  PageHeader, Card, Avatar, Badge, Button, IconButton, Progress, Sheet, Field, Input, EmptyState, SelectPill, cx, CONTAINER, GUTTER,
  CARD_GRID, DOCK, DOCK_BOTTOM,
} from '../../components/ui';
import { WhatsAppIcon } from '../../components/ReceiptSheet';
import { assignOps, deleteClassDeep, CLASS_PRESETS } from './principalData';

const TABS = [
  { id: 'home', label: 'ওভারভিউ', icon: House },
  { id: 'classes', label: 'ক্লাস', icon: School },
  { id: 'teachers', label: 'শিক্ষক', icon: Users },
  { id: 'settings', label: 'সেটিংস', icon: Settings },
];

export function PrincipalApp({ onOpenClass, onOpenPortal, onSignOut }) {
  const { profile, institution } = useAuth();
  const [tab, setTab] = useState('home');
  const [classes, setClasses] = useState(null);
  const [users, setUsers] = useState(null);

  useEffect(() => backend.subscribeCollection(['classes'], (l) => setClasses(l.sort((a, b) => String(a.id).localeCompare(String(b.id))))), []);
  useEffect(() => backend.subscribeCollection(['users'], setUsers), []);

  // Keep the public class list (student portal's class picker) matching the real classes
  const [classIndex, setClassIndex] = useState(undefined);
  useEffect(() => backend.subscribeDoc(CLASS_INDEX_PATH, setClassIndex), []);
  useEffect(() => {
    if (!classes || classIndex === undefined) return;
    const next = buildClassIndex(classes);
    // Also write an empty list once, so the portal knows the list exists (no class-code box)
    if (classIndex === null || JSON.stringify(next) !== JSON.stringify(classIndex.classes || [])) {
      backend.write([{ type: 'set', path: CLASS_INDEX_PATH, data: { classes: next } }]);
    }
  }, [classes, classIndex]);
  useBackHandler(tab !== 'home', () => setTab('home'));

  const teachers = useMemo(() => (users || []).filter((u) => u.role === 'incharge').sort((a, b) => String(a.name).localeCompare(String(b.name))), [users]);
  const data = { classes: classes || [], users: users || [], teachers, institution, profile, onOpenClass };

  return (
    <>
      <main className={cx('mx-auto min-h-dvh', CONTAINER, GUTTER)} style={{ paddingBottom: 'calc(104px + env(safe-area-inset-bottom) + var(--nav-lift, 0px))' }}>
        <div key={tab} className="animate-fade">
          {classes === null || users === null ? (
            <p className="py-24 text-center text-[14px] text-slate-400">লোড হচ্ছে…</p>
          ) : tab === 'home' ? (
            <Overview {...data} go={setTab} />
          ) : tab === 'classes' ? (
            <ClassesTab {...data} />
          ) : tab === 'teachers' ? (
            <TeachersTab {...data} />
          ) : (
            <PrincipalSettings {...data} onOpenPortal={onOpenPortal} onSignOut={onSignOut} />
          )}
        </div>
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-slate-200/70 bg-white/90 shadow-nav backdrop-blur-xl md:bottom-4 md:max-w-[520px] md:rounded-[26px] md:border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid h-[68px] grid-cols-4 max-[374px]:h-[62px]">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} className="flex flex-col items-center justify-center gap-1">
                <span className={cx('grid h-8 w-14 place-items-center rounded-full transition', active ? 'bg-brand-50 text-brand-700' : 'text-slate-400')}>
                  <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cx('text-[11.5px] font-semibold', active ? 'text-brand-700' : 'text-slate-500')}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function Overview({ classes, teachers, institution, profile, onOpenClass, go }) {
  const month = EN_MONTHS[new Date().getMonth()];
  const sum = (k) => classes.reduce((a, c) => a + Number(c.stats?.[k] || 0), 0);
  const collected = sum('collected');
  const monthDue = sum('monthDue');
  const pct = collected + monthDue ? Math.round((collected / (collected + monthDue)) * 100) : 0;
  const noIncharge = classes.filter((c) => !c.inchargeUid);
  const noAttendance = classes.filter((c) => c.stats && !c.stats.attendanceTaken);

  return (
    <div className="pt-safe">
      <div className="flex items-center gap-3 pb-4 pt-5 md:pt-7">
        <Avatar name={profile?.name} seed={profile?.uid} size={46} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-slate-500">{institution?.name || 'প্রতিষ্ঠান'}</p>
          <p className="truncate text-[17px] font-extrabold text-ink">{profile?.name}</p>
        </div>
        <Badge tone="brand">অধ্যক্ষ</Badge>
      </div>

      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <p className="relative text-[13.5px] font-semibold text-white/75">সব ক্লাস মিলিয়ে · {monthBn(month)} মাসের আদায়</p>
        <p className="tabular relative mt-1 text-[32px] font-extrabold leading-tight max-[374px]:text-[27px]">{taka(collected)}</p>
        <p className="tabular relative text-[13px] text-white/70">বাকি {taka(monthDue)} · মোট বকেয়া {taka(sum('totalDue'))}</p>
        <Progress value={pct} tone="white" track="bg-white/20" className="relative mt-3" />
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[
            ['ক্লাস', classes.length],
            ['শিক্ষার্থী', sum('students')],
            ['মেয়াদোত্তীর্ণ', sum('overdue')],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/10">
              <p className="tabular text-[20px] font-extrabold">{v}</p>
              <p className="truncate text-[12px] text-white/70">{k}</p>
            </div>
          ))}
        </div>
      </div>

      {(noIncharge.length > 0 || noAttendance.length > 0) && (
        <div className="mt-3 space-y-2.5">
          {noIncharge.length > 0 && (
            <Alert tone="amber" icon={TriangleAlert} title={`${noIncharge.length}টি ক্লাসে ইনচার্জ নেই`} text={noIncharge.map((c) => c.name).join(', ')} action="দায়িত্ব দিন" onAction={() => go('classes')} />
          )}
          {noAttendance.length > 0 && (
            <Alert tone="red" icon={CalendarX} title={`আজ ${noAttendance.length}টি ক্লাসে হাজিরা নেওয়া হয়নি`} text={noAttendance.map((c) => c.name).join(', ')} />
          )}
        </div>
      )}

      <div className="mb-2.5 mt-6 flex items-end justify-between px-1">
        <h3 className="text-[15px] font-bold text-ink">ক্লাসসমূহ</h3>
        <button type="button" onClick={() => go('classes')} className="flex items-center gap-0.5 text-[13.5px] font-semibold text-brand-600">
          সব দেখুন <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {classes.length === 0 ? (
        <EmptyState icon={School} title="এখনো কোনো ক্লাস নেই" text="প্রথমে একটি ক্লাস তৈরি করুন, তারপর শিক্ষককে দায়িত্ব দিন" action={<Button icon={Plus} onClick={() => go('classes')}>ক্লাস তৈরি করুন</Button>} />
      ) : (
        <div className={CARD_GRID}>
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} teacher={teachers.find((t) => t.id === c.inchargeUid)} onOpen={() => onOpenClass(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const Alert = ({ tone, icon: Icon, title, text, action, onAction }) => (
  <div className={cx('flex flex-wrap items-center gap-3 rounded-3xl p-4 ring-1', tone === 'red' ? 'bg-rose-50 ring-rose-100' : 'bg-amber-50 ring-amber-100')}>
    <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white', tone === 'red' ? 'bg-rose-500' : 'bg-amber-500')}>
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[14.5px] font-bold leading-snug text-ink">{title}</p>
      <p className="truncate text-[12.5px] text-slate-600">{text}</p>
    </div>
    {action && (
      <Button size="sm" variant="secondary" onClick={onAction}>
        {action}
      </Button>
    )}
  </div>
);

function ClassCard({ c, teacher, onOpen, onEdit }) {
  const st = c.stats || {};
  const total = Number(st.collected || 0) + Number(st.monthDue || 0);
  const pct = total ? (st.collected / total) * 100 : 0;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onOpen} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <School className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-ink">{c.name}</p>
            <p className="truncate text-[12.5px] text-slate-500">
              {[c.section, c.session && `সেশন ${c.session}`].filter(Boolean).join(' · ')}
            </p>
            <p className="tabular mt-0.5 text-[12px] font-semibold text-slate-400">{c.id}</p>
          </div>
          {st.overdue > 0 && <Badge tone="red">{st.overdue} মেয়াদোত্তীর্ণ</Badge>}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
          <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
          {teacher || c.inchargeName ? (
            <span className="truncate text-[13.5px] font-semibold text-slate-700">{teacher?.name || c.inchargeName}</span>
          ) : (
            <span className="text-[13.5px] font-semibold text-amber-600">ইনচার্জ নেই</span>
          )}
        </div>

        {!c.stats ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12.5px] text-slate-500">
            হিসাব এখনো আসেনি — ইনচার্জ বা আপনি ক্লাসটি একবার খুললেই দেখা যাবে
          </p>
        ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label="শিক্ষার্থী" value={st.students ?? '—'} />
          <Mini label="আদায়" value={st.collected != null ? taka(st.collected) : '—'} cls="text-emerald-600" />
          <Mini label="আজ হাজিরা" value={st.attendanceTaken ? `${st.present}/${st.students}` : 'নেয়নি'} cls={st.attendanceTaken ? '' : 'text-rose-500'} />
        </div>
        )}
        {c.stats && <Progress value={pct} className="mt-3 h-1.5" />}
      </button>
      <div className="grid grid-cols-2 border-t border-slate-100">
        <button type="button" onClick={onOpen} className="flex h-11 items-center justify-center gap-1.5 text-[13.5px] font-semibold text-brand-600 active:bg-brand-50">
          <Eye className="h-4 w-4" /> খুলুন
        </button>
        {onEdit ? (
          <button type="button" onClick={onEdit} className="flex h-11 items-center justify-center gap-1.5 border-l border-slate-100 text-[13.5px] font-semibold text-slate-700 active:bg-slate-50">
            <Pencil className="h-4 w-4" /> সম্পাদনা
          </button>
        ) : (
          <span className="border-l border-slate-100" />
        )}
      </div>
    </Card>
  );
}

const Mini = ({ label, value, cls }) => (
  <div className="rounded-xl bg-slate-50 py-2">
    <p className={cx('tabular truncate px-1 text-[14px] font-bold text-ink', cls)}>{value}</p>
    <p className="text-[11.5px] text-slate-500">{label}</p>
  </div>
);

/* ───────────────────────── Classes ───────────────────────── */

function ClassesTab({ classes, users, teachers, onOpenClass }) {
  const [editing, setEditing] = useState(null); // {} for new, class for edit
  const [importing, setImporting] = useState(false);
  return (
    <div>
      <PageHeader
        title="ক্লাস"
        subtitle={`${classes.length}টি ক্লাস`}
        actions={
          <>
            {classes.length > 0 && <IconButton icon={Upload} label="শিক্ষার্থী তালিকা ইমপোর্ট" onClick={() => setImporting(true)} />}
            <IconButton icon={Plus} label="নতুন ক্লাস" onClick={() => setEditing({})} />
          </>
        }
      />
      {classes.length > 0 && (
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="press mb-3 flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-card ring-1 ring-slate-200/70"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Upload className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">সব শিক্ষার্থীর তালিকা ইমপোর্ট</span>
            <span className="block text-[12.5px] text-slate-500">Excel/CSV থেকে একবারে — প্রত্যেকে নিজের ক্লাসে যাবে</span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </button>
      )}
      <Sheet open={importing} onClose={() => setImporting(false)} full title="শিক্ষার্থী তালিকা ইমপোর্ট" subtitle="ইনচার্জদের আর নিজে যোগ করতে হবে না">
        {importing && <StudentImport classes={classes} onDone={() => setImporting(false)} />}
      </Sheet>
      {classes.length === 0 ? (
        <EmptyState icon={School} title="কোনো ক্লাস নেই" action={<Button icon={Plus} onClick={() => setEditing({})}>নতুন ক্লাস</Button>} />
      ) : (
        <div className={CARD_GRID}>
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} teacher={teachers.find((t) => t.id === c.inchargeUid)} onOpen={() => onOpenClass(c.id)} onEdit={() => setEditing(c)} />
          ))}
        </div>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} full title={editing?.id ? 'ক্লাস সম্পাদনা' : 'নতুন ক্লাস'} subtitle={editing?.id || 'ক্লাস তৈরি করে ইনচার্জ ঠিক করুন'}>
        {editing && <ClassForm cls={editing.id ? editing : null} classes={classes} users={users} teachers={teachers} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function ClassForm({ cls, classes, users, teachers, onDone }) {
  const { toast, confirm } = useUI();
  const year = new Date().getFullYear();
  const [f, setF] = useState(() =>
    cls
      ? { code: cls.id, name: cls.name, section: cls.section || '', session: cls.session || '', inchargeUid: cls.inchargeUid || '', ...DEFAULT_CLASS_SETTINGS, ...(cls.settings || {}) }
      : { code: '', name: '', section: '', session: `${year}-${String(year + 1).slice(2)}`, inchargeUid: '', ...DEFAULT_CLASS_SETTINGS },
  );
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    const code = String(f.code).trim().toUpperCase();
    const e = {};
    if (!cls) {
      if (!/^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$/.test(code)) e.code = 'ইংরেজি বড় হাতের অক্ষর, সংখ্যা ও - (যেমন XI-2026)';
      else if (classes.some((c) => c.id === code)) e.code = 'এই কোড আগেই আছে';
    }
    if (!String(f.name).trim()) e.name = 'ক্লাসের নাম দিন';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const id = cls ? cls.id : code;
    const settings = {
      ...DEFAULT_CLASS_SETTINGS,
      ...(cls?.settings || {}),
      defaultMonthlyFee: Number(f.defaultMonthlyFee),
      defaultFeeDeadlineDay: Number(f.defaultFeeDeadlineDay),
      fixedFineAfterDeadline: Number(f.fixedFineAfterDeadline),
    };
    const base = { code: id, name: f.name.trim(), section: f.section.trim(), session: f.session.trim(), settings };
    const ops = cls
      ? [{ type: 'merge', path: ['classes', id], data: base }]
      : [{ type: 'set', path: ['classes', id], data: { ...base, inchargeUid: null, inchargeName: '', inchargePhone: '', inchargeEmail: '', inchargeDesignation: '', createdAt: new Date().toISOString() } }];
    const classesAfter = cls ? classes : [...classes, { id, inchargeUid: null }];
    if ((f.inchargeUid || null) !== (cls?.inchargeUid || null)) {
      ops.push(...assignOps({ classes: classesAfter, users, classCode: id, uid: f.inchargeUid || null }));
    }
    try {
      await backend.write(ops, { wait: !cls });
      toast(cls ? 'ক্লাস আপডেট হয়েছে' : `${base.name} তৈরি হয়েছে`);
      onDone();
    } catch (er) {
      toast(errorText(er), 'error');
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `${cls.name} মুছবেন?`,
      message: 'এই ক্লাসের সব শিক্ষার্থী, বেতন, হাজিরা ও পেমেন্টের তথ্য স্থায়ীভাবে মুছে যাবে। আগে রিপোর্ট/ব্যাকআপ নিয়ে রাখুন।',
      confirmText: 'স্থায়ীভাবে মুছুন',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteClassDeep({ classes, users, classCode: cls.id });
      toast('ক্লাস মুছে ফেলা হয়েছে');
      onDone();
    } catch (er) {
      toast(errorText(er), 'error');
      setBusy(false);
    }
  };

  const options = teachers.filter((t) => t.active !== false);

  return (
    <div className="space-y-5 pt-1">
      <Field label="ক্লাসের নাম" error={err.name}>
        <Input value={f.name} onChange={set('name')} placeholder="যেমন একাদশ শ্রেণি" />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {CLASS_PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => setF((x) => ({ ...x, name: p }))} className={cx('press rounded-full px-3 py-1.5 text-[13px] font-semibold', f.name === p ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}>
            {p}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="শাখা / বিভাগ">
          <Input value={f.section} onChange={set('section')} placeholder="যেমন বিজ্ঞান - ক" />
        </Field>
        <Field label="সেশন">
          <Input value={f.session} onChange={set('session')} placeholder="2026-27" />
        </Field>
      </div>
      <Field
        label="ক্লাস কোড"
        error={err.code}
        hint={cls ? 'কোড বদলানো যায় না' : 'স্টুডেন্ট আইডির শুরুতে বসবে, যেমন XI-2026 → XI-2026-0105। পরে বদলানো যাবে না।'}
      >
        <Input value={f.code} disabled={!!cls} onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} placeholder="XI-2026" className="tabular uppercase disabled:opacity-60" />
      </Field>

      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">ক্লাস ইনচার্জ</p>
        <div className="space-y-2">
          <TeacherOption selected={!f.inchargeUid} onClick={() => setF((x) => ({ ...x, inchargeUid: '' }))} title="এখন কাউকে দেব না" />
          {options.map((t) => {
            const other = t.classId && t.classId !== cls?.id;
            return (
              <TeacherOption
                key={t.id}
                selected={f.inchargeUid === t.id}
                onClick={() => setF((x) => ({ ...x, inchargeUid: t.id }))}
                title={t.name}
                sub={other ? `এখন ${t.classId} এর দায়িত্বে — বদলে যাবে` : t.email}
                warn={other}
                avatar={t}
              />
            );
          })}
          {options.length === 0 && <p className="text-[13px] text-slate-500">কোনো শিক্ষক নেই — "শিক্ষক" ট্যাব থেকে আগে অ্যাকাউন্ট তৈরি করুন।</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="মাসিক বেতন">
          <Input type="number" inputMode="numeric" value={f.defaultMonthlyFee} onChange={set('defaultMonthlyFee')} />
        </Field>
        <Field label="শেষ তারিখ">
          <Input type="number" inputMode="numeric" value={f.defaultFeeDeadlineDay} onChange={set('defaultFeeDeadlineDay')} />
        </Field>
        <Field label="জরিমানা">
          <Input type="number" inputMode="numeric" value={f.fixedFineAfterDeadline} onChange={set('fixedFineAfterDeadline')} />
        </Field>
      </div>

      {cls && (
        <Button variant="soft-danger" icon={Trash2} block onClick={remove} disabled={busy}>
          ক্লাস মুছে ফেলুন
        </Button>
      )}
      <div className="sticky bottom-0 -mx-5 bg-white/95 px-5 pb-1 pt-3 backdrop-blur">
        <Button size="lg" block onClick={save} disabled={busy}>
          {busy ? 'সংরক্ষণ হচ্ছে…' : cls ? 'পরিবর্তন সংরক্ষণ' : 'ক্লাস তৈরি করুন'}
        </Button>
      </div>
    </div>
  );
}

const TeacherOption = ({ selected, onClick, title, sub, warn, avatar }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx('press flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 ring-inset', selected ? 'bg-brand-50/70 ring-2 ring-brand-500' : 'bg-white ring-slate-200')}
  >
    {avatar ? <Avatar name={avatar.name} seed={avatar.id} size={36} rounded="rounded-full" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400">—</span>}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14.5px] font-semibold text-ink">{title}</span>
      {sub && <span className={cx('block truncate text-[12.5px]', warn ? 'text-amber-600' : 'text-slate-500')}>{sub}</span>}
    </span>
    <span className={cx('h-5 w-5 shrink-0 rounded-full ring-2 ring-inset', selected ? 'bg-brand-600 ring-brand-600 shadow-[inset_0_0_0_4px_white]' : 'ring-slate-300')} />
  </button>
);

/* ───────────────────────── Teachers ───────────────────────── */

function TeachersTab({ classes, users, teachers }) {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [created, setCreated] = useState(null);
  const [filter, setFilter] = useState('all');
  const list = teachers.filter((t) => (filter === 'all' ? true : filter === 'free' ? !t.classId && t.active !== false : t.active === false));
  const open = teachers.find((t) => t.id === openId);

  return (
    <div>
      <PageHeader title="শিক্ষক" subtitle={`${teachers.length} জন ইনচার্জ`} actions={<IconButton icon={UserPlus} label="নতুন শিক্ষক" onClick={() => setCreating(true)} />}>
        <SelectPill
          label="দেখান"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'সবাই', count: teachers.length },
            { value: 'free', label: 'ক্লাস নেই', count: teachers.filter((t) => !t.classId && t.active !== false).length },
            { value: 'off', label: 'নিষ্ক্রিয়', count: teachers.filter((t) => t.active === false).length },
          ]}
        />
      </PageHeader>

      {list.length === 0 ? (
        <EmptyState icon={Users} title="কেউ নেই" text="নতুন শিক্ষকের অ্যাকাউন্ট তৈরি করুন" action={<Button icon={UserPlus} onClick={() => setCreating(true)}>নতুন শিক্ষক</Button>} />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
          {list.map((t) => {
            const cls = classes.find((c) => c.id === t.classId);
            return (
              <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 md:border-b md:border-slate-100 md:odd:border-r">
                <Avatar name={t.name} seed={t.id} size={46} rounded="rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-[15.5px] font-semibold', t.active === false ? 'text-slate-400' : 'text-ink')}>{t.name}</span>
                  <span className="tabular block truncate text-[12.5px] text-slate-500">{t.loginId ? `আইডি ${t.loginId}` : t.email}</span>
                </span>
                {t.active === false ? <Badge tone="slate">নিষ্ক্রিয়</Badge> : cls ? <Badge tone="brand">{cls.name}</Badge> : <Badge tone="amber">ক্লাস নেই</Badge>}
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </button>
            );
          })}
        </Card>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} full title="নতুন শিক্ষক" subtitle="লগইনের জন্য অ্যাকাউন্ট তৈরি হবে">
        {creating && (
          <TeacherForm
            classes={classes}
            users={users}
            onDone={(info) => {
              setCreating(false);
              if (info) setTimeout(() => setCreated(info), 80);
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!created} onClose={() => setCreated(null)} title="অ্যাকাউন্ট তৈরি হয়েছে" subtitle="লগইন তথ্য শিক্ষককে জানিয়ে দিন">
        {created && <LoginInfo info={created} />}
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpenId(null)} full title={open?.name} subtitle={open?.loginId ? `লগইন আইডি ${open.loginId}` : open?.email}>
        {open && <TeacherDetail t={open} classes={classes} users={users} onClose={() => setOpenId(null)} />}
      </Sheet>
    </div>
  );
}

function TeacherForm({ classes, users, onDone }) {
  const { toast } = useUI();
  const [counter, setCounter] = useState(undefined);
  const [f, setF] = useState({ name: '', email: '', phone: '', designation: 'প্রভাষক', password: generateStaffPassword(), classId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const free = classes.filter((c) => !c.inchargeUid);

  useEffect(() => backend.subscribeDoc(STAFF_COUNTER_PATH, setCounter), []);
  const prefix = counter?.prefix || DEFAULT_STAFF_PREFIX;
  const serial = nextStaffSerial(counter, users, prefix);
  const loginId = formatStaffId(prefix, serial);

  const save = async () => {
    if (!f.name.trim()) return setErr('শিক্ষকের নাম দিন');
    if (f.password.length < 6) return setErr('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর');
    const recovery = f.email.trim().toLowerCase();
    if (recovery && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recovery)) return setErr('রিকভারি ইমেইল সঠিক নয়');
    setBusy(true);
    try {
      // Skip any number already taken (e.g. created from another phone at the same time)
      let n = serial;
      while (await backend.getDoc(loginIdPath(formatStaffId(prefix, n)))) n += 1;
      let id;
      let email;
      let uid;
      // An earlier attempt may have created a login for this ID and then failed to save — that
      // address is taken, so move on to the next number instead of failing every time
      for (let attempt = 0; ; attempt += 1) {
        id = formatStaffId(prefix, n);
        email = recovery || staffEmail(id);
        try {
          uid = await backend.createAccount(email, f.password, { secondary: true });
          break;
        } catch (e) {
          if (e?.code !== 'auth/email-already-in-use' || recovery || attempt >= 5) throw e;
          n += 1;
        }
      }
      const user = {
        id: uid, role: 'incharge', loginId: id, name: f.name.trim(), email, phone: f.phone.trim(), designation: f.designation.trim(),
        classId: null, active: true, mustChangePassword: true,
      };
      const { id: _uid, ...data } = user;
      const ops = [
        { type: 'set', path: ['users', uid], data },
        { type: 'set', path: loginIdPath(id), data: { email, uid } },
        { type: 'set', path: STAFF_COUNTER_PATH, data: { prefix, last: n } },
      ];
      if (f.classId) ops.push(...assignOps({ classes, users: [...users, user], classCode: f.classId, uid }));
      await backend.write(ops, { wait: true });
      toast(`${user.name} — আইডি ${id}`);
      onDone({ ...user, password: f.password, className: classes.find((c) => c.id === f.classId)?.name });
    } catch (e) {
      console.error('Create teacher failed', e);
      if (e?.code === 'auth/email-already-in-use' && recovery) {
        setErr('এই রিকভারি ইমেইলে আগেই একটি অ্যাকাউন্ট আছে (যেমন অধ্যক্ষের নিজের)। অন্য ইমেইল দিন বা ঘরটি খালি রাখুন।');
      } else {
        setErr(`${errorText(e)}${e?.code ? ` [${e.code}]` : ''}`);
      }
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pt-1">
      <Field label="নাম">
        <Input value={f.name} onChange={set('name')} placeholder="যেমন নাসরিন সুলতানা" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="পদবি">
          <Input value={f.designation} onChange={set('designation')} />
        </Field>
        <Field label="মোবাইল (WhatsApp)">
          <Input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50/70 p-4">
        <IdCard className="h-6 w-6 shrink-0 text-brand-600" />
        <div className="flex-1">
          <p className="text-[12.5px] text-brand-800">লগইন আইডি (আপনাআপনি)</p>
          <p className="tabular text-[20px] font-extrabold tracking-wide text-ink">{counter === undefined ? '…' : loginId}</p>
        </div>
      </div>
      <Field label="প্রথম পাসওয়ার্ড" hint="প্রথমবার লগইনের পর শিক্ষককে নিজের পাসওয়ার্ড দিতে হবে">
        <div className="flex gap-2">
          <Input value={f.password} onChange={set('password')} className="tabular flex-1 tracking-wider" />
          <Button variant="secondary" className="w-12 shrink-0 px-0" aria-label="নতুন পাসওয়ার্ড" onClick={() => setF((x) => ({ ...x, password: generateStaffPassword() }))}>
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </Field>
      <Field label="শিক্ষকের রিকভারি ইমেইল (ঐচ্ছিক)" hint="শিক্ষকের নিজের ইমেইল — আপনার (অধ্যক্ষের) ইমেইল নয়। খালি রাখলেও চলবে; শিক্ষক পরে নিজে যোগ করতে পারবেন।">
        <Input type="email" inputMode="email" autoCapitalize="off" value={f.email} onChange={set('email')} placeholder="ঐচ্ছিক" />
      </Field>
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">কোন ক্লাসের ইনচার্জ</p>
        <div className="space-y-2">
          <TeacherOption selected={!f.classId} onClick={() => setF((x) => ({ ...x, classId: '' }))} title="পরে ঠিক করব" />
          {free.map((c) => (
            <TeacherOption key={c.id} selected={f.classId === c.id} onClick={() => setF((x) => ({ ...x, classId: c.id }))} title={c.name} sub={[c.section, c.id].filter(Boolean).join(' · ')} />
          ))}
        </div>
      </div>
      {err && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[13.5px] font-medium text-rose-700">{err}</p>}
      <div className="sticky bottom-0 -mx-5 bg-white/95 px-5 pb-1 pt-3 backdrop-blur">
        <Button size="lg" block onClick={save} disabled={busy || counter === undefined}>
          {busy ? 'তৈরি হচ্ছে…' : 'অ্যাকাউন্ট তৈরি করুন'}
        </Button>
      </div>
    </div>
  );
}

function LoginInfo({ info }) {
  const [copied, setCopied] = useState(false);
  const loginAs = info.loginId || info.email;
  const text = `আসসালামু আলাইকুম ${info.name},\nক্লাস পোর্টালে আপনার ইনচার্জ অ্যাকাউন্ট তৈরি হয়েছে।${info.className ? `\nক্লাস: ${info.className}` : ''}\nলিংক: ${window.location.origin}\nলগইন আইডি: ${loginAs}\nপাসওয়ার্ড: ${info.password}\n\nপ্রথমবার ঢোকার পর নিজের পাসওয়ার্ড দিতে হবে।`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="space-y-4 pt-1">
      <div className="space-y-2 rounded-3xl bg-slate-50 p-4 text-[14.5px]">
        <p className="tabular flex items-center gap-2 text-[17px] font-extrabold tracking-wide text-ink">
          {info.loginId ? <IdCard className="h-4 w-4 text-slate-400" /> : <Mail className="h-4 w-4 text-slate-400" />} {loginAs}
        </p>
        <p className="tabular flex items-center gap-2 font-bold tracking-wider text-ink">
          <KeyRound className="h-4 w-4 text-slate-400" /> {info.password}
        </p>
      </div>
      <p className="text-[13px] text-slate-500">এই পাসওয়ার্ড আর দেখা যাবে না — এখনই শিক্ষককে পাঠিয়ে দিন।</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
          {copied ? 'কপি হয়েছে' : 'কপি'}
        </Button>
        {info.phone ? (
          <Button as="a" href={waLink(info.phone, text)} target="_blank" rel="noopener noreferrer" variant="success">
            <WhatsAppIcon className="h-5 w-5" /> WhatsApp
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function TeacherDetail({ t, classes, users, onClose }) {
  const { toast, confirm } = useUI();
  const [f, setF] = useState({ name: t.name || '', phone: t.phone || '', designation: t.designation || '' });
  const [newPw, setNewPw] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const cls = classes.find((c) => c.id === t.classId);

  const saveInfo = async () => {
    const ops = [{ type: 'merge', path: ['users', t.id], data: f }];
    if (cls) ops.push({ type: 'merge', path: ['classes', cls.id], data: { inchargeName: f.name, inchargePhone: f.phone, inchargeDesignation: f.designation } });
    await backend.write(ops);
    toast('তথ্য আপডেট হয়েছে');
  };

  const assign = async (classCode) => {
    await backend.write(assignOps({ classes, users, classCode: classCode || null, uid: t.id }));
    toast(classCode ? 'ক্লাসের দায়িত্ব দেওয়া হয়েছে' : 'ক্লাস থেকে সরানো হয়েছে');
  };

  const toggleActive = async () => {
    const off = t.active !== false;
    const ok = await confirm({
      title: off ? 'অ্যাকাউন্ট নিষ্ক্রিয় করবেন?' : 'অ্যাকাউন্ট আবার চালু করবেন?',
      message: off ? 'এই শিক্ষক আর কোনো তথ্য দেখতে বা বদলাতে পারবেন না। ক্লাসের দায়িত্বও সরে যাবে।' : undefined,
      confirmText: off ? 'নিষ্ক্রিয় করুন' : 'চালু করুন',
      tone: off ? 'danger' : undefined,
      icon: Power,
    });
    if (!ok) return;
    const ops = off ? assignOps({ classes, users, classCode: null, uid: t.id }) : [];
    ops.push({ type: 'merge', path: ['users', t.id], data: { active: !off } });
    await backend.write(ops);
    toast(off ? 'অ্যাকাউন্ট নিষ্ক্রিয় হয়েছে' : 'অ্যাকাউন্ট চালু হয়েছে');
  };

  const hasRecovery = !isStaffEmail(t.email);
  const resetPw = async () => {
    try {
      if (isLocal) {
        const pw = generateStaffPassword();
        await backend.setPassword(t.email, pw);
        await backend.write([{ type: 'merge', path: ['users', t.id], data: { mustChangePassword: true } }]);
        setNewPw(pw);
      } else {
        await backend.resetPassword(t.email);
        toast(`${t.email} এ পাসওয়ার্ড বদলানোর লিংক পাঠানো হয়েছে`);
      }
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <div className="space-y-6 pt-1">
      <div className="flex flex-col items-center text-center">
        <Avatar name={t.name} seed={t.id} size={76} rounded="rounded-full" />
        <div className="mt-3 flex gap-1.5">
          {t.active === false ? <Badge tone="slate">নিষ্ক্রিয়</Badge> : <Badge tone="green">সক্রিয়</Badge>}
          {cls && <Badge tone="brand">{cls.name}</Badge>}
        </div>
        {t.phone && (
          <a href={`tel:${t.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-600">
            <Phone className="h-4 w-4" /> {t.phone}
          </a>
        )}
      </div>

      {t.active !== false && (
        <section>
          <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-400">ক্লাসের দায়িত্ব</p>
          <div className="space-y-2">
            <TeacherOption selected={!t.classId} onClick={() => t.classId && assign(null)} title="কোনো ক্লাস নয়" />
            {classes.map((c) => {
              const taken = c.inchargeUid && c.inchargeUid !== t.id;
              return (
                <TeacherOption
                  key={c.id}
                  selected={t.classId === c.id}
                  onClick={() => t.classId !== c.id && assign(c.id)}
                  title={c.name}
                  sub={taken ? `এখন ${c.inchargeName || 'অন্য শিক্ষক'} — বদলে যাবে` : [c.section, c.id].filter(Boolean).join(' · ')}
                  warn={taken}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400">তথ্য</p>
        <Field label="নাম">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="পদবি">
            <Input value={f.designation} onChange={set('designation')} />
          </Field>
          <Field label="মোবাইল">
            <Input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Button variant="soft" block onClick={saveInfo}>
          তথ্য সংরক্ষণ
        </Button>
      </section>

      <section className="space-y-2.5">
        <p className="text-[13px] font-bold uppercase tracking-wide text-slate-400">অ্যাকাউন্ট</p>
        {t.loginId && (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <IdCard className="h-5 w-5 text-slate-400" />
            <span className="flex-1 text-[14px] text-slate-600">লগইন আইডি</span>
            <span className="tabular text-[16px] font-extrabold tracking-wide text-ink">{t.loginId}</span>
          </div>
        )}
        <p className="px-1 text-[13px] text-slate-500">
          {hasRecovery ? `রিকভারি ইমেইল: ${t.email}` : 'রিকভারি ইমেইল নেই — শিক্ষক মেনু থেকে নিজে যোগ করতে পারবেন।'}
          {t.mustChangePassword ? ' · এখনো প্রথম পাসওয়ার্ড বদলানো হয়নি' : ''}
        </p>
        {(isLocal || hasRecovery) && (
          <Button variant="secondary" icon={KeyRound} block onClick={resetPw}>
            {isLocal ? 'নতুন পাসওয়ার্ড দিন' : 'পাসওয়ার্ড রিসেট লিংক পাঠান'}
          </Button>
        )}
        {!isLocal && !hasRecovery && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
            পাসওয়ার্ড ভুলে গেলে: নতুন শিক্ষক অ্যাকাউন্ট (নতুন আইডি) তৈরি করে ক্লাসের দায়িত্ব সেখানে দিন, তারপর এই অ্যাকাউন্ট নিষ্ক্রিয় করুন। ক্লাসের সব তথ্য ঠিক থাকবে।
          </p>
        )}
        {newPw && <LoginInfo info={{ ...t, password: newPw, className: cls?.name }} />}
        <Button variant={t.active === false ? 'soft-success' : 'soft-danger'} icon={Power} block onClick={toggleActive}>
          {t.active === false ? 'অ্যাকাউন্ট চালু করুন' : 'অ্যাকাউন্ট নিষ্ক্রিয় করুন'}
        </Button>
      </section>
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function PrincipalSettings({ institution, profile, onOpenPortal, onSignOut }) {
  const { updateMyProfile } = useAuth();
  const { toast, confirm } = useUI();
  const [inst, setInst] = useState({ name: institution?.name || '', address: institution?.address || '' });
  const [me, setMe] = useState({ name: profile?.name || '', phone: profile?.phone || '' });
  const [counter, setCounter] = useState(undefined);
  const [prefix, setPrefix] = useState(null); // null = not edited
  const [account, setAccount] = useState(null);
  useEffect(() => backend.subscribeDoc(STAFF_COUNTER_PATH, setCounter), []);
  const savedPrefix = counter?.prefix || DEFAULT_STAFF_PREFIX;
  const prefixValue = prefix ?? savedPrefix;
  const prefixOk = /^[A-Z]{1,4}$/.test(prefixValue);
  const dirty =
    inst.name !== (institution?.name || '') || inst.address !== (institution?.address || '') || me.name !== (profile?.name || '') ||
    me.phone !== (profile?.phone || '') || prefixValue !== savedPrefix;

  const save = async () => {
    if (!prefixOk) return toast('আইডির শুরুতে ১–৪টি ইংরেজি বড় হাতের অক্ষর দিন', 'error');
    const ops = [{ type: 'merge', path: ['meta', 'institution'], data: inst }];
    // A new prefix starts its own numbering (e.g. XI001 after T005)
    if (prefixValue !== savedPrefix) ops.push({ type: 'set', path: STAFF_COUNTER_PATH, data: { prefix: prefixValue, last: 0 } });
    await backend.write(ops);
    await updateMyProfile(me);
    setPrefix(null);
    toast('সংরক্ষিত হয়েছে');
  };

  return (
    <div>
      <PageHeader title="সেটিংস" subtitle="প্রতিষ্ঠান ও আপনার প্রোফাইল" />
      <div className="space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0">
        <Card className="space-y-4 p-4">
          <p className="flex items-center gap-2 text-[15.5px] font-bold text-ink">
            <Building2 className="h-5 w-5 text-brand-600" /> প্রতিষ্ঠান
          </p>
          <Field label="প্রতিষ্ঠানের নাম" hint="রশিদ, রিপোর্ট ও শিক্ষার্থী পোর্টালে দেখাবে">
            <Input value={inst.name} onChange={(e) => setInst((x) => ({ ...x, name: e.target.value }))} />
          </Field>
          <Field label="ঠিকানা">
            <Input value={inst.address} onChange={(e) => setInst((x) => ({ ...x, address: e.target.value }))} />
          </Field>
        </Card>
        <Card className="space-y-4 p-4">
          <p className="flex items-center gap-2 text-[15.5px] font-bold text-ink">
            <UserRound className="h-5 w-5 text-brand-600" /> আমার প্রোফাইল
          </p>
          <Field label="নাম">
            <Input value={me.name} onChange={(e) => setMe((x) => ({ ...x, name: e.target.value }))} />
          </Field>
          <Field label="মোবাইল">
            <Input type="tel" inputMode="tel" value={me.phone} onChange={(e) => setMe((x) => ({ ...x, phone: e.target.value }))} />
          </Field>
          <p className="text-[12.5px] text-slate-500">লগইন ইমেইল: {profile?.email}</p>
        </Card>
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-[15.5px] font-bold text-ink">
            <IdCard className="h-5 w-5 text-brand-600" /> শিক্ষকের লগইন আইডি
          </p>
          <Field label="আইডির শুরু" hint={`পরের শিক্ষকের আইডি হবে ${prefixOk ? formatStaffId(prefixValue, prefixValue === savedPrefix ? Number(counter?.last || 0) + 1 : 1) : '—'} — নম্বর আপনাআপনি বাড়ে`}>
            <Input
              value={prefixValue}
              maxLength={4}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="tabular tracking-widest"
            />
          </Field>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', isLocal ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
              <Database className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-ink">{isLocal ? 'পরীক্ষামূলক ডাটাবেজ' : 'Cloud (Firebase) সংযুক্ত'}</p>
              <p className="text-[12.5px] text-slate-500">
                {isLocal ? 'শুধু পরীক্ষার জন্য — তথ্য এই ব্রাউজারেই থাকে। আসল ব্যবহারের জন্য Firebase কী বসান।' : 'সব শিক্ষকের ফোনে একই তথ্য, ইন্টারনেট ছাড়াও কাজ করে।'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="divide-y divide-slate-100 overflow-hidden">
          <button type="button" onClick={onOpenPortal} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <UserRound className="h-5 w-5 text-slate-500" />
            <span className="flex-1 text-[15px] font-semibold text-ink">শিক্ষার্থী পোর্টাল দেখুন</span>
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </button>
          <button type="button" onClick={() => setAccount('password')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
            <KeyRound className="h-5 w-5 text-slate-500" />
            <span className="flex-1 text-[15px] font-semibold text-ink">পাসওয়ার্ড বদলান</span>
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </button>
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-rose-50">
            <LogOut className="h-5 w-5 text-rose-500" />
            <span className="flex-1 text-[15px] font-semibold text-rose-600">লগআউট</span>
          </button>
        </Card>
      </div>
      <AccountSheet kind={account} onClose={() => setAccount(null)} />

      {dirty && (
        <>
          <div className="h-20" />
          <div className={DOCK} style={DOCK_BOTTOM}>
            <div className="flex items-center gap-3 rounded-[22px] bg-ink/95 p-2 pl-4 text-white shadow-2xl backdrop-blur">
              <p className="flex-1 text-[14px] font-semibold">অসংরক্ষিত পরিবর্তন</p>
              <Button variant="success" size="sm" onClick={save}>
                সংরক্ষণ
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
