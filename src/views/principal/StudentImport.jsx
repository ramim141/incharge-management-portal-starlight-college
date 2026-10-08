import React, { useRef, useState } from 'react';
import { Upload, FileDown, ClipboardPaste, CheckCircle2, AlertTriangle, Users, KeyRound, ArrowLeft, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { backend, errorText } from '../../backend';
import { Button, Field, Input, Textarea, Badge, Segmented, PaidAtAdmission, cx } from '../../components/ui';
import { EN_MONTHS, GENDERS, downloadCSV, todayISO, monthBn } from '../../lib/format';
import { parseTable, planImport, buildImportOps, TEMPLATE_CSV } from '../../lib/studentImport';
import { isBeforeFeeStart, feeStartLabel } from '../../lib/classLogic';

/** The whole institution's list at once; each student lands in their class */
function ListImport({ classes, onDone }) {
  const { institution } = useAuth();
  const { toast } = useUI();
  const fileRef = useRef(null);
  const [step, setStep] = useState('input'); // input | preview | done
  const [defaultClass, setDefaultClass] = useState(classes.length === 1 ? classes[0].id : '');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null); // { plan, errors, unknownHeaders }
  const [created, setCreated] = useState([]);
  const [busy, setBusy] = useState(false);
  const [paidAtAdmission, setPaidAtAdmission] = useState(true);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) return toast('Excel ফাইল সরাসরি নয় — Excel-এ "Save As → CSV UTF-8" করুন, অথবা সারিগুলো কপি করে নিচে পেস্ট করুন', 'error');
    setText(await f.text());
  };

  const downloadTemplate = () => {
    const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'student_list_template.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const preview = async () => {
    const rows = parseTable(text);
    setBusy(true);
    try {
      // Rolls already in each class are skipped, so running the same list twice adds nobody twice
      const existing = {};
      await Promise.all(
        classes.map(async (c) => {
          existing[c.id] = await backend.getCollection(['classes', c.id, 'students']);
        }),
      );
      setResult(planImport(rows, { classes, existing, defaultClass }));
      setStep('preview');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const total = result?.plan.reduce((a, g) => a + g.students.length, 0) || 0;

  const run = async () => {
    if (!total || busy) return;
    setBusy(true);
    try {
      const now = new Date();
      const { ops, created: list } = buildImportOps(result.plan, { institution, month: EN_MONTHS[now.getMonth()], year: now.getFullYear(), paidAtAdmission });
      await backend.write(ops, { wait: true });
      setCreated(list);
      setStep('done');
      toast(`${list.length} জন শিক্ষার্থী যুক্ত হয়েছে`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadPins = () =>
    downloadCSV(
      `Student_PINs_${todayISO()}.csv`,
      ['Class', 'Class Code', 'Roll', 'Name', 'PIN', 'Guardian Phone'],
      created.map((c) => [c.className, c.classCode, c.roll, c.name, c.pin, c.phone]),
    );

  if (step === 'done') {
    const byClass = created.reduce((m, c) => ((m[c.className] = (m[c.className] || 0) + 1), m), {});
    return (
      <div className="space-y-4 pt-1 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <p className="text-[20px] font-extrabold text-ink">{created.length} জন শিক্ষার্থী যুক্ত হয়েছে</p>
          <p className="mt-1 text-[13.5px] text-slate-500">প্রত্যেক ইনচার্জ নিজের ক্লাসে এখনই দেখতে পাবেন। শিক্ষার্থীরা রোল + পিন দিয়ে পোর্টালে ঢুকতে পারবে।</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {Object.entries(byClass).map(([n, c]) => (
            <Badge key={n} tone="brand">
              {n}: {c} জন
            </Badge>
          ))}
        </div>
        <Button variant="success" icon={KeyRound} block onClick={downloadPins}>
          পিন তালিকা ডাউনলোড (CSV)
        </Button>
        <p className="text-[12.5px] text-slate-500">এই তালিকায় সবার পিন আছে — শিক্ষার্থীদের জানিয়ে দিন। ইনচার্জও প্রোফাইল থেকে পিন দেখতে ও WhatsApp-এ পাঠাতে পারবেন।</p>
        <Button variant="secondary" block onClick={onDone}>
          শেষ
        </Button>
      </div>
    );
  }

  if (step === 'preview' && result) {
    const skipped = result.plan.reduce((a, g) => a + g.skipped.length, 0);
    return (
      <div className="space-y-4 pt-1">
        <div className={cx('rounded-2xl p-4', total ? 'bg-brand-50/70' : 'bg-amber-50')}>
          <p className="text-[17px] font-extrabold text-ink">{total} জন শিক্ষার্থী যোগ হবে</p>
          {skipped > 0 && <p className="text-[13px] text-slate-600">{skipped} জন আগে থেকেই আছে (একই রোল) — বাদ যাবে</p>}
          {result.errors.length > 0 && <p className="text-[13px] font-semibold text-rose-600">{result.errors.length}টি সারিতে ভুল — সেগুলো বাদ যাবে</p>}
        </div>

        {result.plan.map((g) => (
          <div key={g.cls.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[15px] font-bold text-ink">
                {g.cls.name} <span className="tabular text-[12.5px] font-medium text-slate-400">{g.cls.id}</span>
              </p>
              <Badge tone="brand">{g.students.length} জন</Badge>
            </div>
            <p className="mt-0.5 text-[12.5px] text-slate-500">ইনচার্জ: {g.cls.inchargeName || 'এখনো কেউ নেই'}</p>
            {(g.addedDepts.length > 0 || g.addedSections.length > 0) && (
              <p className="mt-1 text-[12.5px] text-amber-700">
                নতুন যোগ হবে: {[...g.addedDepts, ...g.addedSections].map((d) => d.bn).join(', ')}
              </p>
            )}
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-slate-50 px-3 py-1 text-[13px]">
              {g.students.slice(0, 50).map((st) => (
                <p key={st.row} className="flex gap-2 py-1">
                  <span className="tabular min-w-[2.5rem] shrink-0 font-bold text-slate-500">{st.input.roll}</span>
                  <span className="truncate text-ink">{st.input.name}</span>
                </p>
              ))}
              {g.students.length > 50 && <p className="py-1 text-slate-400">…আরও {g.students.length - 50} জন</p>}
            </div>
          </div>
        ))}

        {result.errors.length > 0 && (
          <div className="rounded-2xl bg-rose-50 p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-rose-700">
              <AlertTriangle className="h-4 w-4" /> যেসব সারি বাদ যাবে
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto text-[13px] text-rose-800">
              {result.errors.map((e, i) => (
                <p key={i}>
                  {e.row ? `সারি ${e.row}: ` : ''}
                  {e.msg}
                </p>
              ))}
            </div>
          </div>
        )}
        {result.unknownHeaders.length > 0 && (
          <p className="text-[12.5px] text-slate-500">এই কলামগুলো চেনা যায়নি, তাই বাদ: {result.unknownHeaders.join(', ')}</p>
        )}

        {(() => {
          // Before the fee start month (for every class in this list): admission month already paid
          const now = new Date();
          const starts = result.plan.map((g) => g.cls.settings?.feeStartMonth || '');
          const allBefore = starts.length > 0 && starts.every((fs) => isBeforeFeeStart(EN_MONTHS[now.getMonth()], now.getFullYear(), fs));
          return (
            <PaidAtAdmission
              checked={paidAtAdmission}
              onChange={setPaidAtAdmission}
              month={monthBn(EN_MONTHS[now.getMonth()])}
              beforeStart={allBefore}
              startLabel={feeStartLabel(starts[0])}
            />
          );
        })()}

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep('input')}>
            ফিরুন
          </Button>
          <Button icon={Users} disabled={!total || busy} onClick={run}>
            {busy ? 'যোগ হচ্ছে…' : `${total} জনকে যোগ করুন`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-2xl bg-brand-50/70 p-4 text-[13.5px] leading-relaxed text-brand-900">
        <p className="font-bold">যেভাবে দেবেন</p>
        <p>
          প্রথম লাইনে কলামের নাম, তারপর প্রতি লাইনে একজন শিক্ষার্থী। <b>রোল</b>, <b>নাম</b> (বাংলায়) ও <b>nameEn</b> (ইংরেজিতে নাম) দিন; <b>ক্লাস</b> কলামে ক্লাস কোড
          (যেমন {classes[0]?.id || 'XI-2026'}) দিলে প্রত্যেকে নিজের ক্লাসে যাবে। বাকি কলাম ঐচ্ছিক: বিভাগ, শাখা, লিঙ্গ, পিতা, মাতা, মোবাইল, ঠিকানা, বেতন, পিন।
        </p>
      </div>

      <Field label="ক্লাস কলাম না থাকলে সবাই যাবে" hint="ফাইলে ক্লাস কলাম থাকলে সেটাই মানা হবে">
        <select
          value={defaultClass}
          onChange={(e) => setDefaultClass(e.target.value)}
          className="h-12 w-full rounded-2xl bg-slate-50 px-4 text-[16px] font-medium text-ink outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-brand-500"
        >
          <option value="">— ফাইলের ক্লাস কলাম অনুযায়ী —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
          CSV ফাইল
        </Button>
        <Button variant="secondary" icon={FileDown} onClick={downloadTemplate}>
          নমুনা ফাইল
        </Button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,.xlsx,.xls" className="hidden" onChange={onFile} />

      <Field label="অথবা Excel / Google Sheets থেকে কপি করে পেস্ট করুন">
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'class\troll\tname\tphone\nXI-2026\t101\tরহিম আহমেদ\t01712345678'}
          className="font-mono text-[13px]"
        />
      </Field>
      {text && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
          <ClipboardPaste className="h-4 w-4" /> {Math.max(0, parseTable(text).length - 1)}টি সারি পাওয়া গেছে
        </p>
      )}

      <Button size="lg" block disabled={!text.trim() || busy} onClick={preview}>
        {busy ? 'যাচাই হচ্ছে…' : 'যাচাই করে দেখুন'}
      </Button>
    </div>
  );
}

/** Principal: add students — one at a time with a form, or a whole list at once */
export function StudentImport({ classes, onDone }) {
  const [mode, setMode] = useState('one');
  return (
    <div className="pt-1">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'one', label: 'একজন করে' },
          { value: 'list', label: 'পুরো তালিকা' },
        ]}
      />
      <div className="mt-4">{mode === 'one' ? <SingleStudentForm classes={classes} /> : <ListImport classes={classes} onDone={onDone} />}</div>
    </div>
  );
}

const selectCls =
  'h-12 w-full rounded-2xl bg-slate-50 px-4 text-[16px] font-medium text-ink outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-brand-500';

const blankForm = (classCode) => ({
  classCode, roll: '', name: '', nameEn: '', group: '', section: '', gender: '', phone: '', father: '', mother: '', address: '', pin: '',
});

/** One student at a time; goes through the same checks and records as the list import */
function SingleStudentForm({ classes }) {
  const { institution } = useAuth();
  const { toast } = useUI();
  const [f, setF] = useState(() => blankForm(classes.length === 1 ? classes[0].id : ''));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [paidAtAdmission, setPaidAtAdmission] = useState(true);
  const [last, setLast] = useState(null); // the student just added (to show their PIN)
  const [showPin, setShowPin] = useState(false);
  const set = (k) => (e) => {
    setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
    setErr('');
  };

  const cls = classes.find((c) => c.id === f.classCode);
  const departments = cls?.settings?.departments ?? [];
  const sections = cls?.settings?.sections ?? [];
  const useGender = cls?.settings?.useGender !== false;

  const pickClass = (code) => setF((x) => ({ ...blankForm(code), gender: x.gender }));

  const save = async () => {
    if (!cls) return setErr('ক্লাস বাছুন');
    if (!f.roll) return setErr('রোল দিন');
    if (!f.name.trim()) return setErr('বাংলায় নাম দিন');
    if (!f.nameEn.trim()) return setErr('ইংরেজিতে নাম দিন (Name in English)');
    setBusy(true);
    try {
      const existing = { [cls.id]: await backend.getCollection(['classes', cls.id, 'students']) };
      const header = ['class', 'roll', 'name', 'nameEn', 'department', 'section', 'gender', 'phone', 'father', 'mother', 'address', 'pin'];
      const row = [cls.id, f.roll, f.name, f.nameEn, f.group, f.section, f.gender, f.phone, f.father, f.mother, f.address, f.pin];
      const { plan, errors } = planImport([header, row], { classes, existing, defaultClass: cls.id });
      if (errors.length) throw Object.assign(new Error(errors[0].msg), { code: 'form' });
      if (plan[0]?.skipped.length) throw Object.assign(new Error(`রোল ${f.roll} এই ক্লাসে আগে থেকেই আছে`), { code: 'form' });
      const now = new Date();
      const { ops, created } = buildImportOps(plan, { institution, month: EN_MONTHS[now.getMonth()], year: now.getFullYear(), paidAtAdmission });
      await backend.write(ops, { wait: true });
      setLast(created[0]);
      setShowPin(false);
      toast(`${created[0].name} — ${cls.name}-তে যুক্ত হয়েছে`);
      // Ready for the next student of the same class: next roll, same department/section/gender
      setF((x) => ({ ...blankForm(x.classCode), roll: String(Number(x.roll) + 1), group: x.group, section: x.section, gender: x.gender }));
    } catch (e) {
      setErr(e.code === 'form' ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      {last && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-100">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold text-emerald-900">
              {last.name} · রোল {last.roll}
            </p>
            <p className="text-[12.5px] text-emerald-800">{last.className} — পোর্টালের পিন:</p>
          </div>
          <button type="button" onClick={() => setShowPin((v) => !v)} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[15px] font-bold tracking-widest text-ink ring-1 ring-emerald-200">
            <span className="tabular">{showPin ? last.pin : '••••'}</span>
            {showPin ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
          </button>
        </div>
      )}

      <Field label="ক্লাস *">
        <select value={f.classCode} onChange={(e) => pickClass(e.target.value)} className={selectCls}>
          <option value="">— ক্লাস বাছুন —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id}){c.inchargeName ? ` · ${c.inchargeName}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="রোল *">
        <Input inputMode="numeric" value={f.roll} onChange={(e) => set('roll')(e.target.value.replace(/[^0-9০-৯]/g, ''))} placeholder="101" className="tabular" />
      </Field>
      <Field label="নাম (বাংলায়) *">
        <Input value={f.name} onChange={set('name')} placeholder="যেমন মো: রহিম আহমেদ" />
      </Field>
      <Field label="Name (English) *">
        <Input value={f.nameEn} onChange={set('nameEn')} placeholder="e.g. Md. Rahim Ahmed" autoCapitalize="words" />
      </Field>

      {departments.length > 0 && (
        <Field label="বিভাগ">
          <select value={f.group} onChange={set('group')} className={selectCls}>
            <option value="">— বাছুন —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.bn}
              </option>
            ))}
          </select>
        </Field>
      )}
      {sections.length > 0 && (
        <Field label="শাখা">
          <select value={f.section} onChange={set('section')} className={selectCls}>
            <option value="">— বাছুন —</option>
            {sections.map((d) => (
              <option key={d.id} value={d.id}>
                {d.bn}
              </option>
            ))}
          </select>
        </Field>
      )}
      {useGender && (
        <Field label="ছাত্র / ছাত্রী">
          <Segmented value={f.gender} onChange={set('gender')} options={GENDERS.map((g) => ({ value: g.id, label: g.bn }))} />
        </Field>
      )}

      <Field label="অভিভাবকের মোবাইল">
        <Input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="পিতার নাম">
          <Input value={f.father} onChange={set('father')} />
        </Field>
        <Field label="মাতার নাম">
          <Input value={f.mother} onChange={set('mother')} />
        </Field>
      </div>
      <Field label="ঠিকানা">
        <Input value={f.address} onChange={set('address')} />
      </Field>
      <Field label="পোর্টাল পিন" hint="খালি রাখলে আপনাআপনি তৈরি হবে">
        <Input inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => set('pin')(e.target.value.replace(/\D/g, ''))} className="tabular tracking-[0.3em]" />
      </Field>

      <PaidAtAdmission
        checked={paidAtAdmission}
        onChange={setPaidAtAdmission}
        month={monthBn(EN_MONTHS[new Date().getMonth()])}
        beforeStart={!!cls && isBeforeFeeStart(EN_MONTHS[new Date().getMonth()], new Date().getFullYear(), cls.settings?.feeStartMonth)}
        startLabel={feeStartLabel(cls?.settings?.feeStartMonth)}
      />

      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{err}</p>}

      <div className="sticky bottom-0 -mx-5 bg-white/95 px-5 pb-1 pt-3 backdrop-blur">
        <Button size="lg" block icon={UserPlus} disabled={busy} onClick={save}>
          {busy ? 'যোগ হচ্ছে…' : 'শিক্ষার্থী যোগ করুন'}
        </Button>
      </div>
    </div>
  );
}
