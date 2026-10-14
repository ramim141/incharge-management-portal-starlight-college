import React, { useMemo, useState } from 'react';
import {
  Phone, Pencil, Wallet, Trash2, UserRound, MapPin, CalendarDays, KeyRound, Hash, Users, Eye, EyeOff, ReceiptText,
  ChevronRight, RefreshCw, Undo2, Copy,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { StudentHistory } from './StudentHistory';
import { Sheet, RollBadge, Badge, Button, Segmented, InfoRow, Ring, Field, Input, PaidAtAdmission, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { feeStartLabel, randomPin, admissionPaidDefault } from '../lib/classLogic';
import {
  taka, monthBn, groupBn, fmtDate, feeBadge, feeStatus, ATT_STATUS, ATT_ORDER, GENDERS, sectionBn, genderBn, waLink, EN_MONTHS, todayISO, FINE_STATUS,
} from '../lib/format';

/* ───────────────────────── Student profile (admin) ───────────────────────── */

export function StudentDetailSheet() {
  const { studentId, closeStudent } = useUI();
  const { students } = useApp();
  const student = students.find((s) => s.id === studentId);
  return (
    <Sheet open={!!student} onClose={closeStudent} full>
      {student && <StudentDetail student={student} />}
    </Sheet>
  );
}

function StudentDetail({ student: s }) {
  const {
    fees, examFees, fines, payments, attendance, settings, getStudentAttendanceStats, calculateStudentTotalDue, deleteStudent, absenceFineFor, feeStartMonth, updateStudent, profile,
  } = useApp();
  const { openPayment, openStudentForm, openWhatsApp, openReceipt, openFine, confirm, toast, closeStudent } = useUI();
  const [tab, setTab] = useState('fees');
  const [showPin, setShowPin] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const [editingFee, setEditingFee] = useState(null);

  const att = getStudentAttendanceStats(s.id);
  const due = calculateStudentTotalDue(s.id);
  const sFees = useMemo(
    () =>
      fees
        // Months before the fee start were taken with admission — not listed, one note instead
        .filter((f) => f.studentId === s.id && !f.beforeStart)
        .sort((a, b) => Number(a.year) - Number(b.year) || EN_MONTHS.indexOf(a.month) - EN_MONTHS.indexOf(b.month)),
    [fees, s.id],
  );
  const sExams = examFees.filter((e) => e.studentId === s.id);
  const sFines = fines.filter((f) => f.studentId === s.id);
  const sPays = payments.filter((p) => p.studentId === s.id);
  // All of this student's fines: separate fines (absence…) + late fines on monthly fees
  const feeFines = sFees.filter((f) => Number(f.fine) > 0);
  const fineSummary = {
    total: sFines.reduce((a, f) => a + f.amount, 0) + feeFines.reduce((a, f) => a + f.fine, 0),
    waived: sFines.reduce((a, f) => a + f.waived, 0) + feeFines.reduce((a, f) => a + (f.fineWaived || 0), 0),
    due: sFines.reduce((a, f) => a + f.due, 0) + feeFines.reduce((a, f) => a + Math.min(f.fine - (f.fineWaived || 0), f.due), 0),
  };
  const attLog = Object.keys(attendance)
    .filter((d) => attendance[d]?.[s.id])
    .sort()
    .reverse()
    .map((d) => ({ date: d, status: attendance[d][s.id] }));

  const remove = async () => {
    const ok = await confirm({
      title: `${s.name} কে মুছবেন?`,
      message: 'এই শিক্ষার্থীর ফি, জরিমানা ও পরীক্ষার তথ্যও মুছে যাবে। এটি ফেরানো যাবে না।',
      confirmText: 'মুছে ফেলুন',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    await deleteStudent(s.id);
    closeStudent();
    toast('শিক্ষার্থী মুছে ফেলা হয়েছে');
  };

  // Forgotten / shared PIN: a fresh one; the old PIN stops working for the portal at once
  const newPin = async () => {
    const ok = await confirm({
      title: 'নতুন পিন তৈরি করবেন?',
      message: `${s.name}-এর আগের পিন দিয়ে আর পোর্টালে ঢোকা যাবে না। নতুন পিন শিক্ষার্থী/অভিভাবককে জানাতে হবে।`,
      confirmText: 'নতুন পিন',
      icon: KeyRound,
    });
    if (!ok) return;
    let pin = randomPin();
    while (pin === String(s.pin)) pin = randomPin();
    await updateStudent(s.id, { pin });
    setShowPin(true);
    toast(`নতুন পিন: ${pin}`);
  };

  const portalUrl = `${window.location.origin}/?roll=${encodeURIComponent(s.roll)}`;
  const portalShareMessage = [
    'প্রিয় অভিভাবক,',
    `${s.name}-এর বেতন, হাজিরা ও রশিদ অনলাইনে দেখতে নিচের লিংকে প্রবেশ করুন:`,
    portalUrl,
    '',
    `ক্লাস: ${settings.className}`,
    `রোল: ${s.roll}`,
    `পিন: ${s.pin}`,
    '',
    '(পিনটি গোপন রাখুন)',
    `— ${profile?.name || settings.inchargeName}`,
    `শ্রেণি ইনচার্জ, ${settings.className} (${settings.institutionName || 'স্টারলাইট কলেজ'})`,
  ].join('\n');

  const copyPortalInfo = async () => {
    try {
      await navigator.clipboard.writeText(portalShareMessage);
      toast('পোর্টাল লিংক ও পিন কপি হয়েছে');
    } catch {
      toast('কপি করা যায়নি', 'error');
    }
  };

  const [contactModal, setContactModal] = useState(null); // 'call' | 'whatsapp' | null
  const hasGuardian = Boolean(s.guardianPhone);
  const hasStudent = Boolean(s.studentPhone);

  const handleCall = () => {
    if (hasGuardian && hasStudent) {
      setContactModal('call');
    } else if (hasGuardian) {
      window.location.href = `tel:${s.guardianPhone}`;
    } else if (hasStudent) {
      window.location.href = `tel:${s.studentPhone}`;
    } else {
      toast('মোবাইল নম্বর দেওয়া নেই', 'error');
    }
  };

  const handleWhatsApp = () => {
    if (!hasGuardian && !hasStudent) {
      toast('মোবাইল নম্বর দেওয়া নেই', 'error');
      return;
    }
    if (due > 0) {
      openWhatsApp([s]);
      return;
    }
    if (hasGuardian && hasStudent) {
      setContactModal('whatsapp');
    } else if (hasGuardian) {
      window.open(waLink(s.guardianPhone), '_blank');
    } else {
      window.open(waLink(s.studentPhone), '_blank');
    }
  };

  const actions = [
    {
      label: 'কল',
      icon: Phone,
      href: hasGuardian && !hasStudent ? `tel:${s.guardianPhone}` : !hasGuardian && hasStudent ? `tel:${s.studentPhone}` : undefined,
      onClick: (hasGuardian && hasStudent) || (!hasGuardian && !hasStudent) ? handleCall : undefined,
      cls: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'WhatsApp',
      icon: WhatsAppIcon,
      onClick: handleWhatsApp,
      cls: 'bg-emerald-50 text-emerald-600',
    },
    { label: 'আদায়', icon: Wallet, onClick: () => openPayment(s), cls: 'bg-brand-50 text-brand-600' },
    { label: 'এডিট', icon: Pencil, onClick: () => openStudentForm(s), cls: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="pt-1">
      <div className="flex items-center gap-4">
        <RollBadge roll={s.roll} seed={s.id} size={68} rounded="rounded-3xl" className="shadow-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[20px] font-extrabold leading-tight text-ink">{s.name}</h2>
          {s.nameEn && <p className="truncate text-[13px] text-slate-500">{s.nameEn}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {groupBn(s.group) && <Badge tone="slate">{groupBn(s.group)}</Badge>}
            {sectionBn(s.section) && <Badge tone="slate">{sectionBn(s.section)}</Badge>}
            {settings.useGender !== false && genderBn(s.gender) && <Badge tone="slate">{genderBn(s.gender)}</Badge>}
            {s.status === 'inactive' && <Badge tone="red">নিষ্ক্রিয়</Badge>}
            {s.transport && <Badge tone="brand">পরিবহন</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          const inner = (
            <>
              <Icon className="h-5 w-5" />
              <span className="text-[12px] font-semibold">{a.label}</span>
            </>
          );
          const cls = cx('press flex flex-col items-center gap-1 rounded-2xl py-3', a.cls);
          return a.href ? (
            <a key={a.label} href={a.href} className={cls}>
              {inner}
            </a>
          ) : (
            <button key={a.label} type="button" onClick={a.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className={cx('rounded-3xl p-4', due > 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
          <p className={cx('text-[12.5px] font-semibold', due > 0 ? 'text-rose-700' : 'text-emerald-700')}>মোট বকেয়া</p>
          <p className={cx('tabular mt-0.5 text-[24px] font-extrabold leading-tight', due > 0 ? 'text-rose-600' : 'text-emerald-600')}>{taka(due)}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">{due > 0 ? 'বেতন · জরিমানা · পরীক্ষা' : 'সব পরিশোধিত ✓'}</p>
        </div>
        <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-4">
          <Ring value={att.percentage} size={54} tone={att.percentage >= 75 ? 'green' : 'red'}>
            <span className="tabular text-[12.5px] font-extrabold text-ink">{Math.round(att.percentage)}%</span>
          </Ring>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-slate-600">হাজিরা</p>
            <p className="tabular text-[12.5px] text-slate-500">
              {att.present}/{att.totalClasses} দিন
            </p>
            {att.absent > 0 && <p className="tabular text-[12px] font-semibold text-rose-600">অনুপস্থিত {att.absent}</p>}
          </div>
        </div>
      </div>

      <Segmented
        className="mt-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'fees', label: 'ফি' },
          { value: 'att', label: 'হাজিরা' },
          { value: 'history', label: 'ইতিহাস' },
          { value: 'info', label: 'তথ্য' },
        ]}
      />

      {tab === 'fees' && (
        <div className="mt-4 space-y-5">
          {fineSummary.total > 0 && (
            <div className="rounded-3xl bg-rose-50/60 p-4 ring-1 ring-rose-100">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['মোট জরিমানা', fineSummary.total, 'text-ink'],
                  ['মওকুফ', fineSummary.waived, 'text-slate-500'],
                  ['বাকি জরিমানা', fineSummary.due, fineSummary.due > 0 ? 'text-rose-600' : 'text-emerald-600'],
                ].map(([k, v, c]) => (
                  <div key={k}>
                    <p className={cx('tabular text-[17px] font-extrabold', c)}>{taka(v)}</p>
                    <p className="text-[11.5px] text-slate-500">{k}</p>
                  </div>
                ))}
              </div>
              {fineSummary.due > 0 && (
                <Button variant="secondary" size="sm" icon={Undo2} block className="mt-3" onClick={() => setWaiving(true)}>
                  জরিমানা মওকুফ
                </Button>
              )}
            </div>
          )}
          <section>
            <p className="mb-2 text-[13px] font-bold tracking-wide text-slate-400">মাসিক বেতন</p>
            {feeStartMonth && (
              <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-medium text-emerald-700">✓ {feeStartLabel(feeStartMonth)} ভর্তি শুরুর মাস — প্রথম মাসের বেতন ভর্তির সময় নেওয়া হয়েছে (বেতন হয়ে গেছে)</p>
            )}
            {sFees.length === 0 && <Empty text={feeStartMonth ? `${feeStartLabel(feeStartMonth)} থেকে বেতন শুরু` : 'কোনো রেকর্ড নেই'} />}
            <div className="space-y-2">
              {sFees.map((f) => {
                const st = feeStatus(f);
                const tr = Number(f.transport) || 0;
                const owes = st !== 'Paid' && Number(f.due) > 0;
                return (
                  <div key={f.id} className={cx('rounded-2xl p-3.5', st === 'Paid' ? 'bg-slate-50' : 'bg-white shadow-card ring-1 ring-slate-200')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-ink">
                        {monthBn(f.month)} {f.year}
                      </p>
                      <Badge tone={feeBadge(f, st).tone} dot>
                        {feeBadge(f, st).bn}
                      </Badge>
                    </div>
                    <div className="tabular mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-slate-500">
                      <span>বেতন {taka(f.amount - tr)}</span>
                      {tr > 0 && <span>পরিবহন {taka(tr)}</span>}
                      {f.fine ? <span>জরিমানা {taka(f.fine)}{f.fineWaived ? ` (মওকুফ ${taka(f.fineWaived)})` : ''}</span> : null}
                      <span>দিয়েছে {taka(f.paid)}</span>
                    </div>
                    {owes && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <p className="tabular flex-1 text-[14px] font-bold text-rose-600">বাকি {taka(f.due)}</p>
                        <button type="button" onClick={() => setEditingFee(f)} aria-label="ফি সম্পাদনা" className="press grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => openPayment(s)} className="press h-9 rounded-xl bg-brand-600 px-4 text-[13px] font-bold text-white">
                          আদায়
                        </button>
                      </div>
                    )}
                    {f.reason && (
                      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                        <span className="font-semibold">কারণ:</span> {f.reason}
                        {f.note ? ` — ${f.note}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {sExams.length > 0 && (
            <Group title="পরীক্ষার ফি">
              {sExams.map((e) => (
                <Row key={e.id} title={e.examName} sub={e.paymentDate ? `পরিশোধ ${fmtDate(e.paymentDate)}` : 'এখনো পরিশোধ হয়নি'}>
                  <p className="tabular text-[14px] font-bold text-ink">{taka(e.amount)}</p>
                  <Badge tone={e.status === 'Paid' ? 'green' : 'red'}>{e.status === 'Paid' ? 'পরিশোধিত' : 'বাকি'}</Badge>
                </Row>
              ))}
            </Group>
          )}

          {sFines.length > 0 && (
            <Group title="জরিমানা">
              {sFines.map((f) => (
                <button key={f.id} type="button" onClick={() => openFine(f.id)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{f.reason}</p>
                    <p className="tabular text-[12.5px] text-slate-500">
                      {fmtDate(f.date)}
                      {f.waived > 0 && f.status === 'Active' ? ` · মওকুফ ${taka(f.waived)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className={cx('tabular text-[14px] font-bold', f.status === 'Active' ? 'text-rose-600' : 'text-slate-400 line-through')}>
                      {taka(f.status === 'Active' ? f.due : f.amount)}
                    </p>
                    <Badge tone={FINE_STATUS[f.status].tone}>{FINE_STATUS[f.status].bn}</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </Group>
          )}

          <Group title="পেমেন্ট রশিদ">
            {sPays.length === 0 && <Empty text="এখনো কোনো পেমেন্ট নেই" />}
            {sPays.map((p) => (
              <button key={p.id} type="button" onClick={() => openReceipt(p)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tabular block text-[14px] font-semibold text-ink">{p.receiptNo}</span>
                  <span className="block text-[12.5px] text-slate-500">
                    {fmtDate(p.paymentDate)} · {p.method}
                  </span>
                </span>
                <span className="tabular text-[15px] font-bold text-emerald-600">{taka(p.amount)}</span>
              </button>
            ))}
          </Group>
        </div>
      )}

      {tab === 'att' && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {ATT_ORDER.map((k) => (
              <div key={k} className="rounded-2xl bg-slate-50 py-3 text-center">
                <p className="tabular text-[20px] font-extrabold text-ink">{att[k.toLowerCase()]}</p>
                <p className="text-[12px] text-slate-500">{ATT_STATUS[k].bn}</p>
              </div>
            ))}
          </div>
          {attLog.length === 0 ? <Empty text="হাজিরার রেকর্ড নেই" /> : <AttCalendar log={attLog} />}
        </div>
      )}

      {tab === 'history' && <StudentHistory student={s} />}

      {tab === 'info' && (
        <div className="mt-4 space-y-4">
          <InfoCard title="পরিচয়">
            <InfoRow icon={Hash} label="স্টুডেন্ট আইডি" value={s.studentId} mono />
            <InfoRow icon={CalendarDays} label="ভর্তির তারিখ" value={fmtDate(s.admissionDate)} />
            {s.studentPhone && <InfoRow icon={Phone} label="শিক্ষার্থীর নিজস্ব ফোন" value={s.studentPhone} mono />}
          </InfoCard>
          <InfoCard title="অভিভাবক">
            <InfoRow icon={UserRound} label="পিতার নাম" value={s.fatherName} />
            <InfoRow icon={Users} label="মাতার নাম" value={s.motherName} />
            <InfoRow icon={Phone} label="অভিভাবকের ফোন" value={s.guardianPhone} mono />
            <InfoRow icon={MapPin} label="ঠিকানা" value={s.address} />
          </InfoCard>
          <InfoCard title="ফি">
            <InfoRow icon={Wallet} label="মাসিক বেতন" value={taka(s.tuitionFee ?? (s.monthlyFee || settings.defaultMonthlyFee))} />
            {s.transport && Number(s.transportFee) > 0 && <InfoRow icon={Wallet} label="পরিবহন ফি" value={`${taka(s.transportFee)} / মাস`} />}
            <InfoRow
              icon={CalendarDays}
              label="অনুপস্থিতির জরিমানা (প্রতি দিন)"
              value={`${taka(absenceFineFor(s))}${s.absentFine === '' || s.absentFine == null ? ' · ক্লাসের নিয়ম' : ''}`}
            />
          </InfoCard>

          <InfoCard title="পোর্টাল">
            <div className="flex items-center gap-3 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <KeyRound className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1">
                <p className="text-[12.5px] text-slate-500">পোর্টাল পিন</p>
                <p className="tabular text-[15px] font-semibold tracking-[0.3em] text-ink">{showPin ? s.pin : '••••'}</p>
              </div>
              <button type="button" onClick={() => setShowPin((v) => !v)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 active:bg-slate-100" aria-label="পিন দেখুন">
                {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              <Button variant="secondary" size="xs" icon={RefreshCw} onClick={newPin}>
                নতুন পিন
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 py-3">
              {s.guardianPhone && (
                <Button
                  as="a"
                  variant="soft-success"
                  size="sm"
                  className="flex-1 min-w-[130px]"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={waLink(s.guardianPhone, portalShareMessage)}
                >
                  <WhatsAppIcon className="h-4 w-4" /> {s.studentPhone ? 'অভিভাবককে পাঠান' : 'পিন ও লিংক পাঠান'}
                </Button>
              )}
              {s.studentPhone && (
                <Button
                  as="a"
                  variant="soft-success"
                  size="sm"
                  className="flex-1 min-w-[130px]"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={waLink(s.studentPhone, portalShareMessage)}
                >
                  <WhatsAppIcon className="h-4 w-4" /> শিক্ষার্থীকে পাঠান
                </Button>
              )}
              <Button type="button" variant="secondary" size="sm" icon={Copy} className={(!s.guardianPhone && !s.studentPhone) ? 'flex-1' : ''} onClick={copyPortalInfo}>
                কপি
              </Button>
            </div>
          </InfoCard>

          <Button variant="soft-danger" icon={Trash2} block onClick={remove}>
            শিক্ষার্থী মুছে ফেলুন
          </Button>
        </div>
      )}
      <Sheet open={waiving} onClose={() => setWaiving(false)} title="জরিমানা মওকুফ" subtitle={`${s.name} · রোল ${s.roll}`}>
        {waiving && <WaiveForm student={s} due={fineSummary.due} onDone={() => setWaiving(false)} />}
      </Sheet>
      <Sheet
        open={!!contactModal}
        onClose={() => setContactModal(null)}
        title={contactModal === 'call' ? 'কাকে কল করবেন?' : 'WhatsApp-এ কাকে মেসেজ পাঠাবেন?'}
        subtitle={`${s.name} · রোল ${s.roll}`}
      >
        <div className="space-y-2.5 pt-2">
          {s.guardianPhone && (
            <a
              href={contactModal === 'call' ? `tel:${s.guardianPhone}` : waLink(s.guardianPhone)}
              target={contactModal === 'call' ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => setContactModal(null)}
              className="press flex items-center justify-between rounded-2xl bg-sky-50/70 p-3.5 ring-1 ring-sky-100 hover:bg-sky-100/70 transition"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700 font-bold text-[18px]">
                  👨‍👦
                </span>
                <div>
                  <p className="text-[14.5px] font-bold text-sky-950">অভিভাবক</p>
                  <p className="tabular text-[13px] text-sky-700">{s.guardianPhone}</p>
                </div>
              </div>
              <span className="rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-bold text-sky-700 shadow-sm">
                {contactModal === 'call' ? 'কল দিন' : 'WhatsApp'}
              </span>
            </a>
          )}
          {s.studentPhone && (
            <a
              href={contactModal === 'call' ? `tel:${s.studentPhone}` : waLink(s.studentPhone)}
              target={contactModal === 'call' ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => setContactModal(null)}
              className="press flex items-center justify-between rounded-2xl bg-emerald-50/70 p-3.5 ring-1 ring-emerald-100 hover:bg-emerald-100/70 transition"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 font-bold text-[18px]">
                  🎓
                </span>
                <div>
                  <p className="text-[14.5px] font-bold text-emerald-950">শিক্ষার্থী (নিজস্ব)</p>
                  <p className="tabular text-[13px] text-emerald-700">{s.studentPhone}</p>
                </div>
              </div>
              <span className="rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-bold text-emerald-700 shadow-sm">
                {contactModal === 'call' ? 'কল দিন' : 'WhatsApp'}
              </span>
            </a>
          )}
        </div>
      </Sheet>
      {editingFee && (
        <FeeEditSheet
          key={editingFee.id}
          fee={editingFee}
          student={s}
          open={!!editingFee}
          onClose={() => setEditingFee(null)}
        />
      )}
    </div>
  );
}

function FeeEditSheet({ fee, student, open, onClose }) {
  const { updateFee } = useApp();
  const { toast } = useUI();
  const [amount, setAmount] = useState(() => String(fee?.amount ?? ''));
  const [reason, setReason] = useState(() => fee?.reason || '');
  const [note, setNote] = useState(() => fee?.note || '');
  const [saving, setSaving] = useState(false);

  if (!fee) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const patch = { reason, note };
    if (amount !== '' && !isNaN(Number(amount))) {
      patch.amount = Math.max(0, Number(amount));
    }
    await updateFee(fee.id, patch);
    setSaving(false);
    toast(`${monthBn(fee.month)} মাসের ফি আপডেট হয়েছে`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${monthBn(fee.month)} ${fee.year} ফি সম্পাদনা`}
      subtitle={`${student?.name || ''} (রোল ${fee.roll})`}
    >
      <div className="space-y-4 pt-1">
        <Field label="ফি-এর পরিমাণ (৳)">
          <Input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        {fee.paid > 0 && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
            ইতিমধ্যে {taka(fee.paid)} পরিশোধ হয়েছে
          </p>
        )}
        <Field label="ফি না দেওয়ার / কমানোর কারণ">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="যেমন: বিশেষ ছাড় বা মওকুফ"
          />
        </Field>
        <Field label="নোট (ঐচ্ছিক)">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="অতিরিক্ত মন্তব্য"
          />
        </Field>
        <Button block size="lg" onClick={save} disabled={saving}>
          সংরক্ষণ করুন
        </Button>
      </div>
    </Sheet>
  );
}

/** Waive part of a student's fines (e.g. approved by the principal); taken off oldest fines first */
function WaiveForm({ student, due, onDone }) {
  const { waiveStudentFines } = useApp();
  const { toast } = useUI();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount) || 0;

  const save = async () => {
    if (n <= 0 || n > due || busy) return;
    setBusy(true);
    const w = await waiveStudentFines(student.id, n, note.trim());
    toast(`${taka(w)} জরিমানা মওকুফ হয়েছে`);
    onDone();
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-2xl bg-slate-50 p-4 text-center">
        <p className="text-[12.5px] text-slate-500">এখন বাকি জরিমানা</p>
        <p className="tabular text-[24px] font-extrabold text-rose-600">{taka(due)}</p>
      </div>
      <Field label="কত টাকা মওকুফ" hint="পুরোনো জরিমানা থেকে আগে বাদ যাবে" error={n > due ? `সর্বোচ্চ ${taka(due)}` : ''}>
        <Input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="যেমন 300" autoFocus />
      </Field>
      <div className="-mt-2 flex gap-2">
        {[Math.round(due / 2), due].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
          <button key={v} type="button" onClick={() => setAmount(String(v))} className={cx('press flex-1 rounded-xl py-2 text-[13.5px] font-bold transition', n === v ? 'bg-brand-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 border border-slate-200/60')}>
            {v === due ? `সব (${taka(v)})` : `অর্ধেক (${taka(v)})`}
          </button>
        ))}
      </div>
      <Field label="কারণ (ঐচ্ছিক)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন অধ্যক্ষের অনুমতিতে" />
      </Field>
      {n > 0 && n <= due && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13.5px] text-emerald-800">
          মওকুফের পর বাকি জরিমানা: <b className="tabular">{taka(due - n)}</b>
        </p>
      )}
      <Button size="lg" block icon={Undo2} disabled={n <= 0 || n > due || busy} onClick={save}>
        {busy ? 'সংরক্ষণ হচ্ছে…' : `${taka(n)} মওকুফ করুন`}
      </Button>
    </div>
  );
}

const Group = ({ title, children }) => (
  <div>
    <p className="mb-1 text-[13px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
    <div className="divide-y divide-slate-100">{children}</div>
  </div>
);
const Row = ({ title, sub, children }) => (
  <div className="flex items-center gap-3 py-3">
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
      {sub && <p className="text-[12.5px] text-slate-500">{sub}</p>}
    </div>
    <div className="flex flex-col items-end gap-1">{children}</div>
  </div>
);
const CAL_CELL = {
  Present: 'bg-emerald-500 text-white',
  Absent: 'bg-rose-500 text-white',
  Late: 'bg-amber-400 text-white',
  Leave: 'bg-sky-500 text-white',
};
const WEEK_BN = ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'];

/** Month calendar: one box per day, coloured by that day's attendance (log is newest first) */
function AttCalendar({ log }) {
  const byDate = useMemo(() => Object.fromEntries(log.map((r) => [r.date, r.status])), [log]);
  const [ym, setYm] = useState(() => {
    const [y, m] = log[0].date.split('-').map(Number);
    return { y, m: m - 1 };
  });
  const [picked, setPicked] = useState(null);

  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const pad2 = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
  const oldest = log[log.length - 1].date.slice(0, 7);
  const newest = log[0].date.slice(0, 7);
  const cur = `${ym.y}-${pad2(ym.m + 1)}`;
  const go = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(null);
  };
  const monthCount = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  for (let d = 1; d <= days; d += 1) {
    const st = byDate[keyOf(d)];
    if (st) monthCount[st] += 1;
  }

  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="আগের মাস" disabled={cur <= oldest} onClick={() => go(-1)} className="press grid h-9 w-9 place-items-center rounded-xl text-slate-500 active:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <p className="text-[15px] font-bold text-ink">
          {monthBn(EN_MONTHS[ym.m])} {ym.y}
        </p>
        <button type="button" aria-label="পরের মাস" disabled={cur >= newest} onClick={() => go(1)} className="press grid h-9 w-9 place-items-center rounded-xl text-slate-500 active:bg-slate-100 disabled:opacity-30">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_BN.map((w) => (
          <p key={w} className="pb-0.5 text-center text-[11.5px] font-semibold text-slate-400">
            {w}
          </p>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const k = keyOf(d);
          const st = byDate[k];
          return (
            <button
              key={k}
              type="button"
              disabled={!st}
              onClick={() => setPicked(k)}
              className={cx(
                'tabular grid aspect-square place-items-center rounded-lg text-[13px] font-bold transition',
                st ? CAL_CELL[st] : 'bg-slate-50 text-slate-300',
                picked === k && 'ring-2 ring-ink ring-offset-1',
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {ATT_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cx('h-3 w-3 rounded', CAL_CELL[k].split(' ')[0])} />
            {ATT_STATUS[k].bn} <b className="tabular text-slate-700">{monthCount[k]}</b>
          </span>
        ))}
      </div>
      {picked && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[13.5px] font-semibold text-ink">
          {fmtDate(picked)} — {ATT_STATUS[byDate[picked]]?.bn}
        </p>
      )}
    </div>
  );
}

const InfoCard = ({ title, children }) => (
  <section>
    <p className="mb-1.5 px-1 text-[13px] font-bold tracking-wide text-slate-400">{title}</p>
    <div className="divide-y divide-slate-100 rounded-3xl bg-slate-50 px-4">{children}</div>
  </section>
);
const Empty = ({ text }) => <p className="py-3 text-[14px] text-slate-400">{text}</p>;

/* ───────────────────────── Add / edit student ───────────────────────── */

export function StudentFormSheet() {
  const { studentForm, closeStudentForm } = useUI();
  const { settings } = useApp();
  const editing = studentForm?.student;
  return (
    <Sheet
      open={!!studentForm}
      onClose={closeStudentForm}
      full
      title={editing ? 'তথ্য সম্পাদনা' : 'নতুন শিক্ষার্থী'}
      subtitle={editing ? `রোল ${editing.roll} · ${editing.name}` : `${settings.className} · নতুন ভর্তি`}
    >
      {studentForm && <StudentForm editing={editing} />}
    </Sheet>
  );
}

function StudentForm({ editing }) {
  const { students, settings, addStudent, updateStudent, isBeforeStart, feeStartMonth } = useApp();
  const { closeStudentForm, toast, openStudent } = useUI();
  const departments = settings.departments || [];
  const sections = settings.sections || [];

  const [tab, setTab] = useState('basic'); // 'basic' | 'fees' | 'guardian' | 'all'
  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        ...editing,
        // monthlyFee stored on the student is the total (tuition + transport); the form edits the parts
        monthlyFee: editing.tuitionFee ?? (editing.monthlyFee != null && editing.monthlyFee !== '' ? editing.monthlyFee : settings.defaultMonthlyFee),
        transport: !!editing.transport,
        transportFee: editing.transportFee ?? '',
        absentFine: editing.absentFine ?? '',
        studentPhone: editing.studentPhone ?? '',
      };
    }
    const nextRoll = students.length ? Math.max(...students.map((s) => Number(s.roll) || 100)) + 1 : 101;
    return {
      name: '',
      nameEn: '',
      roll: nextRoll,
      group: departments[0]?.id || '',
      section: sections[0]?.id || '',
      gender: 'Male',
      fatherName: '',
      motherName: '',
      guardianPhone: '',
      studentPhone: '',
      address: '',
      admissionDate: todayISO(),
      monthlyFee: settings.defaultMonthlyFee,
      transport: false,
      transportFee: '',
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      status: 'active',
      absentFine: '',
    };
  });
  const [errors, setErrors] = useState({});
  const [paidAtAdmission, setPaidAtAdmission] = useState(() => admissionPaidDefault(feeStartMonth));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    const err = {};
    if (!String(form.name).trim()) err.name = 'নাম লিখুন';
    if (!form.roll) err.roll = 'রোল দিন';
    else if (students.some((s) => Number(s.roll) === Number(form.roll) && s.id !== editing?.id)) err.roll = 'এই রোল আগে থেকেই আছে';
    if (form.guardianPhone && !/^01\d{9}$/.test(String(form.guardianPhone).replace(/[^0-9]/g, '').replace(/^88/, '')))
      err.guardianPhone = '১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)';
    if (form.studentPhone && !/^01\d{9}$/.test(String(form.studentPhone).replace(/[^0-9]/g, '').replace(/^88/, '')))
      err.studentPhone = '১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)';
    if (!/^\d{4,6}$/.test(String(form.pin))) err.pin = '৪–৬ সংখ্যার পিন দিন';
    if (form.absentFine !== '' && form.absentFine != null && !(Number(form.absentFine) >= 0)) err.absentFine = 'সঠিক পরিমাণ দিন';
    if (form.transport && !(Number(form.transportFee) > 0)) err.transportFee = 'পরিবহন ফি দিন';
    setErrors(err);
    if (Object.keys(err).length) {
      if (err.name || err.roll) setTab('basic');
      else if (err.pin || err.transportFee || err.absentFine) setTab('fees');
      else if (err.guardianPhone || err.studentPhone) setTab('guardian');
      return;
    }

    const { avatar: _photo, ...rest } = form;
    const absentFine = rest.absentFine === '' || rest.absentFine == null ? '' : Number(rest.absentFine);
    const tuitionFee = form.monthlyFee === '' || form.monthlyFee == null ? Number(settings.defaultMonthlyFee) : Number(form.monthlyFee);
    const transportFee = form.transport ? Number(form.transportFee) : 0;
    const guardianPhone = form.guardianPhone ? String(form.guardianPhone).replace(/[^0-9]/g, '').replace(/^88/, '') : '';
    const studentPhone = form.studentPhone ? String(form.studentPhone).replace(/[^0-9]/g, '').replace(/^88/, '') : '';
    // Every fee row uses monthlyFee, so transport is simply part of the monthly total
    const data = {
      ...rest,
      guardianPhone,
      studentPhone,
      roll: Number(form.roll),
      tuitionFee,
      transport: !!form.transport,
      transportFee,
      monthlyFee: tuitionFee + transportFee,
      absentFine,
    };
    if (editing?.avatar) data.avatar = '';
    if (editing) {
      await updateStudent(editing.id, data);
      toast('তথ্য আপডেট হয়েছে');
      closeStudentForm();
    } else {
      const created = await addStudent(data, { paidAtAdmission });
      toast(`${created.name} যুক্ত হয়েছে`);
      closeStudentForm();
      setTimeout(() => openStudent(created), 80);
    }
  };

  const TAB_OPTIONS = [
    { value: 'basic', label: 'মূল তথ্য' },
    { value: 'fees', label: 'ফি ও পোর্টাল' },
    { value: 'guardian', label: 'অভিভাবক ও ফোন' },
    { value: 'all', label: 'সব তথ্য' },
  ];

  return (
    <div className="space-y-3 pt-1">


      {/* Sub-tabs to jump directly to any section without long scrolling */}
      <Segmented value={tab} onChange={setTab} options={TAB_OPTIONS} />

      {/* Section 1: Basic Info */}
      {(tab === 'basic' || tab === 'all') && (
        <FormSection icon={UserRound} title="মূল তথ্য" compact={tab !== 'all'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="নাম (বাংলায়) *" error={errors.name}>
              <Input value={form.name} onChange={set('name')} placeholder="যেমন মো: রহিম আহমেদ" />
            </Field>
            <Field label="Name (English)">
              <Input value={form.nameEn || ''} onChange={set('nameEn')} placeholder="e.g. Md. Rahim Ahmed" autoCapitalize="words" />
            </Field>
            <Field label="রোল *" error={errors.roll}>
              <Input type="number" inputMode="numeric" value={form.roll} onChange={set('roll')} />
            </Field>
            {settings.useGender !== false && (
              <Field label="ছাত্র / ছাত্রী">
                <Segmented value={form.gender} onChange={set('gender')} options={GENDERS.map((g) => ({ value: g.id, label: g.bn }))} />
              </Field>
            )}
            {departments.length > 0 && (
              <Field label="বিভাগ" className={sections.length === 0 ? 'sm:col-span-2' : ''}>
                <Pills value={form.group} onChange={set('group')} options={departments} />
              </Field>
            )}
            {sections.length > 0 && (
              <Field label="শাখা">
                <Pills value={form.section} onChange={set('section')} options={sections} />
              </Field>
            )}
          </div>
        </FormSection>
      )}

      {/* Section 2: Fees & Portal */}
      {(tab === 'fees' || tab === 'all') && (
        <FormSection icon={Wallet} title="ফি ও পোর্টাল" compact={tab !== 'all'}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="মাসিক বেতন (৳)">
                <Input type="number" inputMode="numeric" value={form.monthlyFee} onChange={set('monthlyFee')} />
              </Field>
              <Field label="পোর্টাল পিন" error={errors.pin}>
                <Input inputMode="numeric" maxLength={6} value={form.pin} onChange={set('pin')} className="tracking-[0.3em]" />
              </Field>
              <Field label="পরিবহন ব্যবহার করে?">
                <Segmented
                  value={form.transport ? 'yes' : 'no'}
                  onChange={(v) => setForm((f) => ({ ...f, transport: v === 'yes' }))}
                  options={[
                    { value: 'no', label: 'না' },
                    { value: 'yes', label: 'হ্যাঁ' },
                  ]}
                />
              </Field>
              {form.transport ? (
                <Field label="পরিবহন ফি (৳/মাস)" error={errors.transportFee}>
                  <Input type="number" inputMode="numeric" min={0} value={form.transportFee} onChange={set('transportFee')} placeholder="যেমন 500" />
                </Field>
              ) : (
                <Field label="ভর্তির তারিখ">
                  <Input type="date" value={form.admissionDate || ''} onChange={set('admissionDate')} />
                </Field>
              )}
              {form.transport && (
                <Field label="ভর্তির তারিখ" className="sm:col-span-2">
                  <Input type="date" value={form.admissionDate || ''} onChange={set('admissionDate')} />
                </Field>
              )}
              <Field
                label="অনুপস্থিতির জরিমানা (৳/দিন)"
                error={errors.absentFine}
                hint={`ডিফল্ট ৳${settings.absentFine} · ০ দিলে জরিমানা নেই`}
              >
                <Input type="number" inputMode="numeric" min={0} value={form.absentFine ?? ''} onChange={set('absentFine')} placeholder={String(settings.absentFine)} />
              </Field>
              <Field label="অবস্থা">
                <Segmented
                  value={form.status}
                  onChange={set('status')}
                  options={[
                    { value: 'active', label: 'সক্রিয়' },
                    { value: 'inactive', label: 'নিষ্ক্রিয়' },
                  ]}
                />
              </Field>
            </div>
            {form.transport && (
              <div className="tabular flex justify-between rounded-xl bg-brand-50 px-3.5 py-2 text-[13px] text-brand-900">
                <span>মাসিক মোট প্রদেয় (বেতন + পরিবহন):</span>
                <b>{taka((Number(form.monthlyFee) || 0) + (Number(form.transportFee) || 0))}</b>
              </div>
            )}
          </div>
        </FormSection>
      )}

      {/* Section 3: Guardian & Contact */}
      {(tab === 'guardian' || tab === 'all') && (
        <FormSection icon={Users} title="অভিভাবক ও যোগাযোগ" compact={tab !== 'all'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="অভিভাবকের মোবাইল (WhatsApp)" error={errors.guardianPhone}>
              <Input type="tel" inputMode="tel" value={form.guardianPhone} onChange={set('guardianPhone')} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="শিক্ষার্থীর নিজস্ব মোবাইল (WhatsApp)" error={errors.studentPhone} hint="অভিভাবকের হোয়াটসঅ্যাপ না থাকলে মেসেজ পাঠানোর জন্য">
              <Input type="tel" inputMode="tel" value={form.studentPhone} onChange={set('studentPhone')} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="পিতার নাম">
              <Input value={form.fatherName} onChange={set('fatherName')} />
            </Field>
            <Field label="মাতার নাম">
              <Input value={form.motherName} onChange={set('motherName')} />
            </Field>
            <Field label="ঠিকানা" className="sm:col-span-2">
              <Input value={form.address} onChange={set('address')} placeholder="যেমন ধানমন্ডি, ঢাকা" />
            </Field>
          </div>
        </FormSection>
      )}

      {!editing && (
        <PaidAtAdmission
          checked={paidAtAdmission}
          onChange={setPaidAtAdmission}
          month={monthBn(settings.currentMonth)}
          beforeStart={isBeforeStart(settings.currentMonth, settings.currentYear)}
          startLabel={feeStartLabel(feeStartMonth)}
        />
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-5 border-t border-slate-100 bg-white/95 px-4 sm:px-5 pb-2 pt-3 backdrop-blur">
        <Button size="lg" block onClick={save}>
          {editing ? 'পরিবর্তন সংরক্ষণ' : 'শিক্ষার্থী যুক্ত করুন'}
        </Button>
      </div>
    </div>
  );
}

// Wrapping pills (not a scrolling chip row) so every department / section is visible at once
const Pills = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onChange(o.id)}
        className={cx(
          'press h-9.5 rounded-xl px-3.5 text-[13.5px] font-semibold transition',
          value === o.id
            ? 'bg-brand-600 text-white shadow-xs font-bold'
            : 'bg-white text-slate-700 border border-slate-200/90 shadow-xs hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        {o.bn}
      </button>
    ))}
  </div>
);

const FormSection = ({ icon: Icon, title, compact, children }) => (
  <section className={cx('rounded-2xl border border-slate-200/70 bg-slate-50/50 shadow-xs transition', compact ? 'p-3.5 sm:p-4' : 'p-4')}>
    <div className="mb-3 flex items-center gap-2">
      {Icon && (
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <p className="text-[14px] font-bold text-ink">{title}</p>
    </div>
    <div>{children}</div>
  </section>
);

