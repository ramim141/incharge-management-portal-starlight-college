import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown, Printer, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button, Sheet, cx } from './ui';
import { taka, monthBn, fmtDate, todayISO, feeStatus, feeBadge, EN_MONTHS } from '../lib/format';

/**
 * Component and helper for downloading official Student Attendance & Fee Statement PDF
 */
export function StatementDownloadButton({
  student: propStudent,
  snap,
  fees: propFees,
  examFees: propExams,
  payments: propPayments,
  fines: propFines,
  attendance: propAtt,
  attStats: propAttStats,
  totalDue: propTotalDue,
  settings: propSettings,
  className,
  variant = 'default',
}) {
  const app = useApp?.() || {};
  const student = propStudent || snap?.student || app.students?.[0] || {};
  const settings = propSettings || snap?.cls || app.settings || {};
  const fees = propFees || snap?.fees || app.fees || [];
  const examFees = propExams || snap?.exams || app.examFees || [];
  const payments = propPayments || snap?.payments || app.payments || [];
  const fines = propFines || snap?.fines || app.fines || [];
  const attStats = propAttStats || snap?.att || (app.getStudentAttendanceStats ? app.getStudentAttendanceStats(student.id) : {});
  const totalDue = propTotalDue !== undefined ? propTotalDue : (snap?.totalDue ?? (app.calculateStudentTotalDue ? app.calculateStudentTotalDue(student.id) : 0));

  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await generateStatementPdf({ student, snap, fees, examFees, payments, fines, attendance: propAtt, attStats, totalDue, settings });
    } catch (err) {
      console.error('Statement PDF error:', err);
      // Fallback: open print preview
      setPreviewOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className={cx(
          'press flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-bold transition shadow-card ring-1',
          variant === 'brand'
            ? 'bg-brand-600 text-white ring-brand-700 hover:bg-brand-700'
            : variant === 'secondary'
              ? 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
          className,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <FileDown className="h-4 w-4 text-brand-600" />}
        <span>{busy ? 'PDF তৈরি হচ্ছে…' : 'স্টেটমেন্ট PDF ডাউনলোড'}</span>
      </button>

      {/* Hidden printable statement template */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -100 }}>
        <StatementTemplate
          id="statement-print-template"
          student={student}
          snap={snap}
          fees={fees}
          examFees={examFees}
          payments={payments}
          fines={fines}
          attStats={attStats}
          totalDue={totalDue}
          settings={settings}
        />
      </div>

      {/* Fallback browser print sheet */}
      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title="স্টেটমেন্ট প্রিন্ট" full>
        <div className="space-y-4 p-4">
          <div className="flex justify-end gap-2">
            <Button
              icon={Printer}
              onClick={() => {
                window.print();
              }}
            >
              প্রিন্ট / PDF সেভ করুন
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <StatementTemplate
              student={student}
              snap={snap}
              fees={fees}
              examFees={examFees}
              payments={payments}
              fines={fines}
              attStats={attStats}
              totalDue={totalDue}
              settings={settings}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}

export async function generateStatementPdf({ student, snap, fees, examFees, payments, fines, attendance, attStats, totalDue, settings }) {
  await new Promise((r) => setTimeout(r, 60));
  const el = document.getElementById('statement-print-template');
  if (!el) throw new Error('Statement element not found');

  const canvas = await html2canvas(el, {
    scale: 2, // 2x high resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, Math.min(imgHeight, 280));
  const cleanName = (student.name || 'শিক্ষার্থী').trim().replace(/[\s\/\\:*?"<>|]+/g, '_');
  const fileName = `স্টেটমেন্ট_রোল_${student.roll}_${cleanName}.pdf`;
  pdf.save(fileName);
}

export function StatementTemplate({ id, student: s, snap, fees = [], examFees = [], payments = [], fines = [], attStats = {}, totalDue = 0, settings = {} }) {
  const instName = settings.institutionName || snap?.cls?.institutionName || 'কলেজ ম্যানেজমেন্ট পোর্টাল';
  const secName = settings.sectionName || snap?.cls?.sectionName || settings.className || '';
  const now = new Date();

  const sortedFees = [...fees]
    .filter((f) => !f.beforeStart)
    .sort((a, b) => Number(a.year) - Number(b.year) || EN_MONTHS.indexOf(a.month) - EN_MONTHS.indexOf(b.month));

  const totalPayable = sortedFees.reduce((a, f) => a + Number(f.amount || 0) + Number(f.fine || 0) - Number(f.fineWaived || 0), 0);
  const totalPaid = sortedFees.reduce((a, f) => a + Number(f.paid || 0), 0);
  const currentDue = sortedFees.reduce((a, f) => a + Number(f.due || 0), 0);

  const att = attStats || { totalClasses: 0, present: 0, absent: 0, late: 0, leave: 0, percentage: 100 };

  return (
    <div id={id} className="w-[800px] bg-white p-8 font-sans text-slate-900 border border-slate-300">
      {/* College Header */}
      <div className="border-b-2 border-slate-800 pb-4 text-center">
        <h1 className="text-[24px] font-black tracking-tight text-slate-900">{instName}</h1>
        {secName && <p className="text-[14px] font-semibold text-slate-600">{secName}</p>}
        <div className="mt-2 inline-block rounded-full bg-slate-900 px-4 py-1 text-[13px] font-bold text-white uppercase tracking-wider">
          শিক্ষার্থীর হাজিরা ও ফি বিবরণী স্টেটমেন্ট
        </div>
        <p className="mt-1 text-[11px] text-slate-500">ইস্যু তারিখ: {fmtDate(todayISO())}</p>
      </div>

      {/* Student Particulars */}
      <div className="my-5 rounded-xl border border-slate-300 bg-slate-50/70 p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div>
            <span className="font-semibold text-slate-500">শিক্ষার্থীর নাম: </span>
            <span className="font-bold text-slate-900">{s.name} {s.nameEn ? `(${s.nameEn})` : ''}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">স্টুডেন্ট আইডি: </span>
            <span className="font-mono font-bold text-slate-900">{s.studentId || `রোল ${s.roll}`}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">শ্রেণি রোল: </span>
            <span className="font-bold text-slate-900">{s.roll}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">বিভাগ / শাখা: </span>
            <span className="font-bold text-slate-900">{s.groupLabel || s.group || '—'} {s.sectionLabel ? `· ${s.sectionLabel}` : ''}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">পিতার নাম: </span>
            <span className="text-slate-800">{s.fatherName || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">মাতার নাম: </span>
            <span className="text-slate-800">{s.motherName || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">অভিভাবকের মোবাইল: </span>
            <span className="font-mono text-slate-800">{s.guardianPhone || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">ভর্তির তারিখ: </span>
            <span className="text-slate-800">{fmtDate(s.admissionDate)}</span>
          </div>
        </div>
      </div>

      {/* Fee Statement Table */}
      <div className="mb-6">
        <h2 className="mb-2 text-[14px] font-bold text-slate-800 border-l-4 border-slate-800 pl-2">মাসিক ফি বিবরণী</h2>
        <table className="w-full border-collapse border border-slate-300 text-left text-[12px]">
          <thead>
            <tr className="bg-slate-100 font-bold text-slate-700">
              <th className="border border-slate-300 px-3 py-2">মাস</th>
              <th className="border border-slate-300 px-3 py-2 text-right">ধার্য বেতন</th>
              <th className="border border-slate-300 px-3 py-2 text-right">জরিমানা</th>
              <th className="border border-slate-300 px-3 py-2 text-right">পরিশোধিত</th>
              <th className="border border-slate-300 px-3 py-2 text-right">বকেয়া</th>
              <th className="border border-slate-300 px-3 py-2 text-center">অবস্থা</th>
            </tr>
          </thead>
          <tbody>
            {sortedFees.map((f) => {
              const st = feeStatus(f);
              return (
                <tr key={f.id} className="border-b border-slate-200">
                  <td className="border border-slate-300 px-3 py-1.5 font-semibold">{monthBn(f.month)} {f.year}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular">{taka(f.amount)}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular">{f.fine ? taka(f.fine - (f.fineWaived || 0)) : '—'}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular font-semibold text-emerald-700">{taka(f.paid)}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right tabular font-bold text-rose-600">{Number(f.due) > 0 ? taka(f.due) : '—'}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-semibold">
                    <span className={cx(
                      'inline-block rounded px-2 py-0.5 text-[11px]',
                      st === 'Paid' ? 'bg-emerald-100 text-emerald-800' : st === 'Overdue' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    )}>
                      {st === 'Paid' ? 'পরিশোধিত' : st === 'Overdue' ? 'মেয়াদোত্তীর্ণ' : 'বাকি'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-800">
              <td className="border border-slate-300 px-3 py-2">সর্বমোট:</td>
              <td className="border border-slate-300 px-3 py-2 text-right tabular">{taka(totalPayable)}</td>
              <td className="border border-slate-300 px-3 py-2 text-right tabular">—</td>
              <td className="border border-slate-300 px-3 py-2 text-right tabular text-emerald-800">{taka(totalPaid)}</td>
              <td className="border border-slate-300 px-3 py-2 text-right tabular text-rose-700">{taka(currentDue)}</td>
              <td className="border border-slate-300 px-3 py-2 text-center text-[11.5px] font-extrabold">
                {currentDue === 0 ? '✓ সম্পূর্ণ পরিশোধ' : `বকেয়া ${taka(currentDue)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Attendance Summary */}
      <div className="mb-6">
        <h2 className="mb-2 text-[14px] font-bold text-slate-800 border-l-4 border-slate-800 pl-2">হাজিরা সারসংক্ষেপ</h2>
        <div className="grid grid-cols-5 gap-2 text-center text-[12.5px]">
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
            <p className="font-semibold text-slate-500">মোট ক্লাস</p>
            <p className="tabular text-[17px] font-black text-slate-800">{att.totalClasses || 0}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
            <p className="font-semibold text-emerald-700">উপস্থিতি</p>
            <p className="tabular text-[17px] font-black text-emerald-800">{att.present || 0}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2.5">
            <p className="font-semibold text-rose-700">অনুপস্থিতি</p>
            <p className="tabular text-[17px] font-black text-rose-800">{att.absent || 0}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2.5">
            <p className="font-semibold text-sky-700">ছুটি</p>
            <p className="tabular text-[17px] font-black text-sky-800">{att.leave || 0}</p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-2.5">
            <p className="font-semibold text-brand-700">উপস্থিতির হার</p>
            <p className="tabular text-[17px] font-black text-brand-900">{att.percentage ?? 100}%</p>
          </div>
        </div>
      </div>

      {/* Verification Notice & Signatures */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between text-[12px] text-slate-400">
          <span>* এটি কম্পিউটার প্রস্তুতকৃত স্বয়ংক্রিয় স্টেটমেন্ট।</span>
          <span>ওয়েব পোর্টাল: {window.location.host || 'student-portal'}</span>
        </div>

        <div className="mt-12 flex justify-between px-6 text-center text-[12.5px] font-bold text-slate-700">
          <div>
            <div className="mx-auto mb-1 w-36 border-b border-slate-400" />
            <p>শিক্ষার্থী / অভিভাবকের স্বাক্ষর</p>
          </div>
          <div>
            <div className="mx-auto mb-1 w-36 border-b border-slate-400" />
            <p>শ্রেণি ইনচার্জের স্বাক্ষর</p>
          </div>
          <div>
            <div className="mx-auto mb-1 w-36 border-b border-slate-400" />
            <p>অধ্যক্ষের স্বাক্ষর</p>
          </div>
        </div>
      </div>
    </div>
  );
}
