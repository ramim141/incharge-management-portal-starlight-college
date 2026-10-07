import React, { useRef, useState } from 'react';
import { Upload, FileDown, ClipboardPaste, CheckCircle2, AlertTriangle, Users, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { backend, errorText } from '../../backend';
import { Button, Field, Textarea, Badge, cx } from '../../components/ui';
import { EN_MONTHS, downloadCSV, todayISO } from '../../lib/format';
import { parseTable, planImport, buildImportOps, TEMPLATE_CSV } from '../../lib/studentImport';

/** Principal: add a whole institution's student list at once; each student lands in their class */
export function StudentImport({ classes, onDone }) {
  const { institution } = useAuth();
  const { toast } = useUI();
  const fileRef = useRef(null);
  const [step, setStep] = useState('input'); // input | preview | done
  const [defaultClass, setDefaultClass] = useState(classes.length === 1 ? classes[0].id : '');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null); // { plan, errors, unknownHeaders }
  const [created, setCreated] = useState([]);
  const [busy, setBusy] = useState(false);

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
      const { ops, created: list } = buildImportOps(result.plan, { institution, month: EN_MONTHS[now.getMonth()], year: now.getFullYear() });
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
                  <span className="tabular w-10 shrink-0 font-bold text-slate-500">{st.input.roll}</span>
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
          প্রথম লাইনে কলামের নাম, তারপর প্রতি লাইনে একজন শিক্ষার্থী। <b>রোল</b> ও <b>নাম</b> লাগবেই; <b>ক্লাস</b> কলামে ক্লাস কোড (যেমন {classes[0]?.id || 'XI-2026'}) দিলে
          প্রত্যেকে নিজের ক্লাসে যাবে। বাকি কলাম ঐচ্ছিক: বিভাগ, শাখা, লিঙ্গ, পিতা, মাতা, মোবাইল, ঠিকানা, বেতন, পিন।
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
