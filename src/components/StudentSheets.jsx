import React, { useMemo, useState } from 'react';
import {
  Phone, Pencil, Wallet, Trash2, UserRound, MapPin, CalendarDays, KeyRound, Hash, Users, Eye, EyeOff, ReceiptText,
  ChevronRight,
} from 'lucide-react';
import { useApp, studentIdFor } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, RollBadge, Badge, Button, Segmented, InfoRow, Ring, Field, Input, PaidAtAdmission, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { feeStartLabel } from '../lib/classLogic';
import {
  taka, monthBn, groupBn, fmtDate, FEE_STATUS, feeBadge, feeStatus, ATT_STATUS, ATT_ORDER, GENDERS, sectionBn, genderBn, waLink, ACADEMIC_MONTHS, todayISO, FINE_STATUS,
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
    fees, examFees, fines, payments, attendance, settings, getStudentAttendanceStats, calculateStudentTotalDue, deleteStudent, absenceFineFor, feeStartMonth,
  } = useApp();
  const { openPayment, openStudentForm, openWhatsApp, openReceipt, openFine, confirm, toast, closeStudent } = useUI();
  const [tab, setTab] = useState('fees');
  const [showPin, setShowPin] = useState(false);

  const att = getStudentAttendanceStats(s.id);
  const due = calculateStudentTotalDue(s.id);
  const sFees = useMemo(
    () =>
      fees
        // Months before the fee start were taken with admission — not listed, one note instead
        .filter((f) => f.studentId === s.id && !f.beforeStart)
        .sort((a, b) => a.year - b.year || ACADEMIC_MONTHS.indexOf(a.month) - ACADEMIC_MONTHS.indexOf(b.month)),
    [fees, s.id],
  );
  const sExams = examFees.filter((e) => e.studentId === s.id);
  const sFines = fines.filter((f) => f.studentId === s.id);
  const sPays = payments.filter((p) => p.studentId === s.id);
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

  const actions = [
    { label: 'কল', icon: Phone, href: `tel:${s.guardianPhone}`, cls: 'bg-sky-50 text-sky-600' },
    {
      label: 'WhatsApp',
      icon: WhatsAppIcon,
      onClick: () => (due > 0 ? openWhatsApp([s]) : window.open(waLink(s.guardianPhone), '_blank')),
      cls: 'bg-emerald-50 text-emerald-600',
    },
    { label: 'আদায়', icon: Wallet, onClick: () => openPayment(s), cls: 'bg-brand-50 text-brand-600' },
    { label: 'এডিট', icon: Pencil, onClick: () => openStudentForm(s), cls: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="pt-1">
      <div className="flex flex-col items-center text-center">
        <RollBadge roll={s.roll} seed={s.id} size={84} rounded="rounded-[28px]" className="shadow-lg" />
        <h2 className="mt-3 text-[21px] font-extrabold leading-tight text-ink">{s.name}</h2>
        {s.nameEn && <p className="text-[13.5px] text-slate-500">{s.nameEn}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {groupBn(s.group) && <Badge tone="slate">{groupBn(s.group)}</Badge>}
          {sectionBn(s.section) && <Badge tone="slate">{sectionBn(s.section)}</Badge>}
          {settings.useGender !== false && genderBn(s.gender) && <Badge tone="slate">{genderBn(s.gender)}</Badge>}
          {s.status === 'inactive' && <Badge tone="red">নিষ্ক্রিয়</Badge>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          const inner = (
            <>
              <span className={cx('grid h-12 w-12 place-items-center rounded-2xl', a.cls)}>
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <span className="text-[12.5px] font-semibold text-slate-700">{a.label}</span>
            </>
          );
          return a.href ? (
            <a key={a.label} href={a.href} className="press flex flex-col items-center gap-1.5">
              {inner}
            </a>
          ) : (
            <button key={a.label} type="button" onClick={a.onClick} className="press flex flex-col items-center gap-1.5">
              {inner}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className={cx('rounded-3xl p-4', due > 0 ? 'bg-rose-50' : 'bg-emerald-50')}>
          <p className={cx('text-[12.5px] font-semibold', due > 0 ? 'text-rose-700' : 'text-emerald-700')}>মোট বকেয়া</p>
          <p className={cx('tabular mt-1 text-[24px] font-extrabold', due > 0 ? 'text-rose-600' : 'text-emerald-600')}>{taka(due)}</p>
          <p className="text-[12px] text-slate-500">{due > 0 ? 'বেতন + জরিমানা + পরীক্ষা' : 'সব পরিশোধিত ✓'}</p>
        </div>
        <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-4">
          <Ring value={att.percentage} size={58} tone={att.percentage >= 75 ? 'green' : 'red'}>
            <span className="tabular text-[13px] font-extrabold text-ink">{Math.round(att.percentage)}%</span>
          </Ring>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-600">হাজিরা</p>
            <p className="tabular text-[13px] text-slate-500">
              {att.present}/{att.totalClasses} দিন
            </p>
          </div>
        </div>
      </div>

      <Segmented
        className="mt-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'fees', label: 'ফি' },
          { value: 'att', label: 'হাজিরা' },
          { value: 'info', label: 'তথ্য' },
        ]}
      />

      {tab === 'fees' && (
        <div className="mt-4 space-y-5">
          <Group title="মাসিক বেতন">
            {feeStartMonth && <p className="py-2.5 text-[13px] font-medium text-emerald-700">✓ {feeStartLabel(feeStartMonth)}-এর আগের বেতন ভর্তির সময় নেওয়া হয়েছে</p>}
            {sFees.length === 0 && <Empty text={feeStartMonth ? `${feeStartLabel(feeStartMonth)} থেকে বেতন শুরু` : 'কোনো রেকর্ড নেই'} />}
            {sFees.map((f) => {
              const st = feeStatus(f);
              return (
                <div key={f.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">
                        {monthBn(f.month)} {f.year}
                      </p>
                      <p className="tabular text-[12.5px] text-slate-500">
                        ফি {taka(f.amount)}
                        {f.fine ? ` · জরিমানা ${taka(f.fine)}` : ''} · দিয়েছে {taka(f.paid)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone={feeBadge(f, st).tone} dot>
                        {feeBadge(f, st).bn}
                      </Badge>
                      {Number(f.due) > 0 && <p className="tabular mt-1 text-[13px] font-bold text-rose-600">{taka(f.due)}</p>}
                    </div>
                  </div>
                  {f.reason && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                      <span className="font-semibold">কারণ:</span> {f.reason}
                      {f.note ? ` — ${f.note}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </Group>

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
          <Group title="সাম্প্রতিক হাজিরা">
            {attLog.length === 0 && <Empty text="হাজিরার রেকর্ড নেই" />}
            {attLog.map((r) => (
              <Row key={r.date} title={fmtDate(r.date)}>
                <Badge tone={ATT_STATUS[r.status]?.tone} dot>
                  {ATT_STATUS[r.status]?.bn}
                </Badge>
              </Row>
            ))}
          </Group>
        </div>
      )}

      {tab === 'info' && (
        <div className="mt-2">
          <div className="divide-y divide-slate-100">
            <InfoRow icon={Hash} label="স্টুডেন্ট আইডি" value={s.studentId} mono />
            <InfoRow icon={UserRound} label="পিতার নাম" value={s.fatherName} />
            <InfoRow icon={Users} label="মাতার নাম" value={s.motherName} />
            <InfoRow icon={Phone} label="অভিভাবকের ফোন" value={s.guardianPhone} mono />
            <InfoRow icon={MapPin} label="ঠিকানা" value={s.address} />
            <InfoRow icon={CalendarDays} label="ভর্তির তারিখ" value={fmtDate(s.admissionDate)} />
            <InfoRow icon={Wallet} label="মাসিক বেতন" value={taka(s.monthlyFee || settings.defaultMonthlyFee)} />
            <InfoRow
              icon={CalendarDays}
              label="অনুপস্থিতির জরিমানা (প্রতি দিন)"
              value={`${taka(absenceFineFor(s))}${s.absentFine === '' || s.absentFine == null ? ' · ক্লাসের নিয়ম' : ''}`}
            />
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
            </div>
          </div>
          {s.guardianPhone && (
            <Button
              as="a"
              variant="soft-success"
              block
              className="mt-4"
              target="_blank"
              rel="noopener noreferrer"
              href={waLink(
                s.guardianPhone,
                `প্রিয় অভিভাবক,\n${s.name}-এর তথ্য (বেতন, হাজিরা, রশিদ) অনলাইনে দেখতে:\n${window.location.origin}\n\nক্লাস: ${settings.className}\nরোল: ${s.roll}\nপিন: ${s.pin}\n\nপিন গোপন রাখুন।\n${settings.inchargeName}\nক্লাস ইনচার্জ, ${settings.className}`,
              )}
            >
              <WhatsAppIcon className="h-5 w-5" /> পোর্টালের রোল ও পিন পাঠান
            </Button>
          )}
          <Button variant="soft-danger" icon={Trash2} block className="mt-2.5" onClick={remove}>
            শিক্ষার্থী মুছে ফেলুন
          </Button>
        </div>
      )}
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
  const { students, settings, addStudent, updateStudent, classId, isBeforeStart, feeStartMonth } = useApp();
  const { closeStudentForm, toast, openStudent } = useUI();
  const departments = settings.departments || [];
  const sections = settings.sections || [];

  const [form, setForm] = useState(() => {
    if (editing) return { ...editing };
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
      address: '',
      admissionDate: todayISO(),
      monthlyFee: settings.defaultMonthlyFee,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      status: 'active',
      absentFine: '',
    };
  });
  const [errors, setErrors] = useState({});
  const [paidAtAdmission, setPaidAtAdmission] = useState(true);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    const err = {};
    if (!String(form.name).trim()) err.name = 'নাম লিখুন';
    if (!form.roll) err.roll = 'রোল দিন';
    else if (students.some((s) => Number(s.roll) === Number(form.roll) && s.id !== editing?.id)) err.roll = 'এই রোল আগে থেকেই আছে';
    if (form.guardianPhone && !/^01\d{9}$/.test(String(form.guardianPhone).replace(/[^0-9]/g, '').replace(/^88/, '')))
      err.guardianPhone = '১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)';
    if (!/^\d{4,6}$/.test(String(form.pin))) err.pin = '৪–৬ সংখ্যার পিন দিন';
    if (form.absentFine !== '' && form.absentFine != null && !(Number(form.absentFine) >= 0)) err.absentFine = 'সঠিক পরিমাণ দিন';
    setErrors(err);
    if (Object.keys(err).length) return;

    const { avatar: _photo, ...rest } = form;
    const absentFine = rest.absentFine === '' || rest.absentFine == null ? '' : Number(rest.absentFine);
    const data = { ...rest, roll: Number(form.roll), monthlyFee: Number(form.monthlyFee), absentFine };
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

  return (
    <div className="space-y-6 pt-1">
      <div className="flex items-center gap-4">
        <RollBadge roll={form.roll || '?'} seed={editing?.id || form.roll} size={76} rounded="rounded-[24px]" />
        <div className="text-[13.5px] text-slate-500">
          ছবির বদলে রোল নম্বর দেখানো হবে
          <br />
          <span className="text-[12.5px]">রোল বদলালে এখানেও বদলাবে</span>
        </div>
      </div>

      <FormSection title="মূল তথ্য">
        <Field label="নাম (বাংলায়) *" error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="যেমন মো: রহিম আহমেদ" />
        </Field>
        <Field label="Name (English)">
          <Input value={form.nameEn || ''} onChange={set('nameEn')} placeholder="e.g. Md. Rahim Ahmed" autoCapitalize="words" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="রোল *" error={errors.roll}>
            <Input type="number" inputMode="numeric" value={form.roll} onChange={set('roll')} />
          </Field>
          <Field label="স্টুডেন্ট আইডি" hint="রোল থেকে আপনাআপনি">
            <Input value={form.roll ? studentIdFor(classId, form.roll) : ''} readOnly tabIndex={-1} className="tabular bg-slate-100 text-slate-600" />
          </Field>
        </div>
        {departments.length > 0 && (
          <Field label="বিভাগ">
            <Pills value={form.group} onChange={set('group')} options={departments} />
          </Field>
        )}
        {sections.length > 0 && (
          <Field label="শাখা">
            <Pills value={form.section} onChange={set('section')} options={sections} />
          </Field>
        )}
        {settings.useGender !== false && (
          <Field label="ছাত্র / ছাত্রী">
            <Segmented value={form.gender} onChange={set('gender')} options={GENDERS.map((g) => ({ value: g.id, label: g.bn }))} />
          </Field>
        )}
      </FormSection>

      <FormSection title="অভিভাবক">
        <Field label="অভিভাবকের মোবাইল (WhatsApp)" error={errors.guardianPhone}>
          <Input type="tel" inputMode="tel" value={form.guardianPhone} onChange={set('guardianPhone')} placeholder="01XXXXXXXXX" />
        </Field>
        <Field label="পিতার নাম">
          <Input value={form.fatherName} onChange={set('fatherName')} />
        </Field>
        <Field label="মাতার নাম">
          <Input value={form.motherName} onChange={set('motherName')} />
        </Field>
        <Field label="ঠিকানা">
          <Input value={form.address} onChange={set('address')} placeholder="যেমন ধানমন্ডি, ঢাকা" />
        </Field>
      </FormSection>

      <FormSection title="ফি ও পোর্টাল">
        <div className="grid grid-cols-2 gap-3">
          <Field label="মাসিক বেতন (৳)">
            <Input type="number" inputMode="numeric" value={form.monthlyFee} onChange={set('monthlyFee')} />
          </Field>
          <Field label="পোর্টাল পিন" error={errors.pin}>
            <Input inputMode="numeric" maxLength={6} value={form.pin} onChange={set('pin')} className="tracking-[0.3em]" />
          </Field>
        </div>
        <Field
          label="অনুপস্থিতির জরিমানা (৳/দিন)"
          error={errors.absentFine}
          hint={`খালি রাখলে ক্লাসের নিয়ম (৳${settings.absentFine}) · 0 দিলে এই শিক্ষার্থীর জরিমানা হবে না`}
        >
          <Input type="number" inputMode="numeric" min={0} value={form.absentFine ?? ''} onChange={set('absentFine')} placeholder={String(settings.absentFine)} />
        </Field>
        <Field label="ভর্তির তারিখ">
          <Input type="date" value={form.admissionDate || ''} onChange={set('admissionDate')} />
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
      </FormSection>

      {!editing && (
        <PaidAtAdmission
          checked={paidAtAdmission}
          onChange={setPaidAtAdmission}
          month={monthBn(settings.currentMonth)}
          beforeStart={isBeforeStart(settings.currentMonth, settings.currentYear)}
          startLabel={feeStartLabel(feeStartMonth)}
        />
      )}

      <div className="sticky bottom-0 -mx-5 bg-white/95 px-5 pb-1 pt-3 backdrop-blur">
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
        className={cx('press h-10 rounded-xl px-4 text-[14.5px] font-semibold', value === o.id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}
      >
        {o.bn}
      </button>
    ))}
  </div>
);

const FormSection = ({ title, children }) => (
  <section>
    <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
    <div className="space-y-4">{children}</div>
  </section>
);
