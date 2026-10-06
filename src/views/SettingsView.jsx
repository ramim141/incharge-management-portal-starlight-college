import React, { useRef, useState } from 'react';
import {
  School, Wallet, MessageSquareText, Database, HardDriveDownload, ChevronDown, Download, Upload, Save, Layers, Plus, X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Card, Field, Input, Textarea, Button, Badge, Segmented, cx, DOCK, DOCK_BOTTOM } from '../components/ui';
import { todayISO } from '../lib/format';

const VARS = ['student_name', 'roll', 'month', 'monthly_fee', 'total_due', 'deadline', 'incharge_name', 'incharge_phone', 'class_name'];
const EDITABLE = ['inchargeName', 'inchargeDesignation', 'inchargePhone', 'defaultMonthlyFee', 'defaultFeeDeadlineDay', 'fixedFineAfterDeadline', 'absentFine', 'departments', 'sections', 'useGender', 'whatsappTemplate'];
const pick = (o) => Object.fromEntries(EDITABLE.map((k) => [k, o[k] ?? '']));

export const SettingsView = () => {
  const {
    settings, setSettings, isLocal, isPrincipal, importBackup, classId,
    students, fees, examFees, fines, payments, attendance, calculateStudentTotalDue,
  } = useApp();
  const { toast, confirm } = useUI();
  const fileRef = useRef(null);

  const [form, setForm] = useState(() => pick(settings));
  const [open, setOpen] = useState('profile');
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(settings));
  const set = (k, num) => (e) => setForm((f) => ({ ...f, [k]: num ? Number(e.target.value) : e.target.value }));

  const saveGeneral = async () => {
    const clean = (list) => list.map((i) => ({ ...i, bn: i.bn.trim() })).filter((i) => i.bn);
    await setSettings({ ...form, departments: clean(form.departments), sections: clean(form.sections) });
    toast('সেটিংস সংরক্ষিত হয়েছে');
  };

  const insertVar = (v) => setForm((f) => ({ ...f, whatsappTemplate: `${f.whatsappTemplate}{${v}}` }));

  const preview = (() => {
    const s = students[0];
    if (!s) return form.whatsappTemplate;
    const fee = fees.find((f) => f.studentId === s.id && f.month === settings.currentMonth);
    return String(form.whatsappTemplate)
      .replace(/\{student_name\}/g, s.name)
      .replace(/\{month\}/g, settings.currentMonth)
      .replace(/\{monthly_fee\}/g, fee?.amount || form.defaultMonthlyFee)
      .replace(/\{total_due\}/g, calculateStudentTotalDue(s.id))
      .replace(/\{deadline\}/g, `${form.defaultFeeDeadlineDay} ${settings.currentMonth} ${settings.currentYear}`)
      .replace(/\{incharge_name\}/g, form.inchargeName)
      .replace(/\{incharge_phone\}/g, form.inchargePhone)
      .replace(/\{class_name\}/g, settings.className)
      .replace(/\{roll\}/g, s.roll);
  })();

  const backup = () => {
    const data = { version: '2.0', exportDate: new Date().toISOString(), classId, institution: settings.institutionName, students, fees, examFees, fines, payments, attendance, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${classId}_Backup_${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('ব্যাকআপ ফাইল ডাউনলোড হয়েছে');
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast('ফাইলটি সঠিক ব্যাকআপ নয়', 'error');
    }
    if (!Array.isArray(data.students)) return toast('ফাইলে শিক্ষার্থীর তথ্য নেই', 'error');
    const ok = await confirm({
      title: 'ব্যাকআপ ইমপোর্ট করবেন?',
      message: `${data.students.length} জন শিক্ষার্থী ও তাদের বেতন, হাজিরা, পেমেন্ট এই ক্লাসে (${settings.className}) যোগ হবে। একই আইডির তথ্য থাকলে বদলে যাবে।`,
      confirmText: 'ইমপোর্ট',
      icon: Upload,
    });
    if (!ok) return;
    try {
      const n = await importBackup(data);
      toast(`${n} জন শিক্ষার্থীর তথ্য ইমপোর্ট হয়েছে`);
    } catch (err) {
      toast(`ইমপোর্ট ব্যর্থ: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <PageHeader title="সেটিংস" subtitle={`${settings.className} · ফি নিয়ম ও টেমপ্লেট`} />

      <div className="space-y-3">
        <Section id="profile" open={open} setOpen={setOpen} icon={School} color="bg-brand-50 text-brand-600" title="ক্লাস ও ইনচার্জ" hint={`${settings.className} · ${settings.inchargeName || 'ইনচার্জ নেই'}`}>
          <div className="space-y-1 rounded-2xl bg-slate-50 p-4 text-[14px]">
            <p className="font-bold text-ink">{settings.institutionName}</p>
            <p className="text-slate-600">{settings.sectionName}</p>
            <p className="tabular text-slate-500">
              ক্লাস কোড <span className="font-semibold text-ink">{classId}</span> · স্টুডেন্ট আইডি যেমন {classId}-0101
            </p>
            {!isPrincipal && <p className="pt-1 text-[12.5px] text-slate-400">ক্লাসের নাম বা কোড বদলাতে অধ্যক্ষের সাথে যোগাযোগ করুন</p>}
          </div>
          <Field label="ক্লাস ইনচার্জের নাম">
            <Input value={form.inchargeName} onChange={set('inchargeName')} />
          </Field>
          <Field label="পদবি">
            <Input value={form.inchargeDesignation} onChange={set('inchargeDesignation')} />
          </Field>
          <Field label="মোবাইল (বিকাশ / WhatsApp)" hint="শিক্ষার্থী পোর্টালে 'ইনচার্জকে কল করো' বোতামে এই নম্বর যাবে">
            <Input type="tel" inputMode="tel" value={form.inchargePhone} onChange={set('inchargePhone')} />
          </Field>
        </Section>

        <Section
          id="fee"
          open={open}
          setOpen={setOpen}
          icon={Wallet}
          color="bg-emerald-50 text-emerald-600"
          title="ফি ও জরিমানার নিয়ম"
          hint={`৳${form.defaultMonthlyFee}/মাস · ${form.defaultFeeDeadlineDay} তারিখের মধ্যে`}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="মাসিক বেতন (৳)">
              <Input type="number" inputMode="numeric" value={form.defaultMonthlyFee} onChange={set('defaultMonthlyFee', true)} />
            </Field>
            <Field label="শেষ তারিখ (দিন)">
              <Input type="number" inputMode="numeric" min={1} max={28} value={form.defaultFeeDeadlineDay} onChange={set('defaultFeeDeadlineDay', true)} />
            </Field>
            <Field label="বিলম্ব জরিমানা (৳)">
              <Input type="number" inputMode="numeric" value={form.fixedFineAfterDeadline} onChange={set('fixedFineAfterDeadline', true)} />
            </Field>
            <Field label="অনুপস্থিতি জরিমানা (৳/দিন)">
              <Input type="number" inputMode="numeric" min={0} value={form.absentFine} onChange={set('absentFine', true)} />
            </Field>
          </div>
          <p className="text-[12.5px] text-slate-500">চলতি মাস তারিখ দেখে আপনাআপনি ঠিক হয়। নতুন মাসের বেতন "মাসিক বেতন" পাতা থেকে তৈরি করুন।</p>
          <p className="text-[12.5px] text-slate-500">
            হাজিরায় অনুপস্থিত দিলে প্রতিদিন এই জরিমানা হবে। কোনো শিক্ষার্থীর আলাদা হার দিতে তার তথ্য এডিট করুন; 0 দিলে অনুপস্থিতি জরিমানা বন্ধ থাকবে।
          </p>
        </Section>

        <Section
          id="groups"
          open={open}
          setOpen={setOpen}
          icon={Layers}
          color="bg-violet-50 text-violet-600"
          title="বিভাগ ও শাখা"
          hint={[
            form.departments.length ? `${form.departments.length}টি বিভাগ` : 'বিভাগ নেই',
            form.sections.length ? `${form.sections.length}টি শাখা` : null,
            form.useGender !== false ? 'ছাত্র/ছাত্রী' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <p className="text-[12.5px] text-slate-500">আপনার ক্লাস যেভাবে ভাগ করা, সেভাবে সাজান। এগুলোই শিক্ষার্থীর ফর্ম আর ফিল্টারে দেখাবে। কিছু না লাগলে সব মুছে দিন।</p>
          <ListEditor
            title="বিভাগ (Department)"
            items={form.departments}
            onChange={(departments) => setForm((f) => ({ ...f, departments }))}
            usedBy={(id) => students.filter((s) => s.group === id).length}
            placeholder="যেমন বিজ্ঞান"
            presets={[['বিজ্ঞান', 'ব্যবসায় শিক্ষা', 'মানবিক']]}
          />
          <ListEditor
            title="শাখা (Section)"
            items={form.sections}
            onChange={(sections) => setForm((f) => ({ ...f, sections }))}
            usedBy={(id) => students.filter((s) => s.section === id).length}
            placeholder="যেমন ক শাখা"
            presets={[
              ['ছাত্র শাখা', 'ছাত্রী শাখা'],
              ['ক শাখা', 'খ শাখা', 'গ শাখা'],
            ]}
          />
          <Field label="ছাত্র / ছাত্রী আলাদা করে দেখাবেন?">
            <Segmented
              value={form.useGender === false ? 'off' : 'on'}
              onChange={(v) => setForm((f) => ({ ...f, useGender: v === 'on' }))}
              options={[
                { value: 'on', label: 'হ্যাঁ' },
                { value: 'off', label: 'না' },
              ]}
            />
          </Field>
        </Section>

        <Section id="wa" open={open} setOpen={setOpen} icon={MessageSquareText} color="bg-emerald-50 text-emerald-600" title="WhatsApp মেসেজ টেমপ্লেট" hint="রিমাইন্ডারের লেখা">
          <Textarea rows={8} value={form.whatsappTemplate} onChange={set('whatsappTemplate')} />
          <div>
            <p className="mb-2 text-[12.5px] text-slate-500">ট্যাপ করে যোগ করুন — শিক্ষার্থী অনুযায়ী আপনাআপনি বসবে</p>
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button key={v} type="button" onClick={() => insertVar(v)} className="press rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[12.5px] text-slate-600">
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#efeae2] p-3">
            <p className="mb-1.5 text-[12px] font-semibold text-slate-500">প্রিভিউ</p>
            <p className="whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#d9fdd3] p-3 text-[14px] leading-relaxed text-[#111b21]">{preview}</p>
          </div>
        </Section>

        <Section
          id="data"
          open={open}
          setOpen={setOpen}
          icon={HardDriveDownload}
          color="bg-amber-50 text-amber-600"
          title="ব্যাকআপ ও ডাটা"
          hint={isLocal ? 'পরীক্ষামূলক — তথ্য শুধু এই ব্রাউজারে' : 'Cloud-এ সংরক্ষিত, সব ডিভাইসে সিঙ্ক'}
          badge={<Badge tone={isLocal ? 'amber' : 'green'} dot>{isLocal ? 'টেস্ট' : 'Cloud'}</Badge>}
        >
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 text-[13.5px] text-slate-600">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            {isLocal
              ? 'এটি পরীক্ষামূলক ডাটাবেজ — তথ্য শুধু এই ব্রাউজারে থাকে।'
              : 'সব তথ্য Firebase Cloud-এ থাকে। ইন্টারনেট না থাকলেও কাজ করা যায় — সংযোগ এলে আপনাআপনি সিঙ্ক হয়।'}
          </div>
          <Button variant="secondary" icon={Download} block onClick={backup}>
            ব্যাকআপ ডাউনলোড (JSON)
          </Button>
          <Button variant="secondary" icon={Upload} block onClick={() => fileRef.current?.click()}>
            ব্যাকআপ থেকে ইমপোর্ট
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
        </Section>
      </div>

      {dirty && (
        <>
          <div className="h-20" />
          <div className={DOCK} style={DOCK_BOTTOM}>
            <div className="flex items-center gap-3 rounded-[22px] bg-ink/95 p-2 pl-4 text-white shadow-2xl backdrop-blur">
              <p className="flex-1 text-[14px] font-semibold">অসংরক্ষিত পরিবর্তন</p>
              <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10" onClick={() => setForm(pick(settings))}>
                বাতিল
              </Button>
              <Button variant="success" size="sm" icon={Save} onClick={saveGeneral}>
                সংরক্ষণ
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** Add / rename / remove the in-charge's own departments or sections */
function ListEditor({ title, items, onChange, usedBy, placeholder, presets = [] }) {
  const { confirm } = useUI();
  const [draft, setDraft] = useState('');
  const has = (bn) => items.some((i) => i.bn.trim() === bn.trim());

  const add = (labels) => {
    const fresh = labels.map((l) => l.trim()).filter((l) => l && !has(l));
    if (!fresh.length) return;
    const stamp = Date.now().toString(36);
    onChange([...items, ...fresh.map((bn, i) => ({ id: `g-${stamp}${i}`, bn }))]);
    setDraft('');
  };

  const remove = async (item) => {
    const n = usedBy(item.id);
    if (n > 0) {
      const ok = await confirm({
        title: `"${item.bn}" মুছবেন?`,
        message: `${n} জন শিক্ষার্থী এতে আছে। তাদের তথ্য থাকবে, কিন্তু তালিকা ও ফিল্টারে এটি আর দেখাবে না।`,
        confirmText: 'মুছুন',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange(items.filter((i) => i.id !== item.id));
  };

  return (
    <div>
      <p className="mb-2 text-[13.5px] font-semibold text-slate-700">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.bn}
              onChange={(e) => onChange(items.map((i) => (i.id === item.id ? { ...i, bn: e.target.value } : i)))}
              aria-label="নাম"
            />
            <span className="tabular w-8 shrink-0 text-center text-[12.5px] text-slate-400">{usedBy(item.id)}</span>
            <button type="button" onClick={() => remove(item)} aria-label="মুছুন" className="press grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && add([draft])} />
          <button type="button" onClick={() => add([draft])} disabled={!draft.trim()} aria-label="যোগ করুন" className="press grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-white disabled:bg-slate-200 disabled:text-slate-400">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        {items.length === 0 &&
          presets.map((p) => (
            <button key={p.join()} type="button" onClick={() => add(p)} className="press mr-2 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600">
              + {p.join(' / ')}
            </button>
          ))}
      </div>
    </div>
  );
}

function Section({ id, open, setOpen, icon: Icon, color, title, hint, badge, children }) {
  const expanded = open === id;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(expanded ? null : id)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', color)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-bold text-ink">{title}</span>
          {hint && <span className="block truncate text-[12.5px] text-slate-500">{hint}</span>}
        </span>
        {badge}
        <ChevronDown className={cx('h-5 w-5 shrink-0 text-slate-400 transition', expanded && 'rotate-180')} />
      </button>
      {expanded && <div className="space-y-4 border-t border-slate-100 p-4">{children}</div>}
    </Card>
  );
}
