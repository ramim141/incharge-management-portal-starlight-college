import React, { useState, useMemo } from 'react';
import {
  Printer, Download, FileText, Search, Calendar, CheckCircle2,
  X, Phone, AlertTriangle, LayoutGrid, Table as TableIcon,
  ChevronRight, ChevronDown, Users, Sparkles, Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, Badge, Button, IconButton, RollBadge, cx, Sheet } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import {
  EN_MONTHS, BN_MONTHS, monthBn, taka, waLink, downloadCSV, todayISO
} from '../lib/format';
import { useUI } from '../context/UIContext';

const BN_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

export function MonthlyAttendanceSheet({
  students = [],
  attendance = {},
  settings = {},
  onOpenStudent,
}) {
  const { toast } = useUI();

  // Current real date defaults
  const now = new Date();
  const currentMonthName = EN_MONTHS[now.getMonth()];
  const currentYearNum = now.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(settings.currentMonth || currentMonthName);
  const [selectedYear, setSelectedYear] = useState(settings.currentYear || currentYearNum);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (mobile friendly) | 'table' (full sheet)
  const [activeStudent, setActiveStudent] = useState(null);
  const [printTarget, setPrintTarget] = useState(null); // 'class' | 'student' | null
  const [exportingStudent, setExportingStudent] = useState(null);
  const [exportLoading, setExportLoading] = useState(null); // student.id | null

  // Month indexing
  const monthIdx = useMemo(() => {
    const idx = EN_MONTHS.findIndex(
      (m) => m.toLowerCase() === String(selectedMonth || '').toLowerCase()
    );
    return idx >= 0 ? idx : now.getMonth();
  }, [selectedMonth, now]);

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, monthIdx + 1, 0).getDate();
  }, [selectedYear, monthIdx]);

  // Generate days array [1, 2, ..., daysInMonth] with dates and weekday info
  const daysInfo = useMemo(() => {
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const mStr = String(monthIdx + 1).padStart(2, '0');
      const dateKey = `${selectedYear}-${mStr}-${dayStr}`;
      const dt = new Date(selectedYear, monthIdx, d);
      const dayOfWeek = dt.getDay(); // 0: Sun ... 5: Fri ... 6: Sat
      const isFriday = dayOfWeek === 5;
      const isRecorded = !!attendance[dateKey];
      list.push({
        day: d,
        dateKey,
        dayOfWeek,
        isFriday,
        weekdayBn: BN_WEEKDAYS[dayOfWeek],
        isRecorded,
      });
    }
    return list;
  }, [daysInMonth, monthIdx, selectedYear, attendance]);

  // Total working class days taken in this month
  const recordedDays = useMemo(() => {
    return daysInfo.filter((d) => d.isRecorded);
  }, [daysInfo]);

  // Filter students
  const filteredStudents = useMemo(() => {
    const active = students.filter((s) => s.status !== 'inactive');
    const q = search.trim().toLowerCase();
    if (!q) return active.sort((a, b) => Number(a.roll) - Number(b.roll));
    return active
      .filter((s) => String(s.roll).includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => Number(a.roll) - Number(b.roll));
  }, [students, search]);

  // Compute attendance summary for a single student in this month
  const getStudentStats = (student) => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    const daily = {};

    daysInfo.forEach((d) => {
      const dayRec = attendance[d.dateKey];
      if (dayRec) {
        const st = dayRec[student.id];
        if (st === 'Absent') {
          absent++;
          daily[d.day] = { status: 'Absent', symbol: 'অ', tone: 'red', text: 'অনুপস্থিত' };
        } else if (st === 'Late') {
          late++;
          daily[d.day] = { status: 'Late', symbol: 'দে', tone: 'amber', text: 'দেরি' };
        } else if (st === 'Leave') {
          leave++;
          daily[d.day] = { status: 'Leave', symbol: 'ছু', tone: 'sky', text: 'ছুটি' };
        } else {
          // Default present if recorded
          present++;
          daily[d.day] = { status: 'Present', symbol: 'উ', tone: 'green', text: 'উপস্থিত' };
        }
      } else {
        if (d.isFriday) {
          daily[d.day] = { status: 'Holiday', symbol: 'শু', tone: 'slate', text: 'সাপ্তাহিক ছুটি' };
        } else {
          daily[d.day] = { status: 'NoClass', symbol: '—', tone: 'none', text: 'ক্লাস হয়নি' };
        }
      }
    });

    const totalRecorded = recordedDays.length;
    // Calculate rate (present + 0.5 * late) / total
    const effectivePresent = present + late * 0.5;
    const percentage = totalRecorded > 0 ? Math.round((effectivePresent / totalRecorded) * 100) : 0;

    return {
      totalRecorded,
      present,
      absent,
      late,
      leave,
      percentage,
      daily,
    };
  };

  // Class overall stats
  const classStats = useMemo(() => {
    if (!filteredStudents.length || !recordedDays.length) {
      return { avgPct: 0, highAttCount: 0, lowAttCount: 0 };
    }
    let sumPct = 0;
    let high = 0;
    let low = 0;

    filteredStudents.forEach((s) => {
      const st = getStudentStats(s);
      sumPct += st.percentage;
      if (st.percentage >= 75) high++;
      else low++;
    });

    return {
      avgPct: Math.round(sumPct / filteredStudents.length),
      highAttCount: high,
      lowAttCount: low,
    };
  }, [filteredStudents, recordedDays]);

  // 1-Click Print entire class register
  const handlePrintClass = () => {
    setPrintTarget('class');
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 150);
  };

  // Generate crisp client-side PDF for a student
  const generateStudentPdf = async (student) => {
    setExportingStudent(student);
    // Wait for the hidden container to render with student's data
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById('student-slip-export-target');
    if (!el) throw new Error('Export element not found');

    const canvas = await html2canvas(el, {
      scale: 2, // 2x sharp resolution
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
    const fileName = `হাজিরা_শিট_রোল_${student.roll}_${cleanName}_${monthBn(selectedMonth)}_${selectedYear}.pdf`;

    return { pdf, fileName };
  };

  // Direct 1-Click Download of individual student PDF
  const handleDownloadStudentPdf = async (student) => {
    setExportLoading(student.id);
    toast('হাজিরা শিট PDF তৈরি হচ্ছে...', 'info');
    try {
      const { pdf, fileName } = await generateStudentPdf(student);
      pdf.save(fileName);
      toast('PDF ফাইলটি ডাউনলোড সম্পন্ন হয়েছে', 'success');
    } catch (err) {
      console.error('PDF download error:', err);
      // Fallback: browser print dialog
      setActiveStudent(student);
      setPrintTarget('student');
      setTimeout(() => {
        window.print();
        setPrintTarget(null);
      }, 150);
    } finally {
      setExportLoading(null);
      setExportingStudent(null);
    }
  };

  // 1-Click CSV Download of full month sheet
  const handleDownloadCSV = () => {
    const headers = [
      'রোল',
      'শিক্ষার্থীর নাম',
      'ফোন নম্বর',
      ...daysInfo.map((d) => `${d.day} (${d.weekdayBn})`),
      'মোট কার্যদিবস',
      'উপস্থিত',
      'অনুপস্থিত',
      'দেরি',
      'ছুটি',
      'উপস্থিতির হার (%)',
    ];

    const rows = filteredStudents.map((s) => {
      const st = getStudentStats(s);
      return [
        s.roll,
        s.name,
        s.guardianPhone || '',
        ...daysInfo.map((d) => st.daily[d.day]?.symbol || '—'),
        st.totalRecorded,
        st.present,
        st.absent,
        st.late,
        st.leave,
        `${st.percentage}%`,
      ];
    });

    downloadCSV(
      `হাজিরা_খাতা_${monthBn(selectedMonth)}_${selectedYear}.csv`,
      headers,
      rows
    );
    toast('এক্সেল / CSV ফাইল ডাউনলোড হয়েছে');
  };

  // Send WhatsApp monthly summary directly to the student's guardian's number
  const handleSendWhatsApp = async (student) => {
    if (!student.guardianPhone) {
      toast('শিক্ষার্থীর অভিভাবকের ফোন নম্বর নেই', 'error');
      return;
    }

    const st = getStudentStats(student);
    const teacherName = settings.inchargeName || 'শ্রেণি ইনচার্জ';
    const className = settings.className || 'ক্লাস';
    const collegeName = settings.institutionName || 'স্টারলাইট কলেজ';
    const mName = monthBn(selectedMonth);

    const portalUrl = typeof window !== 'undefined' && student.roll
      ? `${window.location.origin}?roll=${student.roll}`
      : '';

    const lines = [
      'শ্রদ্ধেয় অভিভাবক,',
      `*${collegeName}*-এর *${className}*-এর শিক্ষার্থী *${student.name}* (রোল: ${student.roll})-এর *${mName} ${selectedYear}* মাসের অফিসিয়াল হাজিরা বিবরণ:`,
      '',
      `🏫 মোট কার্যদিবস: ${st.totalRecorded} দিন`,
      `✅ উপস্থিত: ${st.present} দিন`,
      `❌ অনুপস্থিত: ${st.absent} দিন`,
      `⏰ ক্লাসে দেরি: ${st.late} দিন`,
      `📝 অনুমোদিত ছুটি: ${st.leave} দিন`,
      `📊 হাজিরার হার: *${st.percentage}%*`,
      '',
      st.percentage < 75
        ? '⚠️ *সতর্কতা:* শিক্ষার্থীর উপস্থিতির হার ৭৫%-এর কম রয়েছে। ক্লাসে নিয়মিত উপস্থিতি নিশ্চিত করার জন্য আপনার আন্তরিক সহযোগিতা কামনা করছি।'
        : '✨ ক্লাসে নিয়মিত উপস্থিত থাকার জন্য শিক্ষার্থীকে আন্তরিক ধন্যবাদ ও শুভকামনা।',
      '',
      portalUrl ? `🌐 *অনলাইনে হাজিরা শিট (PDF) দেখতে:*\n${portalUrl}\n` : '',
      `— ${teacherName}`,
      `শ্রেণি ইনচার্জ, ${className} (${collegeName})`,
    ].filter(Boolean);

    const waUrl = waLink(student.guardianPhone, lines.join('\n'));

    // 1. Immediately open WhatsApp to that specific guardian's number
    window.open(waUrl, '_blank');

    // 2. Also generate and download the student's monthly slip PDF file
    setExportLoading(student.id);
    toast(`${student.name}-এর অভিভাবকের নম্বরে (${student.guardianPhone}) WhatsApp ওপেন হয়েছে এবং PDF ডাউনলোড হচ্ছে...`, 'info');

    try {
      const { pdf, fileName } = await generateStudentPdf(student);
      pdf.save(fileName);
      toast(`PDF ডাউনলোড সম্পন্ন হয়েছে! চ্যাটে ফাইলটি সংযুক্ত করে দিতে পারেন।`, 'success');
    } catch (err) {
      console.warn('PDF auto-download warning:', err);
    } finally {
      setExportLoading(null);
      setExportingStudent(null);
    }
  };

  const institutionName = settings.institutionName || 'স্টারলাইট কলেজ';
  const className = settings.className || 'একাদশ শ্রেণি';
  const inchargeName = settings.inchargeName || 'শ্রেণি ইনচার্জ';

  return (
    <div className="space-y-3.5 pb-28 sm:pb-32">
      {/* ──────────────── Top Download Banner (Mobile-Optimized) ──────────────── */}
      <div className="no-print overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-brand-700 p-4 text-white shadow-lift">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-xs">
                <Sparkles className="h-3 w-3 text-amber-300" />
                মাসিক রিপোর্ট
              </span>
              <span className="text-[12px] font-medium text-white/80">
                {monthBn(selectedMonth)} {selectedYear}
              </span>
            </div>
            <h3 className="mt-1 text-[17px] font-black leading-snug tracking-tight">
              পুরো ক্লাসের মাসিক হাজিরা শিট
            </h3>
            <p className="text-[12px] text-white/85">
              কার্যদিবস: <strong className="text-white">{recordedDays.length} দিন</strong> · শিক্ষার্থী: <strong className="text-white">{filteredStudents.length} জন</strong>
            </p>
          </div>

          {/* Quick 1-Click Action Buttons */}
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={handlePrintClass}
              className="press flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-black text-brand-700 shadow-sm active:bg-brand-50 hover:bg-white/95 transition"
              title="পুরো ক্লাসের মাসিক হাজিরা খাতা PDF হিসেবে ডাউনলোড বা প্রিন্ট করুন"
            >
              <Printer className="h-4 w-4 shrink-0 text-brand-600" />
              <span>পুরো ক্লাসের PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="press flex items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3 py-2.5 text-[13px] font-bold text-white border border-white/20 active:bg-white/25 transition backdrop-blur-xs"
              title="এক্সেল বা গুগল শিটে ব্যবহারের জন্য CSV ডাউনলোড করুন"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">এক্সেল</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────── Controls: Month Picker & View Switcher ──────────────── */}
      <div className="no-print flex items-center justify-between gap-2">
        {/* Month & Year Combined Picker (Ultra-compact & never clips) */}
        <div className="relative flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-2xs hover:border-slate-300">
          <Calendar className="h-4 w-4 text-brand-600 shrink-0" />
          <span className="truncate text-[13px] font-bold text-ink">
            {monthBn(selectedMonth)} {selectedYear}
          </span>
          <ChevronDown className="pointer-events-none h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={`${selectedMonth}_${selectedYear}`}
            onChange={(e) => {
              const [m, y] = e.target.value.split('_');
              setSelectedMonth(m);
              setSelectedYear(Number(y));
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="মাস ও বছর নির্বাচন করুন"
          >
            {[currentYearNum, currentYearNum - 1, currentYearNum + 1].flatMap((yr) =>
              EN_MONTHS.map((m) => (
                <option key={`${m}_${yr}`} value={`${m}_${yr}`}>
                  {monthBn(m)} {yr}
                </option>
              ))
            )}
          </select>
        </div>

        {/* View Mode Toggle: Cards vs Table (Compact pills with shrink-0) */}
        <div className="flex shrink-0 items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cx(
              'press flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-bold transition select-none',
              viewMode === 'cards'
                ? 'bg-white text-brand-700 shadow-2xs'
                : 'text-slate-600 hover:text-ink'
            )}
            title="মোবাইল ফ্রেন্ডলি কার্ড ভিউ"
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
            <span>কার্ড</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cx(
              'press flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-bold transition select-none',
              viewMode === 'table'
                ? 'bg-white text-brand-700 shadow-2xs'
                : 'text-slate-600 hover:text-ink'
            )}
            title="পুরো মাসের হাজিরা খাতা গ্রিড"
          >
            <TableIcon className="h-3.5 w-3.5 shrink-0" />
            <span>খাতা</span>
          </button>
        </div>
      </div>

      {/* ──────────────── Sleek, Compact 4-Metric Stats Strip ──────────────── */}
      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-center shadow-2xs">
          <p className="tabular text-[17px] font-black text-ink">{recordedDays.length} দিন</p>
          <p className="text-[11px] font-semibold text-slate-500">মোট কার্যদিবস</p>
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-2.5 text-center shadow-2xs">
          <p className="tabular text-[17px] font-black text-emerald-700">{classStats.avgPct}%</p>
          <p className="text-[11px] font-semibold text-emerald-800">গড় উপস্থিতি</p>
        </div>
        <div className="rounded-xl border border-brand-200/70 bg-brand-50/50 p-2.5 text-center shadow-2xs">
          <p className="tabular text-[17px] font-black text-brand-700">{classStats.highAttCount} জন</p>
          <p className="text-[11px] font-semibold text-brand-800">৭৫% বা বেশি</p>
        </div>
        <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-2.5 text-center shadow-2xs">
          <p className="tabular text-[17px] font-black text-rose-700">{classStats.lowAttCount} জন</p>
          <p className="text-[11px] font-semibold text-rose-800">৭৫% এর নিচে</p>
        </div>
      </div>

      {/* ──────────────── Search Input ──────────────── */}
      <div className="no-print relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="রোল বা নাম দিয়ে খুঁজুন..."
          className="h-10 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-8 text-[13px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 shadow-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ──────────────── VIEW 1: Mobile-Friendly Student Cards ──────────────── */}
      {viewMode === 'cards' && (
        <div className="no-print space-y-2.5">
          {filteredStudents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
              কোনো শিক্ষার্থী পাওয়া যায়নি
            </div>
          ) : (
            filteredStudents.map((s) => {
              const st = getStudentStats(s);
              const isLow = st.percentage < 75 && st.totalRecorded > 0;
              const rateTone = st.totalRecorded === 0 ? 'slate' : st.percentage >= 80 ? 'green' : st.percentage >= 75 ? 'amber' : 'red';
              const isThisLoading = exportLoading === s.id;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition hover:border-brand-200 hover:shadow-card"
                >
                  {/* Student Info Top Row */}
                  <div className="flex items-center gap-3">
                    <RollBadge roll={s.roll} seed={s.id} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="truncate text-[15px] font-bold text-ink leading-tight">
                          {s.name}
                        </h4>
                        <span
                          className={cx(
                            'rounded-full px-2.5 py-0.5 text-[12px] font-black shrink-0',
                            rateTone === 'green' && 'bg-emerald-100 text-emerald-800',
                            rateTone === 'amber' && 'bg-amber-100 text-amber-800',
                            rateTone === 'red' && 'bg-rose-100 text-rose-800',
                            rateTone === 'slate' && 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {st.percentage}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-500 truncate">
                        {s.guardianPhone ? `অভিভাবক: ${s.guardianPhone}` : 'ফোন নম্বর সংরক্ষিত নেই'}
                      </p>
                    </div>
                  </div>

                  {/* Presence Progress Bar */}
                  <div className="mt-2.5">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cx(
                          'h-full rounded-full transition-all duration-300',
                          rateTone === 'green' && 'bg-emerald-500',
                          rateTone === 'amber' && 'bg-amber-400',
                          rateTone === 'red' && 'bg-rose-500',
                          rateTone === 'slate' && 'bg-slate-300'
                        )}
                        style={{ width: `${Math.min(100, Math.max(4, st.percentage))}%` }}
                      />
                    </div>
                  </div>

                  {/* Attendance Breakdown Mini Chips */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold">
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      উ: {st.present} দিন
                    </span>
                    <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-rose-700">
                      অ: {st.absent} দিন
                    </span>
                    {st.late > 0 && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-amber-700">
                        দে: {st.late} দিন
                      </span>
                    )}
                    {st.leave > 0 && (
                      <span className="rounded-lg bg-sky-50 px-2 py-0.5 text-sky-700">
                        ছু: {st.leave} দিন
                      </span>
                    )}
                    <span className="ml-auto text-[11px] font-normal text-slate-400">
                      মোট {st.totalRecorded} ক্লাস
                    </span>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveStudent(s)}
                      className="press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 py-2 text-[12.5px] font-bold text-slate-700 active:bg-slate-100 transition shadow-2xs hover:bg-slate-100"
                    >
                      <FileText className="h-3.5 w-3.5 text-brand-600" />
                      <span>মাসিক শিট ও PDF</span>
                    </button>

                    {s.guardianPhone ? (
                      <button
                        type="button"
                        disabled={isThisLoading}
                        onClick={() => handleSendWhatsApp(s)}
                        className={cx(
                          'press flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] font-bold text-emerald-700 active:bg-emerald-100 transition shadow-2xs hover:bg-emerald-100',
                          isThisLoading && 'opacity-70 pointer-events-none'
                        )}
                        title="অভিভাবককে WhatsApp-এ মাসিক হাজিরার PDF পাঠান"
                      >
                        {isThisLoading ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        ) : (
                          <WhatsAppIcon className="h-4 w-4" />
                        )}
                        <span className="text-[12px]">{isThisLoading ? 'PDF হচ্ছে...' : 'WhatsApp'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ──────────────── VIEW 2: Full Monthly Register Table ──────────────── */}
      {/* (Rendered when viewMode === 'table', or automatically printed when printTarget === 'class') */}
      <div
        className={cx(
          'overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/80',
          viewMode === 'cards' ? 'hidden print:block' : 'block',
          printTarget === 'class' ? 'print-area' : ''
        )}
      >
        {/* Printable Formal Header */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 text-center">
          <h2 className="text-[18px] font-black text-ink tracking-tight">{institutionName}</h2>
          <p className="mt-0.5 text-[14px] font-bold text-brand-700">
            মাসিক শিক্ষার্থী হাজিরা খাতা (Attendance Register)
          </p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12.5px] font-semibold text-slate-600">
            <span>শ্রেণি: {className}</span>
            <span>·</span>
            <span>মাস: {monthBn(selectedMonth)} {selectedYear}</span>
            <span>·</span>
            <span>মোট কার্যদিবস: {recordedDays.length} দিন</span>
            <span>·</span>
            <span>শ্রেণি ইনচার্জ: {inchargeName}</span>
          </p>
        </div>

        {/* Symbol Legend Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 text-[11.5px] font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">সংকেত:</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded text-center leading-4 text-[10px] font-black bg-emerald-100 text-emerald-800">
                উ
              </span>
              উপস্থিত
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded text-center leading-4 text-[10px] font-black bg-rose-100 text-rose-800">
                অ
              </span>
              অনুপস্থিত
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded text-center leading-4 text-[10px] font-black bg-amber-100 text-amber-800">
                দে
              </span>
              দেরি
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded text-center leading-4 text-[10px] font-black bg-sky-100 text-sky-800">
                ছু
              </span>
              ছুটি
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-4 w-4 rounded text-center leading-4 text-[10px] font-bold bg-slate-100 text-slate-500">
                শু
              </span>
              সাপ্তাহিক ছুটি
            </span>
          </div>
          <span className="text-slate-400">ডানে স্ক্রল করুন ➔</span>
        </div>

        {/* Grid Container */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700">
                {/* Pinned Roll */}
                <th className="sticky left-0 z-20 w-12 border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-extrabold text-ink">
                  রোল
                </th>
                {/* Pinned Name */}
                <th className="sticky left-12 z-20 min-w-[140px] max-w-[170px] border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-extrabold text-ink">
                  শিক্ষার্থীর নাম
                </th>

                {/* Day Columns 1..N */}
                {daysInfo.map((d) => (
                  <th
                    key={d.day}
                    className={cx(
                      'min-w-[26px] max-w-[30px] border-r border-slate-200 px-0.5 py-1.5 text-center font-bold',
                      d.isFriday ? 'bg-slate-200/80 text-rose-600' : 'text-slate-700'
                    )}
                    title={`${d.day} ${monthBn(selectedMonth)} (${d.weekdayBn})`}
                  >
                    <div className="text-[11px] font-extrabold leading-tight">{d.day}</div>
                    <div className="text-[9.5px] font-semibold text-slate-500 leading-tight">
                      {d.weekdayBn}
                    </div>
                  </th>
                ))}

                {/* Monthly Totals Header */}
                <th className="min-w-[42px] border-r border-slate-200 bg-slate-100/90 px-1.5 py-2 text-center font-extrabold text-slate-700">
                  মোট
                </th>
                <th className="min-w-[42px] border-r border-slate-200 bg-emerald-50 px-1.5 py-2 text-center font-extrabold text-emerald-800">
                  উ
                </th>
                <th className="min-w-[42px] border-r border-slate-200 bg-rose-50 px-1.5 py-2 text-center font-extrabold text-rose-800">
                  অ
                </th>
                <th className="min-w-[40px] border-r border-slate-200 bg-amber-50 px-1 py-2 text-center font-extrabold text-amber-800">
                  দে
                </th>
                <th className="min-w-[40px] border-r border-slate-200 bg-sky-50 px-1 py-2 text-center font-extrabold text-sky-800">
                  ছু
                </th>
                <th className="min-w-[50px] border-r border-slate-200 bg-slate-100 px-1.5 py-2 text-center font-black text-ink">
                  হার
                </th>

                {/* Action column (Hidden during print) */}
                <th className="no-print min-w-[110px] bg-slate-100 px-3 py-2 text-center font-extrabold text-slate-700">
                  অ্যাকশন
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={daysInfo.length + 9} className="py-8 text-center text-slate-400">
                    কোনো শিক্ষার্থী পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const st = getStudentStats(s);
                  const isLow = st.percentage < 75 && st.totalRecorded > 0;
                  const isThisLoading = exportLoading === s.id;

                  return (
                    <tr
                      key={s.id}
                      className={cx(
                        'transition hover:bg-slate-50/80',
                        idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                      )}
                    >
                      {/* Pinned Roll */}
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-2 py-2 text-center font-bold text-ink">
                        {s.roll}
                      </td>

                      {/* Pinned Name */}
                      <td className="sticky left-12 z-10 min-w-[140px] max-w-[170px] border-r border-slate-200 bg-inherit px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setActiveStudent(s)}
                          className="block truncate font-bold text-ink text-left hover:text-brand-600 transition"
                          title="শিক্ষার্থীর ব্যক্তিগত মাসিক হাজিরা শিট দেখতে ক্লিক করুন"
                        >
                          {s.name}
                        </button>
                        {s.guardianPhone && (
                          <span className="block truncate text-[10.5px] text-slate-400">
                            {s.guardianPhone}
                          </span>
                        )}
                      </td>

                      {/* Day cells 1..N */}
                      {daysInfo.map((d) => {
                        const cell = st.daily[d.day];
                        const tone = cell?.tone;

                        return (
                          <td
                            key={d.day}
                            className={cx(
                              'border-r border-slate-100 p-0 text-center font-extrabold tabular leading-none select-none',
                              d.isFriday && 'bg-slate-100/70 text-slate-400'
                            )}
                            title={`${s.name} · ${d.day} তারিখ: ${cell?.text || '—'}`}
                          >
                            <span
                              className={cx(
                                'inline-block h-6 w-full text-center leading-6 text-[11px]',
                                tone === 'green' && 'bg-emerald-50 text-emerald-700',
                                tone === 'red' && 'bg-rose-100 text-rose-700 font-black',
                                tone === 'amber' && 'bg-amber-100 text-amber-800',
                                tone === 'sky' && 'bg-sky-100 text-sky-800',
                                tone === 'slate' && 'text-slate-400 font-normal',
                                tone === 'none' && 'text-slate-300 font-light'
                              )}
                            >
                              {cell?.symbol || '—'}
                            </span>
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="border-r border-slate-200 px-1 py-2 text-center font-bold text-slate-700">
                        {st.totalRecorded}
                      </td>
                      <td className="border-r border-slate-200 bg-emerald-50/50 px-1 py-2 text-center font-extrabold text-emerald-700">
                        {st.present}
                      </td>
                      <td className="border-r border-slate-200 bg-rose-50/50 px-1 py-2 text-center font-extrabold text-rose-700">
                        {st.absent}
                      </td>
                      <td className="border-r border-slate-200 bg-amber-50/50 px-1 py-2 text-center font-bold text-amber-700">
                        {st.late}
                      </td>
                      <td className="border-r border-slate-200 bg-sky-50/50 px-1 py-2 text-center font-bold text-sky-700">
                        {st.leave}
                      </td>
                      <td
                        className={cx(
                          'border-r border-slate-200 px-1 py-2 text-center font-black',
                          isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100/60 text-emerald-800'
                        )}
                      >
                        {st.percentage}%
                      </td>

                      {/* Action buttons (No print) */}
                      <td className="no-print px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Individual Slip Button */}
                          <button
                            type="button"
                            onClick={() => setActiveStudent(s)}
                            className="press flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                            title="এই শিক্ষার্থীর মাসিক শিট দেখুন ও ডাউনলোড করুন"
                          >
                            <FileText className="h-3 w-3 text-brand-600" />
                            <span>শিট</span>
                          </button>

                          {/* WhatsApp to guardian */}
                          {s.guardianPhone && (
                            <button
                              type="button"
                              disabled={isThisLoading}
                              onClick={() => handleSendWhatsApp(s)}
                              className={cx(
                                'press flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100 transition',
                                isThisLoading && 'opacity-70 pointer-events-none'
                              )}
                              title="অভিভাবককে WhatsApp-এ মাসিক হাজিরার PDF পাঠান"
                            >
                              {isThisLoading ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                              ) : (
                                <WhatsAppIcon className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Signature Footers */}
        <div className="hidden print:flex items-end justify-between border-t border-slate-200 p-8 pt-16 text-[12px] font-semibold text-slate-700">
          <div className="text-center">
            <div className="w-48 border-t border-slate-500 pt-1">
              শ্রেণি ইনচার্জের স্বাক্ষর ও তারিখ
            </div>
          </div>
          <div className="text-center">
            <div className="w-48 border-t border-slate-500 pt-1">
              অধ্যক্ষের স্বাক্ষর ও সিল
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── Individual Student Monthly Sheet Modal ──────────────── */}
      {activeStudent && (
        <Sheet
          open={!!activeStudent}
          onClose={() => setActiveStudent(null)}
          title="শিক্ষার্থীর মাসিক হাজিরা প্রতিবেদন"
          subtitle={`${activeStudent.name} (রোল: ${activeStudent.roll}) · ${monthBn(selectedMonth)} ${selectedYear}`}
        >
          {(() => {
            const st = getStudentStats(activeStudent);
            const isGood = st.percentage >= 75;
            const isThisLoading = exportLoading === activeStudent.id;

            return (
              <div className="space-y-4 pt-1">
                {/* ── Printable Slip Container ── */}
                <div
                  id="student-monthly-slip"
                  className={cx(
                    'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-4',
                    printTarget === 'student' ? 'print-area' : ''
                  )}
                >
                  {/* Slip Header */}
                  <div className="border-b border-slate-200 pb-3 text-center">
                    <h3 className="text-[17px] font-black text-ink">{institutionName}</h3>
                    <p className="text-[13px] font-bold text-brand-600">
                      শিক্ষার্থীর মাসিক হাজিরা বিবরণী (Monthly Attendance Slip)
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                      মাস: {monthBn(selectedMonth)} {selectedYear} · শ্রেণি: {className}
                    </p>
                  </div>

                  {/* Student Info Box */}
                  <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50/80 p-3 text-[12.5px] border border-slate-200/70">
                    <div>
                      <span className="text-slate-500">শিক্ষার্থীর নাম: </span>
                      <strong className="text-ink">{activeStudent.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">রোল নম্বর: </span>
                      <strong className="text-ink">{activeStudent.roll}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">শ্রেণি / বিভাগ: </span>
                      <strong className="text-ink">{className}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">অভিভাবকের ফোন: </span>
                      <strong className="text-ink">{activeStudent.guardianPhone || 'নেই'}</strong>
                    </div>
                  </div>

                  {/* 3 KPI Summary Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
                      <p className="tabular text-[18px] font-black text-ink">{st.totalRecorded} দিন</p>
                      <p className="text-[11px] font-semibold text-slate-500">মোট ক্লাস</p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 shadow-xs">
                      <p className="tabular text-[18px] font-black text-emerald-700">{st.present} দিন</p>
                      <p className="text-[11px] font-semibold text-emerald-800">উপস্থিতি</p>
                    </div>

                    <div
                      className={cx(
                        'rounded-xl border p-2.5 shadow-xs',
                        isGood
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      )}
                    >
                      <p className="tabular text-[18px] font-black leading-tight">{st.percentage}%</p>
                      <p className="text-[11px] font-semibold">উপস্থিতির হার</p>
                    </div>
                  </div>

                  {/* Absent / Late / Leave breakdown */}
                  <div className="flex items-center justify-around rounded-xl bg-slate-50/60 p-2 text-[12px] border border-slate-200/60">
                    <span className="text-rose-700 font-bold">
                      অনুপস্থিত: <span className="tabular">{st.absent} দিন</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-700 font-bold">
                      দেরি: <span className="tabular">{st.late} দিন</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-sky-700 font-bold">
                      ছুটি: <span className="tabular">{st.leave} দিন</span>
                    </span>
                  </div>

                  {/* Calendar Matrix of the Month */}
                  <div>
                    <h4 className="mb-2 text-[12.5px] font-bold text-slate-700">
                      দৈনিক হাজিরার বিবরণ:
                    </h4>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                      {BN_WEEKDAYS.map((w, i) => (
                        <div
                          key={w}
                          className={cx(
                            'py-1 font-bold rounded',
                            i === 5 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {w}
                        </div>
                      ))}
                      {/* Empty padding cells before 1st day of month */}
                      {Array.from({ length: daysInfo[0]?.dayOfWeek || 0 }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-8" />
                      ))}
                      {/* Day cells */}
                      {daysInfo.map((d) => {
                        const cell = st.daily[d.day];
                        const tone = cell?.tone;

                        return (
                          <div
                            key={d.day}
                            className={cx(
                              'flex flex-col items-center justify-center rounded-lg border p-1 h-10',
                              tone === 'green' && 'border-emerald-200 bg-emerald-50/80 text-emerald-800 font-bold',
                              tone === 'red' && 'border-rose-200 bg-rose-50 text-rose-700 font-extrabold',
                              tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800 font-bold',
                              tone === 'sky' && 'border-sky-200 bg-sky-50 text-sky-800 font-bold',
                              tone === 'slate' && 'border-slate-200/60 bg-slate-50 text-slate-400',
                              tone === 'none' && 'border-slate-100 bg-white text-slate-300'
                            )}
                            title={`${d.day} তারিখ: ${cell?.text || '—'}`}
                          >
                            <span className="text-[10px] leading-tight text-slate-500">{d.day}</span>
                            <span className="text-[11.5px] font-black leading-tight">
                              {cell?.symbol || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feedback Note */}
                  <div
                    className={cx(
                      'rounded-xl p-3 text-[12px] font-medium border',
                      isGood
                        ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                        : 'border-rose-200 bg-rose-50/70 text-rose-900'
                    )}
                  >
                    {isGood ? (
                      <p className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>শিক্ষার্থীর উপস্থিতি সন্তোষজনক (৭৫%-এর বেশি)।</span>
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>সতর্কতা: শিক্ষার্থীর উপস্থিতি ৭৫%-এর নিচে। ক্লাসে উপস্থিতি বাড়ানো প্রয়োজন।</span>
                      </p>
                    )}
                  </div>

                  {/* Printable Signature Footers for Slip */}
                  <div className="hidden print:flex items-end justify-between pt-10 text-[11px] font-semibold text-slate-600">
                    <div className="text-center">
                      <div className="w-36 border-t border-slate-400 pt-1">
                        শ্রেণি ইনচার্জের স্বাক্ষর
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="w-36 border-t border-slate-400 pt-1">
                        অভিভাবকের স্বাক্ষর
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions (No Print) */}
                <div className="no-print space-y-2.5 pt-3 border-t border-slate-100">
                  {/* Primary Action: Send to Guardian WhatsApp (Full Width) */}
                  {activeStudent.guardianPhone ? (
                    <button
                      type="button"
                      disabled={isThisLoading}
                      onClick={() => handleSendWhatsApp(activeStudent)}
                      className={cx(
                        'press flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-lift active:bg-emerald-700 hover:bg-emerald-700 transition select-none',
                        isThisLoading && 'opacity-70 pointer-events-none'
                      )}
                    >
                      {isThisLoading ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <WhatsAppIcon className="h-4 w-4 shrink-0" />
                      )}
                      <span>{isThisLoading ? 'PDF প্রস্তুত হচ্ছে...' : 'অভিভাবকের WhatsApp-এ পাঠান'}</span>
                    </button>
                  ) : null}

                  {/* Secondary Actions Row: PDF Download & Close */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isThisLoading}
                      onClick={() => handleDownloadStudentPdf(activeStudent)}
                      className={cx(
                        'press flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px] font-bold text-brand-700 active:bg-brand-100 hover:bg-brand-100 transition shadow-2xs select-none',
                        isThisLoading && 'opacity-70 pointer-events-none'
                      )}
                    >
                      <Download className="h-4 w-4 shrink-0 text-brand-600" />
                      <span>PDF ডাউনলোড</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStudent(null)}
                      className="press flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-bold text-slate-700 active:bg-slate-50 hover:bg-slate-50 transition shadow-2xs select-none"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Sheet>
      )}

      {/* ──────────────── Hidden Export Container for PDF Generation ──────────────── */}
      {exportingStudent && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '640px',
            background: '#ffffff',
            zIndex: -50,
          }}
          aria-hidden="true"
        >
          <div
            id="student-slip-export-target"
            className="p-8 bg-white text-slate-800 space-y-5 border border-slate-200"
            style={{ width: '640px' }}
          >
            {(() => {
              const st = getStudentStats(exportingStudent);
              const isGood = st.percentage >= 75;

              return (
                <>
                  {/* Header */}
                  <div className="border-b border-slate-200 pb-3 text-center">
                    <h3 className="text-[20px] font-black text-slate-900">{institutionName}</h3>
                    <p className="text-[14px] font-bold text-brand-600">
                      শিক্ষার্থীর মাসিক হাজিরা বিবরণী (Monthly Attendance Slip)
                    </p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-slate-500">
                      মাস: {monthBn(selectedMonth)} {selectedYear} · শ্রেণি: {className}
                    </p>
                  </div>

                  {/* Student Info Box */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-[13px] border border-slate-200">
                    <div>
                      <span className="text-slate-500">শিক্ষার্থীর নাম: </span>
                      <strong className="text-slate-900">{exportingStudent.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">রোল নম্বর: </span>
                      <strong className="text-slate-900">{exportingStudent.roll}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">শ্রেণি / বিভাগ: </span>
                      <strong className="text-slate-900">{className}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">অভিভাবকের ফোন: </span>
                      <strong className="text-slate-900">{exportingStudent.guardianPhone || 'নেই'}</strong>
                    </div>
                  </div>

                  {/* 3 KPI Summary Cards */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                      <p className="tabular text-[20px] font-black text-slate-900">{st.totalRecorded} দিন</p>
                      <p className="text-[11.5px] font-semibold text-slate-500">মোট ক্লাস</p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-2xs">
                      <p className="tabular text-[20px] font-black text-emerald-700">{st.present} দিন</p>
                      <p className="text-[11.5px] font-semibold text-emerald-800">উপস্থিতি</p>
                    </div>

                    <div
                      className={cx(
                        'rounded-xl border p-3 shadow-2xs',
                        isGood
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      )}
                    >
                      <p className="tabular text-[20px] font-black leading-tight">{st.percentage}%</p>
                      <p className="text-[11.5px] font-semibold">উপস্থিতির হার</p>
                    </div>
                  </div>

                  {/* Absent / Late / Leave breakdown */}
                  <div className="flex items-center justify-around rounded-xl bg-slate-50 p-2.5 text-[12.5px] border border-slate-200">
                    <span className="text-rose-700 font-bold">
                      অনুপস্থিত: <span className="tabular">{st.absent} দিন</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-700 font-bold">
                      দেরি: <span className="tabular">{st.late} দিন</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-sky-700 font-bold">
                      ছুটি: <span className="tabular">{st.leave} দিন</span>
                    </span>
                  </div>

                  {/* Calendar Matrix of the Month */}
                  <div>
                    <h4 className="mb-2 text-[13px] font-bold text-slate-700">
                      দৈনিক হাজিরার বিবরণ:
                    </h4>
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
                      {BN_WEEKDAYS.map((w, i) => (
                        <div
                          key={w}
                          className={cx(
                            'py-1 font-bold rounded',
                            i === 5 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {w}
                        </div>
                      ))}
                      {/* Empty padding cells before 1st day of month */}
                      {Array.from({ length: daysInfo[0]?.dayOfWeek || 0 }).map((_, i) => (
                        <div key={`empty-exp-${i}`} className="h-9" />
                      ))}
                      {/* Day cells */}
                      {daysInfo.map((d) => {
                        const cell = st.daily[d.day];
                        const tone = cell?.tone;

                        return (
                          <div
                            key={`exp-${d.day}`}
                            className={cx(
                              'flex flex-col items-center justify-center rounded-lg border p-1 h-11',
                              tone === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-800 font-bold',
                              tone === 'red' && 'border-rose-200 bg-rose-50 text-rose-700 font-extrabold',
                              tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800 font-bold',
                              tone === 'sky' && 'border-sky-200 bg-sky-50 text-sky-800 font-bold',
                              tone === 'slate' && 'border-slate-200 bg-slate-50 text-slate-400',
                              tone === 'none' && 'border-slate-100 bg-white text-slate-300'
                            )}
                          >
                            <span className="text-[10px] leading-tight text-slate-500">{d.day}</span>
                            <span className="text-[12px] font-black leading-tight">
                              {cell?.symbol || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feedback Note */}
                  <div
                    className={cx(
                      'rounded-xl p-3.5 text-[12.5px] font-medium border',
                      isGood
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    )}
                  >
                    {isGood ? (
                      <p className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>শিক্ষার্থীর উপস্থিতি সন্তোষজনক (৭৫%-এর বেশি)।</span>
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span>সতর্কতা: শিক্ষার্থীর উপস্থিতি ৭৫%-এর নিচে। ক্লাসে উপস্থিতি বাড়ানো প্রয়োজন।</span>
                      </p>
                    )}
                  </div>

                  {/* Signature block */}
                  <div className="flex items-end justify-between pt-8 text-[12px] font-semibold text-slate-600">
                    <div className="text-center">
                      <div className="w-40 border-t border-slate-400 pt-1">
                        শ্রেণি ইনচার্জের স্বাক্ষর
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="w-40 border-t border-slate-400 pt-1">
                        অভিভাবকের স্বাক্ষর
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
