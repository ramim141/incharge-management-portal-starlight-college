import React, { useMemo, useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, TriangleAlert, FileJson } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Button, Sheet, Checkbox, cx } from './ui';
import { buildBackup, summarizeBackup, validateBackup, BACKUP_LABELS, lastBackupAt, rememberBackup, daysSince } from '../lib/backup';
import { fmtDate, todayISO } from '../lib/format';
import { isOffline, OFFLINE_MESSAGE } from '../lib/sync';

const download = (data, name) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/** Backup & restore of everything in the class: one file down, one file back */
export function BackupPanel() {
  const { classId, settings, rawRecords, attendance, getBackupData, importBackup } = useApp();
  const { toast } = useUI();
  const fileRef = useRef(null);
  const [last, setLast] = useState(() => lastBackupAt(classId));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // { data, summary, warnings }

  const now = useMemo(
    () => summarizeBackup(buildBackup({ classId, raw: rawRecords, attendance })),
    [classId, rawRecords, attendance],
  );
  const age = daysSince(last);

  const backup = async () => {
    setBusy(true);
    try {
      const data = await getBackupData();
      download(data, `${classId}_Backup_${todayISO()}.json`);
      rememberBackup(classId);
      setLast(lastBackupAt(classId));
      toast('ব্যাকআপ ফাইল ডাউনলোড হয়েছে');
    } catch (e) {
      toast(`ব্যাকআপ ব্যর্থ: ${e.message}`, 'error');
    }
    setBusy(false);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast('ফাইলটি সঠিক ব্যাকআপ নয়', 'error');
    }
    const check = validateBackup(data, { classId });
    if (!check.ok) return toast(check.error, 'error');
    setPending({ data, summary: summarizeBackup(data), warnings: check.warnings });
  };

  return (
    <>
      <div
        className={cx(
          'flex items-start gap-3 rounded-2xl p-3.5 text-[13.5px]',
          age === Infinity || age > 14 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900',
        )}
      >
        {age === Infinity || age > 14 ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />}
        <span>
          {last ? (
            <>
              শেষ ব্যাকআপ: <b>{fmtDate(last.slice(0, 10))}</b> ({age === 0 ? 'আজ' : `${age} দিন আগে`})
              {age > 14 && ' — এবার একটা নতুন ব্যাকআপ নিন'}
            </>
          ) : (
            'এই ডিভাইস থেকে এখনো ব্যাকআপ নেওয়া হয়নি'
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['students', now.counts.students],
          ['payments', now.counts.payments],
          ['attendanceDays', now.counts.attendanceDays],
        ].map(([k, n]) => (
          <div key={k} className="rounded-2xl bg-slate-50 py-2.5">
            <p className="tabular text-[18px] font-extrabold text-ink">{n}</p>
            <p className="text-[11.5px] text-slate-500">{BACKUP_LABELS[k]}</p>
          </div>
        ))}
      </div>

      <Button icon={Download} block disabled={busy} onClick={backup}>
        {busy ? 'তৈরি হচ্ছে…' : 'ব্যাকআপ ডাউনলোড (সব তথ্য)'}
      </Button>
      <Button variant="secondary" icon={Upload} block onClick={() => fileRef.current?.click()}>
        ব্যাকআপ থেকে ফেরত আনুন
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      <p className="text-[12px] leading-relaxed text-slate-400">
        ফাইলে শিক্ষার্থী, বেতন, পেমেন্ট, জরিমানা, পরীক্ষা, হাজিরা, ক্যাশ ক্লোজ, নোটিশ, ছুটির আবেদন ও অডিট লগ — সবই থাকে। {settings.className}-এর বাইরের কোনো তথ্য থাকে না।
      </p>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="ব্যাকআপ ফেরত আনবেন?" subtitle="ফাইলে যা আছে">
        {pending && <RestoreForm pending={pending} onClose={() => setPending(null)} importBackup={importBackup} getBackupData={getBackupData} classId={classId} />}
      </Sheet>
    </>
  );
}

function RestoreForm({ pending, onClose, importBackup, getBackupData, classId }) {
  const { toast } = useUI();
  const { data, summary, warnings } = pending;
  const [saveFirst, setSaveFirst] = useState(true);
  const [withSettings, setWithSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (isOffline()) return toast(OFFLINE_MESSAGE, 'error');
    setBusy(true);
    try {
      // A safety copy of what is here now, in case the file turns out to be the wrong one
      if (saveFirst) download(await getBackupData(), `${classId}_Before_Restore_${todayISO()}.json`);
      const n = await importBackup(data, { restoreSettings: withSettings });
      toast(`${n} জন শিক্ষার্থীসহ সব তথ্য ফেরত এসেছে`);
      onClose();
    } catch (e) {
      toast(`ফেরত আনা ব্যর্থ: ${e.message}`, 'error');
      setBusy(false);
    }
  };

  const rows = Object.entries(summary.counts).filter(([, n]) => n > 0);
  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
        <FileJson className="h-6 w-6 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-bold text-ink">{summary.classId || 'ক্লাস জানা নেই'}</p>
          <p className="text-[12.5px] text-slate-500">{summary.exportDate ? `নেওয়া হয়েছে ${fmtDate(summary.exportDate.slice(0, 10))}` : 'তারিখ জানা নেই'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {rows.map(([k, n]) => (
          <div key={k} className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <p className="tabular text-[17px] font-extrabold text-ink">{n}</p>
            <p className="text-[12px] text-slate-500">{BACKUP_LABELS[k]}</p>
          </div>
        ))}
      </div>

      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}
        </div>
      ))}

      <p className="text-[13px] leading-relaxed text-slate-600">একই আইডির তথ্য ফাইলেরটা দিয়ে বদলে যাবে। ফাইলে নেই এমন তথ্য মুছবে না।</p>

      {[
        [saveFirst, setSaveFirst, 'আগে এখনকার তথ্যের একটা ব্যাকআপ নামান (নিরাপদ)'],
        [withSettings, setWithSettings, 'ফি নিয়ম ও সেটিংসও ফেরত আনুন'],
      ].map(([on, set, label]) => (
        <button key={label} type="button" onClick={() => set(!on)} className="press flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 text-left">
          <Checkbox checked={on} />
          <span className="text-[14px] font-semibold text-ink">{label}</span>
        </button>
      ))}

      <Button size="lg" block icon={Upload} disabled={busy} onClick={run}>
        {busy ? 'ফেরত আনা হচ্ছে…' : 'ফেরত আনুন'}
      </Button>
    </div>
  );
}
