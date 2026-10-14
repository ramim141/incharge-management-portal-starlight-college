import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { backend, isLocal } from '../backend';
import { studentIdFor, buildClassSettings, newFeeRow, newStudentRecord, markFeePaid, ADMISSION_NOTE, isBeforeFeeStart, isAdmissionMonth, feeMonthRange, periodOf, pad, monthDeadline } from '../lib/classLogic';
import { EN_MONTHS, todayISO, feeStatus, setClassLabels, monthBn, taka, studentDueItems, fmtDate, shiftISODate, daysBetween } from '../lib/format';
import { DEFAULT_WHATSAPP_TEMPLATE } from '../lib/defaults';
import { newId, portalKey, quickHash } from '../lib/hash';
import { dayCloseSummary, cashDifference } from '../lib/dayClose';
import { buildBackup, restoreOps } from '../lib/backup';
import { buildPortalSnapshot } from '../lib/portal';
import { leaveAttendanceChanges, leaveDays } from '../lib/leave';
import { newNotice, noticesForPortal } from '../lib/notices';

// Everything about ONE class: its students, fees, attendance, payments… plus the actions
// screens use. Each in-charge only ever mounts their own class; the principal can mount any.
export const AppContext = createContext(null);

const COLLS = ['students', 'fees', 'examFees', 'fines', 'payments', 'attendance', 'closings', 'notices', 'leaves'];

export { studentIdFor };


// "due" is always derived, so a fee row can never disagree with itself
const normalizeFee = (f, feeStartMonth) => {
  const isStartMonth = isAdmissionMonth(f.month, f.year, feeStartMonth);
  const isBefore = isBeforeFeeStart(f.month, f.year, feeStartMonth);

  // Months before the class's fee start were before session; start month was taken with admission
  if (isBefore || isStartMonth) {
    const amount = Number(f.amount || 0);
    return {
      ...f,
      amount,
      fine: 0,
      fineWaived: 0,
      paid: Math.max(Number(f.paid || 0), amount),
      due: 0,
      status: 'Paid',
      beforeStart: isBefore,
      atAdmission: isStartMonth,
      note: f.note || (isStartMonth ? ADMISSION_NOTE : 'ভর্তির পূর্ববর্তী'),
    };
  }
  const amount = Number(f.amount || 0);
  const fine = Number(f.fine || 0);
  // Part (or all) of a late fine can be waived (মওকুফ); it no longer counts as owed
  const fineWaived = Math.min(fine, Number(f.fineWaived || 0));
  const paid = Number(f.paid || 0);
  const due = Math.max(0, amount + fine - fineWaived - paid);
  let status = f.status;
  if (due === 0 && (paid > 0 || amount === 0)) status = 'Paid';
  else if (paid > 0 && status !== 'Overdue') status = 'Partial';
  else if (status === 'Paid') status = 'Due';
  return { ...f, amount, fine, fineWaived, paid, due, status };
};

// A fine can be partly waived and partly paid; what is still owed is derived from those
export const normalizeFine = (f) => {
  const amount = Number(f.amount || 0);
  // Older records only had a status: treat "Waived" as fully waived and "Paid" as fully paid
  const waived = Math.min(amount, Number(f.waived ?? (f.status === 'Waived' ? amount : 0)) || 0);
  const paid = Math.min(amount - waived, Number(f.paid ?? (f.status === 'Paid' ? amount - waived : 0)) || 0);
  const due = Math.max(0, amount - waived - paid);
  const status = due > 0 ? 'Active' : paid > 0 ? 'Paid' : 'Waived';
  return { ...f, amount, waived, paid, due, status };
};

export const absenceFineId = (date, studentId) => `fine-abs-${date}-${studentId}`;

export function AppProvider({ classId, profile, institution, onExit, onSignOut, onOpenPortal, children }) {
  const [classDoc, setClassDoc] = useState(undefined);
  const [raw, setRaw] = useState({ students: [], fees: [], examFees: [], fines: [], payments: [], attendance: [], closings: [], notices: [], leaves: [] });
  const [ready, setReady] = useState({});
  const [activeTab, setTab] = useState('dashboard');
  // Moving between sections cross-fades when the browser supports it; otherwise it just switches
  const setActiveTab = useCallback((id) => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document !== 'undefined' && document.startViewTransition && !reduce) {
      document.startViewTransition(() => flushSync(() => setTab(id)));
    } else {
      setTab(id);
    }
  }, []);

  useEffect(() => backend.subscribeDoc(['classes', classId], setClassDoc), [classId]);
  useEffect(() => {
    setReady({});
    const unsubs = COLLS.map((c) =>
      backend.subscribeCollection(['classes', classId, c], (list) => {
        setRaw((d) => ({ ...d, [c]: list }));
        setReady((r) => ({ ...r, [c]: true }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [classId]);

  const loading = classDoc === undefined || COLLS.some((c) => !ready[c]);

  /* ───────────── derived data ───────────── */
  const now = new Date();
  const currentMonth = EN_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  const settings = useMemo(
    () => buildClassSettings({ classDoc, classId, institution, month: currentMonth, year: currentYear }),
    [classDoc, classId, institution, currentMonth, currentYear],
  );
  // Label helpers (groupBn, sectionBn…) read this class's own department / section names
  setClassLabels(settings);

  const students = useMemo(() => [...raw.students].sort((a, b) => Number(a.roll) - Number(b.roll)), [raw.students]);
  const feeStartMonth = classDoc?.settings?.feeStartMonth || '';
  const feeEndMonth = classDoc?.settings?.feeEndMonth || '';
  const fees = useMemo(() => {
    const normalized = raw.fees.map((f) => normalizeFee(f, feeStartMonth));
    if (feeStartMonth) {
      const [sY, sM] = feeStartMonth.split('-').map(Number);
      const startMonthName = EN_MONTHS[sM - 1];
      const existing = new Set(
        normalized
          .filter((f) => f.month === startMonthName && Number(f.year) === sY)
          .map((f) => f.studentId),
      );
      const synthesized = [];
      students.forEach((s) => {
        if (!existing.has(s.id)) {
          const row = newFeeRow(s, settings, startMonthName, sY);
          synthesized.push(normalizeFee(markFeePaid(row, ADMISSION_NOTE), feeStartMonth));
        }
      });
      return [...normalized, ...synthesized];
    }
    return normalized;
  }, [raw.fees, feeStartMonth, students, settings]);
  const examFees = raw.examFees;
  const fines = useMemo(() => raw.fines.map(normalizeFine).sort((a, b) => String(b.date).localeCompare(String(a.date))), [raw.fines]);
  const payments = useMemo(() => [...raw.payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)), [raw.payments]);
  const attendance = useMemo(() => Object.fromEntries(raw.attendance.map((a) => [a.date || a.id, a.records || {}])), [raw.attendance]);

  const closings = useMemo(() => Object.fromEntries(raw.closings.map((c) => [c.date || c.id, c])), [raw.closings]);

  const P = (coll, id) => ['classes', classId, coll, id];
  const write = (ops) => backend.write(ops);

  /* ───────── audit log: who changed what (one document per action, never edited) ───────── */
  const audit = (e) => {
    const id = newId('log');
    const data = { id, at: new Date().toISOString(), by: profile?.name || settings.inchargeName || '', uid: profile?.uid || '', ...e };
    return write([{ type: 'set', path: P('audit', id), data }]).catch(() => {});
  };
  // Runs an action, then records it. The log can never make the action itself fail.
  const logged = (fn, describe) => async (...args) => {
    const res = await fn(...args);
    try {
      const e = describe(args, res);
      if (e) audit(e);
    } catch {
      /* ignore */
    }
    return res;
  };

  /* ───────────── calculations ───────────── */
  const calculateStudentTotalDue = (studentId) =>
    fees.filter((f) => f.studentId === studentId).reduce((a, f) => a + f.due, 0) +
    fines.filter((f) => f.studentId === studentId).reduce((a, f) => a + f.due, 0) +
    examFees.filter((e) => e.studentId === studentId && e.status === 'Due').reduce((a, e) => a + Number(e.due || 0), 0);

  const getStudentAttendanceStats = (studentId) => {
    let totalClasses = 0;
    const c = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
    Object.values(attendance).forEach((day) => {
      const st = day?.[studentId];
      if (st && c[st] != null) {
        totalClasses += 1;
        c[st] += 1;
      }
    });
    const percentage = totalClasses ? Number((((c.Present + c.Late * 0.5) / totalClasses) * 100).toFixed(1)) : 100;
    return { totalClasses, present: c.Present, absent: c.Absent, late: c.Late, leave: c.Leave, percentage };
  };

  const activeStudents = students.filter((s) => s.status !== 'inactive');
  const currentMonthFees = fees.filter((f) => f.month === currentMonth && Number(f.year) === currentYear);
  const thisMonthCollection = currentMonthFees.reduce((a, f) => a + f.paid, 0);
  const thisMonthDue = currentMonthFees.reduce((a, f) => a + f.due, 0);
  const totalDueAcrossAll = students.reduce((a, s) => a + calculateStudentTotalDue(s.id), 0);
  const paidCount = currentMonthFees.filter((f) => f.status === 'Paid').length;
  const dueCount = currentMonthFees.filter((f) => feeStatus(f) === 'Due' || feeStatus(f) === 'Partial').length;
  const overdueCount = currentMonthFees.filter((f) => feeStatus(f) === 'Overdue').length;
  const currentBeforeStart = isBeforeFeeStart(currentMonth, currentYear, feeStartMonth);
  const missingFeeStudents = currentBeforeStart ? [] : activeStudents.filter((s) => !currentMonthFees.some((f) => f.studentId === s.id));

  const getStudentDueItems = (student) => studentDueItems(student.id, { fees, fines, examFees }).map((i) => ({ name: i.label, amount: i.amount }));

  const buildFeeSummary = (items) => {
    if (!items.length) return 'কোনো প্রদেয় ফি নেই';
    const parts = items.map((it) => `${it.name} ${taka(it.amount)}`);
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} এবং ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} এবং ${parts[parts.length - 1]}`;
  };

  const buildFeeBreakdown = (items, totalDue) => {
    if (!items.length) return '';
    return [
      '📋 *বাকি ফির বিবরণ:*',
      ...items.map((it) => `• ${it.name}: ${taka(it.amount)}`),
      '━━━━━━━━━━━━━━━━',
      `*সর্বমোট প্রদেয়: ${taka(totalDue)}*`,
    ].join('\n');
  };

  const generateWhatsAppMessage = (student, customTemplate = null) => {
    const dueItems = getStudentDueItems(student);
    const totalDue = dueItems.reduce((a, i) => a + i.amount, 0);
    const feeSummary = buildFeeSummary(dueItems);
    const feeBreakdown = buildFeeBreakdown(dueItems, totalDue);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const portalUrl = origin ? `${origin}?roll=${student.roll}` : '';

    // The deadline belongs to the month that is owed: the next one not yet passed (else the latest overdue one)
    const owedRows = fees
      .filter((f) => f.studentId === student.id && Number(f.due) > 0)
      .map((f) => ({ f, deadline: f.deadline || monthDeadline(f.month, Number(f.year), settings.defaultFeeDeadlineDay) }))
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    const target = owedRows.find((r) => r.deadline >= todayISO()) || owedRows[owedRows.length - 1];
    const bMonth = monthBn(target ? target.f.month : currentMonth);
    const deadlineStr = target ? fmtDate(target.deadline) : `${settings.defaultFeeDeadlineDay} ${monthBn(currentMonth)} ${currentYear}`;

    let tmpl = String(customTemplate || settings.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);

    // Auto-upgrade legacy template sentence if present
    tmpl = tmpl.replace(
      /আপনার সন্তান \{student_name\}-এর \{month\} মাসের বেতন ৳?\{monthly_fee\} এবং সর্বমোট বকেয়া ৳?\{total_due\}।?/g,
      'আপনার সন্তান {student_name}-এর {fee_summary} সহ সর্বমোট প্রদেয় ফি {total_due}।\n{fee_breakdown}'
    );
    // Older default wording → itemised list of what is owed (month by month, transport apart)
    tmpl = tmpl.replace(
      /আপনার সন্তান \{student_name\}-এর \{fee_summary\} সহ সর্বমোট প্রদেয় ফি \{total_due\}।?(\s*\{fee_breakdown\})?/g,
      'আপনার সন্তান {student_name}-এর নিচের ফি বাকি আছে:\n{fee_breakdown}',
    );
    // Fees are accepted at the college office only (no bKash/Nagad)
    tmpl = tmpl.replace(/কলেজ অফিসে অথবা বিকাশ\/নগদে ফি পরিশোধ করার/g, 'কলেজ অফিসে এসে ফি পরিশোধ করার');
    tmpl = tmpl.replace(/বকেয়া পরিশোধের শেষ সময়:/g, 'ফি পরিশোধের শেষ সময়:');
    tmpl = tmpl.replace(/সর্বমোট বকেয়া ৳?\{total_due\}/g, 'সর্বমোট প্রদেয় ফি {total_due}');

    let msg = tmpl
      .replace(/\{student_name\}/g, student.name)
      .replace(/\{roll\}/g, student.roll)
      .replace(/\{fee_summary\}/g, feeSummary)
      .replace(/\{fee_breakdown\}\n?/g, feeBreakdown ? `${feeBreakdown}\n` : '')
      .replace(/\{month\}/g, bMonth)
      .replace(/৳?\{monthly_fee\}/g, taka(student.monthlyFee || settings.defaultMonthlyFee))
      .replace(/৳?\{total_due\}/g, taka(totalDue))
      .replace(/৳?\{total_payable\}/g, taka(totalDue))
      .replace(/\{deadline\}/g, deadlineStr)
      .replace(/\{incharge_name\}/g, settings.inchargeName)
      .replace(/\{incharge_phone\}/g, settings.inchargePhone || '')
      .replace(/\{class_name\}/g, settings.className)
      .replace(/\{portal_link\}/g, portalUrl);

    if (portalUrl && !msg.includes(portalUrl)) {
      msg += `\n\n🌐 শিক্ষার্থী পোর্টাল: ${portalUrl}`;
    }

    return msg.replace(/\n{3,}/g, '\n\n').trim();
  };

  const feeRow = (student, month = currentMonth, year = currentYear) => newFeeRow(student, settings, month, year);

  /* ───────────── actions ───────────── */
  /** paidAtAdmission: this month's fee was collected together with admission → saved as paid */
  const addStudent = async (input, { paidAtAdmission = false } = {}) => {
    const student = newStudentRecord(input, classId, settings);
    const { id } = student;
    const fee = feeRow(student);
    const ops = [{ type: 'set', path: P('students', id), data: student }];
    // Before the fee start month the admission month was paid with admission — no fee row at all
    if (!isBeforeFeeStart(currentMonth, currentYear, feeStartMonth)) {
      ops.push({ type: 'set', path: P('fees', fee.id), data: paidAtAdmission ? markFeePaid(fee) : fee });
    }
    await write(ops);
    return student;
  };

  /**
   * Marks a month as paid for every active student (e.g. collected at admission — no receipt).
   * Missing fee rows are created; already-paid rows are left alone. Returns how many changed.
   */
  const markMonthPaid = async (month, year, note = ADMISSION_NOTE) => {
    if (isBeforeFeeStart(month, year, feeStartMonth)) return 0;
    const ops = [];
    activeStudents.forEach((s) => {
      const row = fees.find((f) => f.studentId === s.id && f.month === month && Number(f.year) === Number(year));
      if (row && row.due <= 0) return;
      ops.push({ type: 'set', path: P('fees', row?.id || feeRow(s, month, Number(year)).id), data: markFeePaid(row || feeRow(s, month, Number(year)), note) });
    });
    if (ops.length) await write(ops);
    return ops.length;
  };

  const updateStudent = async (id, patch) => {
    const old = students.find((s) => s.id === id) || {};
    const merged = { ...old, ...patch };
    const newRoll = Number(merged.roll);
    const studentId = studentIdFor(classId, newRoll);
    const key = portalKey(studentId, merged.pin);
    const { id: _ignore, ...data } = { ...patch, roll: newRoll, studentId, portalKey: key };
    if (key !== old.portalKey) data.portalHash = null;
    const ops = [{ type: 'merge', path: P('students', id), data }];
    if (old.portalKey && old.portalKey !== key) ops.push({ type: 'delete', path: ['portal', old.portalKey] });

    const rollChanged = old.roll != null && newRoll !== Number(old.roll);
    const hasFeePatch = patch.monthlyFee !== undefined && patch.monthlyFee !== null && patch.monthlyFee !== '';
    const newMonthlyFee = hasFeePatch ? Number(patch.monthlyFee) : null;
    const newTransport = patch.transport !== undefined || patch.transportFee !== undefined ? (patch.transport ? Number(patch.transportFee || 0) : 0) : null;
    const feeChanged = newMonthlyFee !== null && (old.monthlyFee == null || Number(old.monthlyFee) !== newMonthlyFee);

    // Update existing fee rows for this student
    fees.filter((f) => f.studentId === id).forEach((f) => {
      const feePatch = {};
      if (rollChanged) {
        feePatch.roll = newRoll;
      }
      // If monthlyFee changed, update all unpaid/due months (months not fully paid and not before fee start)
      if (feeChanged && !f.beforeStart && f.status !== 'Paid') {
        const fine = Number(f.fine || 0);
        const fineWaived = Number(f.fineWaived || 0);
        const paid = Number(f.paid || 0);
        const due = Math.max(0, newMonthlyFee + fine - fineWaived - paid);
        let status = f.status;
        if (due === 0 && (paid > 0 || newMonthlyFee === 0)) status = 'Paid';
        else if (paid > 0 && status !== 'Overdue') status = 'Partial';
        else if (status === 'Paid') status = 'Due';
        feePatch.amount = newMonthlyFee;
        feePatch.due = due;
        feePatch.status = status;
      }
      if (newTransport !== null && !f.beforeStart && f.status !== 'Paid') feePatch.transport = newTransport;
      if (Object.keys(feePatch).length) {
        ops.push({ type: 'merge', path: P('fees', f.id), data: feePatch });
      }
    });

    // If roll changed, update roll across other student sub-collections
    if (rollChanged) {
      examFees.filter((e) => e.studentId === id).forEach((e) => {
        ops.push({ type: 'merge', path: P('examFees', e.id), data: { roll: newRoll } });
      });
      payments.filter((p) => p.studentId === id).forEach((p) => {
        ops.push({ type: 'merge', path: P('payments', p.id), data: { roll: newRoll } });
      });
      fines.filter((fn) => fn.studentId === id).forEach((fn) => {
        ops.push({ type: 'merge', path: P('fines', fn.id), data: { roll: newRoll } });
      });
    }

    await write(ops);
  };

  const deleteStudent = async (id) => {
    const s = students.find((x) => x.id === id);
    const ops = [{ type: 'delete', path: P('students', id) }];
    fees.filter((f) => f.studentId === id).forEach((f) => ops.push({ type: 'delete', path: P('fees', f.id) }));
    examFees.filter((e) => e.studentId === id).forEach((e) => ops.push({ type: 'delete', path: P('examFees', e.id) }));
    fines.filter((f) => f.studentId === id).forEach((f) => ops.push({ type: 'delete', path: P('fines', f.id) }));
    if (s?.portalKey) ops.push({ type: 'delete', path: ['portal', s.portalKey] });
    await write(ops);
  };

  const updateFee = (id, patch) => {
    const old = fees.find((f) => f.id === id);
    const data = { ...patch };
    if (patch.amount !== undefined && old) {
      const amount = Number(patch.amount);
      const fine = Number(patch.fine ?? old.fine ?? 0);
      const fineWaived = Number(patch.fineWaived ?? old.fineWaived ?? 0);
      const paid = Number(patch.paid ?? old.paid ?? 0);
      const due = Math.max(0, amount + fine - fineWaived - paid);
      let status = patch.status ?? old.status;
      if (due === 0 && (paid > 0 || amount === 0)) status = 'Paid';
      else if (paid > 0 && status !== 'Overdue') status = 'Partial';
      else if (status === 'Paid') status = 'Due';
      data.amount = amount;
      data.due = due;
      data.status = status;
    }
    return write([{ type: 'merge', path: P('fees', id), data }]);
  };

  /** Every fee month of the class from its start up to the end of the session (see feeMonthRange) */
  const feeMonths = useMemo(() => feeMonthRange({ feeStartMonth, feeEndMonth, currentMonth, currentYear }), [feeStartMonth, feeEndMonth, currentMonth, currentYear]);

  /**
   * Creates the missing fee rows for every month from the fee start up to this month (arrears),
   * for all active students — e.g. January–October 2026 for a class that starts in January.
   */
  const generateArrears = async () => {
    const upto = periodOf(currentMonth, currentYear);
    const ops = [];
    feeMonths
      .filter((m) => m.period <= upto)
      .forEach(({ month, year }) => {
        const isStart = isAdmissionMonth(month, year, feeStartMonth);
        activeStudents.forEach((s) => {
          if (fees.some((f) => f.studentId === s.id && f.month === month && Number(f.year) === year)) return;
          const row = feeRow(s, month, year);
          ops.push({ type: 'set', path: P('fees', row.id), data: isStart ? markFeePaid(row, ADMISSION_NOTE) : row });
        });
      });
    if (ops.length) await write(ops);
    return ops.length;
  };

  /**
   * Waives (মওকুফ) part of a student's fines: the amount is taken off their fines oldest first —
   * separate fines (absence etc.) and late fines on monthly fees. Returns how much was waived.
   */
  const waiveStudentFines = async (studentId, amount, note = '') => {
    let left = Math.max(0, Number(amount) || 0);
    const ops = [];
    const stamp = new Date().toISOString();
    const items = [
      ...fines.filter((f) => f.studentId === studentId && f.due > 0).map((f) => ({ kind: 'fine', date: f.date, f })),
      ...fees
        .filter((f) => f.studentId === studentId && !f.beforeStart && f.due > 0 && f.fine - f.fineWaived > 0)
        .map((f) => ({ kind: 'fee', date: f.deadline || periodOf(f.month, f.year), f })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    items.forEach(({ kind, f }) => {
      if (left <= 0) return;
      if (kind === 'fine') {
        const w = Math.min(left, f.due);
        left -= w;
        const waived = f.waived + w;
        ops.push({ type: 'merge', path: P('fines', f.id), data: { waived, status: f.amount - waived - f.paid > 0 ? 'Active' : 'Waived', waiveNote: note, waivedAt: stamp, editedBy: profile?.name || '' } });
      } else {
        const w = Math.min(left, f.fine - f.fineWaived, f.due);
        left -= w;
        const fineWaived = f.fineWaived + w;
        const due = Math.max(0, f.amount + f.fine - fineWaived - f.paid);
        ops.push({ type: 'merge', path: P('fees', f.id), data: { fineWaived, due, status: due === 0 ? 'Paid' : f.status, fineWaiveNote: note, fineWaivedAt: stamp } });
      }
    });
    if (ops.length) await write(ops);
    return Math.max(0, Number(amount) || 0) - left;
  };

  /** Creates the month's unpaid fee for every active student that has none yet; `deadline` (YYYY-MM-DD) overrides the class default */
  const generateMonthFees = async (month = currentMonth, year = currentYear, deadline = '') => {
    if (isBeforeFeeStart(month, year, feeStartMonth)) return 0;
    const isStart = isAdmissionMonth(month, year, feeStartMonth);
    const have = new Set(fees.filter((f) => f.month === month && Number(f.year) === Number(year)).map((f) => f.studentId));
    const ops = activeStudents
      .filter((s) => !have.has(s.id))
      .map((s) => {
        const row = feeRow(s, month, Number(year));
        const finalRow = isStart ? markFeePaid(row, ADMISSION_NOTE) : row;
        return { type: 'set', path: P('fees', row.id), data: deadline ? { ...finalRow, deadline } : finalRow };
      });
    if (ops.length) await write(ops);
    return ops.length;
  };

  /** Removes a month's fee rows nobody has paid anything on; rows with money received stay. → { removed, kept } */
  const removeMonthFees = async (month, year) => {
    const rows = fees.filter((f) => f.month === month && Number(f.year) === Number(year));
    const gone = rows.filter((f) => Number(f.paid || 0) <= 0);
    if (gone.length) await write(gone.map((f) => ({ type: 'delete', path: P('fees', f.id) })));
    return { removed: gone.length, kept: rows.length - gone.length };
  };

  /** New payment deadline for a month's rows that are still owed (a late fine already added stays) */
  const setMonthDeadline = async (month, year, deadline) => {
    const rows = fees.filter((f) => f.month === month && Number(f.year) === Number(year) && Number(f.due) > 0 && !f.beforeStart);
    if (rows.length) await write(rows.map((f) => ({ type: 'merge', path: P('fees', f.id), data: { deadline, ...(f.status === 'Overdue' && !(Number(f.fine) > 0) && deadline >= todayISO() ? { status: 'Due' } : {}) } })));
    return rows.length;
  };

  const applyAutoFines = async (month = currentMonth) => {
    const today = todayISO();
    const ops = fees
      .filter((f) => f.month.toLowerCase() === month.toLowerCase() && f.status !== 'Paid' && f.deadline && today > f.deadline && !f.fine)
      .map((f) => ({ type: 'merge', path: P('fees', f.id), data: { fine: Number(settings.fixedFineAfterDeadline), status: 'Overdue' } }));
    if (ops.length) await write(ops);
    return ops.length;
  };

  /** Per-student absence fine: the student's own rate if set, otherwise the class default */
  const absenceFineFor = (student) => {
    const own = student?.absentFine;
    return Math.max(0, Number(own === '' || own == null ? settings.absentFine : own) || 0);
  };

  /**
   * Saves a day's attendance and keeps that day's absence fines in step with it:
   * newly absent → fine at the student's rate; no longer absent → unpaid fine removed.
   * A fine the teacher already edited or waived is left as it is.
   */
  const saveAttendanceRecord = async (date, records) => {
    const ops = [{ type: 'set', path: P('attendance', date), data: { date, records } }];
    let added = 0;
    let removed = 0;
    students.forEach((s) => {
      const id = absenceFineId(date, s.id);
      const existing = fines.find((f) => f.id === id);
      if (records[s.id] === 'Absent') {
        const amount = absenceFineFor(s);
        if (!existing && amount > 0) {
          ops.push({
            type: 'set',
            path: P('fines', id),
            data: { id, kind: 'absent', studentId: s.id, roll: Number(s.roll), amount, waived: 0, paid: 0, reason: 'অনুপস্থিতি জরিমানা', date, status: 'Active' },
          });
          added += 1;
        }
      } else if (existing && existing.paid === 0) {
        ops.push({ type: 'delete', path: P('fines', id) });
        removed += 1;
      }
    });
    await write(ops);
    return { added, removed };
  };

  /**
   * feeMonths: [{ month, year }] the in-charge picked (any month: arrears, current or advance).
   * Money goes to them oldest first; a month without a fee row yet gets one created.
   */
  const recordPayment = async ({ studentId, roll, studentName, amount, items, method = 'Cash', trxId = '', paymentDate = new Date().toISOString(), feeId = null, feeMonths = null, fineId = null, fineIds = null, examFeeId = null, withTransport = true }) => {
    const last = payments.reduce((m, p) => Math.max(m, Number(String(p.receiptNo).split('-').pop()) || 0), 100);
    const settlement = {
      exam: null,
      fines: [],
      fees: [],
    };
    const payment = {
      id: newId('pay'),
      receiptNo: `INV-${classId}-${pad(last + 1, 5)}`,
      studentId,
      roll: Number(roll),
      studentName,
      amount: Number(amount),
      items: items || [{ description: `${monthBn(currentMonth)} ফি`, amount: Number(amount) }],
      method,
      trxId,
      paymentDate,
      inchargeName: profile?.name || settings.inchargeName,
      recordedBy: profile?.uid || null,
      meta: { feeMonths, withTransport, fineIds, examFeeId },
      settlement,
    };
    const ops = [{ type: 'set', path: P('payments', payment.id), data: payment }];

    // Settle exam → manual fine → monthly fee, in that order
    let left = Number(amount);
    const exam = examFeeId && examFees.find((e) => e.id === examFeeId);
    if (exam && left > 0) {
      const pay = Math.min(left, Number(exam.due || exam.amount));
      left -= pay;
      const due = Math.max(0, Number(exam.due || exam.amount) - pay);
      ops.push({ type: 'merge', path: P('examFees', exam.id), data: { paid: Number(exam.paid || 0) + pay, due, status: due === 0 ? 'Paid' : 'Due', paymentDate } });
      settlement.exam = { id: exam.id, amount: pay };
    }
    // Fines are settled oldest first; a fine can be paid in part
    const fineList = (fineIds || (fineId ? [fineId] : []))
      .map((id) => fines.find((f) => f.id === id))
      .filter((f) => f && f.due > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    fineList.forEach((f) => {
      if (left <= 0) return;
      const pay = Math.min(left, f.due);
      left -= pay;
      const paid = f.paid + pay;
      ops.push({ type: 'merge', path: P('fines', f.id), data: { paid, status: f.amount - f.waived - paid > 0 ? 'Active' : 'Paid', paidAt: paymentDate } });
      settlement.fines.push({ id: f.id, amount: pay });
    });
    // Monthly fees: oldest month first; whatever is left after the last month stays on it (advance)
    const student = students.find((s) => s.id === studentId);
    const monthRows = (feeMonths || [])
      .filter(({ month, year }) => !isBeforeFeeStart(month, year, feeStartMonth))
      .map(({ month, year }) => {
        const existing = fees.find((f) => f.studentId === studentId && f.month === month && Number(f.year) === Number(year));
        if (existing) return existing;
        const row = feeRow(student || { id: studentId, roll }, month, Number(year));
        ops.push({ type: 'set', path: P('fees', row.id), data: row });
        return row;
      })
      .sort((a, b) => Number(a.year) - Number(b.year) || EN_MONTHS.indexOf(a.month) - EN_MONTHS.indexOf(b.month));
    if (!monthRows.length && feeId) {
      const one = fees.find((f) => f.id === feeId);
      if (one) monthRows.push(one);
    }
    monthRows.forEach((fee, i) => {
      if (left <= 0) return;
      const charge = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
      const owed = Math.max(0, charge - Number(fee.paid || 0));
      // Transport left unticked stays owed on the month; only the rest is settled now
      const transport = Math.min(Number(fee.transport ?? (student?.transport ? student.transportFee : 0)) || 0, owed);
      const settle = withTransport ? owed : owed - transport;
      const pay = i === monthRows.length - 1 ? left : Math.min(left, settle);
      left -= pay;
      const paid = Number(fee.paid || 0) + pay;
      const due = Math.max(0, charge - paid);
      ops.push({ type: 'merge', path: P('fees', fee.id), data: { paid, due, status: due === 0 ? 'Paid' : 'Partial' } });
      settlement.fees.push({ id: fee.id, amount: pay });
    });
    await write(ops);
    return payment;
  };

  /**
   * Deletes a payment and reverses all fee, fine, and exam fee allocations
   * back to the student's dues in the database.
   */
  const deletePayment = async (paymentId) => {
    const p = payments.find((x) => x.id === paymentId);
    if (!p) return;

    const ops = [{ type: 'delete', path: P('payments', p.id) }];

    if (p.settlement) {
      if (p.settlement.exam) {
        const e = examFees.find((x) => x.id === p.settlement.exam.id);
        if (e) {
          const rev = Number(p.settlement.exam.amount || 0);
          const paid = Math.max(0, Number(e.paid || 0) - rev);
          const due = Math.max(0, Number(e.amount) - paid);
          ops.push({
            type: 'merge',
            path: P('examFees', e.id),
            data: { paid, due, status: due === 0 ? 'Paid' : 'Due' },
          });
        }
      }

      (p.settlement.fines || []).forEach(({ id, amount: rev }) => {
        const f = fines.find((x) => x.id === id);
        if (f) {
          const paid = Math.max(0, Number(f.paid || 0) - Number(rev || 0));
          const isStillDue = Number(f.amount) - Number(f.waived || 0) - paid > 0;
          ops.push({
            type: 'merge',
            path: P('fines', f.id),
            data: { paid, status: isStillDue ? 'Active' : 'Paid' },
          });
        }
      });

      (p.settlement.fees || []).forEach(({ id, amount: rev }) => {
        const fee = fees.find((x) => x.id === id);
        if (fee) {
          const charge = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
          const paid = Math.max(0, Number(fee.paid || 0) - Number(rev || 0));
          const due = Math.max(0, charge - paid);
          ops.push({
            type: 'merge',
            path: P('fees', fee.id),
            data: {
              paid,
              due,
              status: due === 0 ? 'Paid' : paid > 0 ? 'Partial' : (fee.deadline && todayISO() > fee.deadline ? 'Overdue' : 'Due'),
            },
          });
        }
      });
    } else {
      // Fallback for older payments without saved settlement object
      let left = Number(p.amount);

      const studentExams = examFees.filter((e) => e.studentId === p.studentId && Number(e.paid || 0) > 0);
      for (const e of studentExams) {
        if (left <= 0) break;
        const examItem = (p.items || []).find((it) => it.description.includes(e.examName) || it.description.includes('Exam') || it.description.includes('পরীক্ষা'));
        if (examItem) {
          const rev = Math.min(left, Math.min(Number(e.paid), Number(examItem.amount)));
          left -= rev;
          const paid = Math.max(0, Number(e.paid) - rev);
          const due = Math.max(0, Number(e.amount) - paid);
          ops.push({ type: 'merge', path: P('examFees', e.id), data: { paid, due, status: due === 0 ? 'Paid' : 'Due' } });
        }
      }

      const studentFines = fines.filter((f) => f.studentId === p.studentId && Number(f.paid || 0) > 0);
      const fineItem = (p.items || []).find((it) => it.description.includes('Fine') || it.description.includes('জরিমানা'));
      if (fineItem && left > 0) {
        let fineLeft = Number(fineItem.amount);
        for (const f of studentFines) {
          if (left <= 0 || fineLeft <= 0) break;
          const rev = Math.min(left, Math.min(Number(f.paid), fineLeft));
          left -= rev;
          fineLeft -= rev;
          const paid = Math.max(0, Number(f.paid) - rev);
          const isDue = Number(f.amount) - Number(f.waived || 0) - paid > 0;
          ops.push({ type: 'merge', path: P('fines', f.id), data: { paid, status: isDue ? 'Active' : 'Paid' } });
        }
      }

      const studentFees = fees
        .filter((f) => f.studentId === p.studentId && Number(f.paid || 0) > 0)
        .sort((a, b) => Number(b.year) - Number(a.year) || EN_MONTHS.indexOf(b.month) - EN_MONTHS.indexOf(a.month));
      for (const fee of studentFees) {
        if (left <= 0) break;
        const rev = Math.min(left, Number(fee.paid));
        left -= rev;
        const charge = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
        const paid = Math.max(0, Number(fee.paid) - rev);
        const due = Math.max(0, charge - paid);
        ops.push({
          type: 'merge',
          path: P('fees', fee.id),
          data: {
            paid,
            due,
            status: due === 0 ? 'Paid' : paid > 0 ? 'Partial' : (fee.deadline && todayISO() > fee.deadline ? 'Overdue' : 'Due'),
          },
        });
      }
    }

    await write(ops);
    return true;
  };

  /**
   * Updates an existing payment: allows editing payment method, trxId,
   * date, items/note, and amount. When amount is updated, previous settlement
   * is reversed and new settlement is calculated and written to the database.
   */
  const updatePayment = async (paymentId, updates) => {
    const p = payments.find((x) => x.id === paymentId);
    if (!p) return null;

    const newAmount = updates.amount != null ? Number(updates.amount) : Number(p.amount);
    const amountChanged = newAmount !== Number(p.amount);

    if (!amountChanged) {
      const data = {
        method: updates.method ?? p.method,
        trxId: updates.trxId ?? p.trxId,
        paymentDate: updates.paymentDate ?? p.paymentDate,
        items: updates.items ?? p.items,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.name || '',
      };
      await write([{ type: 'merge', path: P('payments', p.id), data }]);
      return { ...p, ...data };
    }

    // Amount CHANGED: reverse old settlement, then re-allocate
    const ops = [];

    // 1. Reverse old settlement
    if (p.settlement?.exam) {
      const e = examFees.find((x) => x.id === p.settlement.exam.id);
      if (e) {
        const rev = Number(p.settlement.exam.amount || 0);
        const paid = Math.max(0, Number(e.paid || 0) - rev);
        const due = Math.max(0, Number(e.amount) - paid);
        ops.push({ type: 'merge', path: P('examFees', e.id), data: { paid, due, status: due === 0 ? 'Paid' : 'Due' } });
      }
    }

    (p.settlement?.fines || []).forEach(({ id, amount: rev }) => {
      const f = fines.find((x) => x.id === id);
      if (f) {
        const paid = Math.max(0, Number(f.paid || 0) - Number(rev || 0));
        const isStillDue = Number(f.amount) - Number(f.waived || 0) - paid > 0;
        ops.push({ type: 'merge', path: P('fines', f.id), data: { paid, status: isStillDue ? 'Active' : 'Paid' } });
      }
    });

    (p.settlement?.fees || []).forEach(({ id, amount: rev }) => {
      const fee = fees.find((x) => x.id === id);
      if (fee) {
        const charge = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
        const paid = Math.max(0, Number(fee.paid || 0) - Number(rev || 0));
        const due = Math.max(0, charge - paid);
        ops.push({
          type: 'merge',
          path: P('fees', fee.id),
          data: {
            paid,
            due,
            status: due === 0 ? 'Paid' : paid > 0 ? 'Partial' : (fee.deadline && todayISO() > fee.deadline ? 'Overdue' : 'Due'),
          },
        });
      }
    });

    // 2. Re-allocate newAmount
    let left = newAmount;
    const newSettlement = { exam: null, fines: [], fees: [] };
    const paymentDate = updates.paymentDate ?? p.paymentDate;

    const targetExamId = p.settlement?.exam?.id || p.meta?.examFeeId;
    const exam = targetExamId && examFees.find((e) => e.id === targetExamId);
    if (exam && left > 0) {
      const oldRev = p.settlement?.exam?.id === exam.id ? Number(p.settlement.exam.amount || 0) : 0;
      const basePaid = Math.max(0, Number(exam.paid || 0) - oldRev);
      const owed = Math.max(0, Number(exam.amount) - basePaid);
      const pay = Math.min(left, owed);
      left -= pay;
      const finalPaid = basePaid + pay;
      const due = Math.max(0, Number(exam.amount) - finalPaid);
      ops.push({ type: 'merge', path: P('examFees', exam.id), data: { paid: finalPaid, due, status: due === 0 ? 'Paid' : 'Due', paymentDate } });
      newSettlement.exam = { id: exam.id, amount: pay };
    }

    const targetFineIds = p.settlement?.fines?.map((x) => x.id) || p.meta?.fineIds || [];
    const fineList = targetFineIds.map((id) => fines.find((f) => f.id === id)).filter(Boolean);
    fineList.forEach((f) => {
      if (left <= 0) return;
      const oldRev = (p.settlement?.fines || []).find((x) => x.id === f.id)?.amount || 0;
      const basePaid = Math.max(0, Number(f.paid || 0) - oldRev);
      const maxPay = Math.max(0, Number(f.amount) - Number(f.waived || 0) - basePaid);
      const pay = Math.min(left, maxPay);
      left -= pay;
      const finalPaid = basePaid + pay;
      const isStillDue = Number(f.amount) - Number(f.waived || 0) - finalPaid > 0;
      ops.push({ type: 'merge', path: P('fines', f.id), data: { paid: finalPaid, status: isStillDue ? 'Active' : 'Paid', paidAt: paymentDate } });
      newSettlement.fines.push({ id: f.id, amount: pay });
    });

    const targetFeeIds = p.settlement?.fees?.map((x) => x.id) || [];
    let targetFees = targetFeeIds.map((id) => fees.find((f) => f.id === id)).filter(Boolean);
    if (!targetFees.length) {
      targetFees = fees.filter((f) => f.studentId === p.studentId).sort((a, b) => Number(a.year) - Number(b.year) || EN_MONTHS.indexOf(a.month) - EN_MONTHS.indexOf(b.month));
    }

    targetFees.forEach((fee, i) => {
      if (left <= 0) return;
      const oldRev = (p.settlement?.fees || []).find((x) => x.id === fee.id)?.amount || 0;
      const basePaid = Math.max(0, Number(fee.paid || 0) - oldRev);
      const charge = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
      const owed = Math.max(0, charge - basePaid);
      const isLast = i === targetFees.length - 1;
      const pay = isLast ? left : Math.min(left, owed);
      left -= pay;
      const finalPaid = basePaid + pay;
      const due = Math.max(0, charge - finalPaid);
      ops.push({ type: 'merge', path: P('fees', fee.id), data: { paid: finalPaid, due, status: due === 0 ? 'Paid' : 'Partial' } });
      newSettlement.fees.push({ id: fee.id, amount: pay });
    });

    const updatedPayment = {
      ...p,
      amount: newAmount,
      method: updates.method ?? p.method,
      trxId: updates.trxId ?? p.trxId,
      paymentDate,
      items: updates.items ?? (p.items?.length === 1 ? [{ ...p.items[0], amount: newAmount }] : p.items),
      settlement: newSettlement,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.name || '',
    };

    ops.push({ type: 'set', path: P('payments', p.id), data: updatedPayment });
    await write(ops);
    return updatedPayment;
  };

  const addFine = async ({ studentId, roll, amount, reason, date = todayISO() }) => {
    const fine = { id: newId('fine'), kind: 'manual', studentId, roll: Number(roll), amount: Number(amount), waived: 0, paid: 0, reason, date, status: 'Active' };
    await write([{ type: 'set', path: P('fines', fine.id), data: fine }]);
    return fine;
  };

  /** Edits a fine: amount, reason and how much of it is waived (মওকুফ). Paid money is never touched. */
  const updateFine = async (id, { amount, reason, waived, waiveNote }) => {
    const f = fines.find((x) => x.id === id);
    if (!f) return;
    const amt = Math.max(f.paid, Number(amount ?? f.amount) || 0);
    const w = Math.min(amt - f.paid, Math.max(0, Number(waived ?? f.waived) || 0));
    const data = { amount: amt, waived: w, status: normalizeFine({ ...f, amount: amt, waived: w }).status, editedAt: new Date().toISOString(), editedBy: profile?.name || '' };
    if (reason != null) data.reason = reason;
    if (waiveNote != null) data.waiveNote = waiveNote;
    if (w !== f.waived) data.waivedAt = w > 0 ? new Date().toISOString() : null;
    await write([{ type: 'merge', path: P('fines', id), data }]);
  };

  /** Waives whatever is still owed on a fine */
  const waiveFine = (id, note) => {
    const f = fines.find((x) => x.id === id);
    return f ? updateFine(id, { waived: f.amount - f.paid, waiveNote: note }) : undefined;
  };

  const deleteFine = (id) => write([{ type: 'delete', path: P('fines', id) }]);

  const createExam = async ({ examName, amount, deadline }) => {
    const key = Date.now().toString(36);
    const ops = activeStudents.map((s) => ({
      type: 'set',
      path: P('examFees', `exam-${key}-${s.id}`),
      data: { id: `exam-${key}-${s.id}`, examKey: key, studentId: s.id, roll: s.roll, studentName: s.name, examName, amount: Number(amount), paid: 0, due: Number(amount), status: 'Due', deadline: deadline || '', paymentDate: null },
    }));
    await write(ops);
    return ops.length;
  };

  /** Edits exam fee rows (one student, or a whole exam): name, amount, deadline. Money already received stays. */
  const updateExamFees = async (ids, { examName, amount, deadline }) => {
    const ops = examFees
      .filter((e) => ids.includes(e.id))
      .map((e) => {
        const paid = Number(e.paid || 0);
        const amt = Math.max(paid, Number(amount ?? e.amount) || 0);
        const due = Math.max(0, amt - paid);
        const data = { amount: amt, due, status: due === 0 ? 'Paid' : 'Due' };
        if (examName != null) data.examName = examName;
        if (deadline != null) data.deadline = deadline;
        return { type: 'merge', path: P('examFees', e.id), data };
      });
    if (ops.length) await write(ops);
    return ops.length;
  };

  const deleteExamFees = (ids) => write(examFees.filter((e) => ids.includes(e.id)).map((e) => ({ type: 'delete', path: P('examFees', e.id) })));

  const RULE_KEYS = ['defaultMonthlyFee', 'defaultFeeDeadlineDay', 'fixedFineAfterDeadline', 'finePerDay', 'fineType', 'absentFine', 'feeStartMonth', 'feeEndMonth', 'departments', 'sections', 'useGender', 'whatsappTemplate'];
  const setSettings = async (form) => {
    const rules = Object.fromEntries(RULE_KEYS.map((k) => [k, form[k] ?? settings[k]]));
    const incharge = {
      inchargeName: form.inchargeName ?? settings.inchargeName,
      inchargeDesignation: form.inchargeDesignation ?? settings.inchargeDesignation,
      inchargePhone: form.inchargePhone ?? settings.inchargePhone,
    };
    const ops = [{ type: 'merge', path: ['classes', classId], data: { settings: { ...(classDoc?.settings || {}), ...rules }, ...incharge } }];
    if (classDoc?.inchargeUid) {
      ops.push({ type: 'merge', path: ['users', classDoc.inchargeUid], data: { name: incharge.inchargeName, designation: incharge.inchargeDesignation, phone: incharge.inchargePhone } });
    }
    await write(ops);
  };

  /** Everything this class owns, ready to save as one file (the audit log is read from the server) */
  const getBackupData = async () => {
    const audit = await backend.getCollection(['classes', classId, 'audit']).catch(() => []);
    return buildBackup({
      classId,
      className: settings.className,
      institution: settings.institutionName,
      raw: { ...raw, audit },
      attendance,
      classSettings: classDoc?.settings || {},
    });
  };

  /** Puts a backup back (already checked with validateBackup). Existing records with the same id are replaced. */
  const importBackup = async (backup, { restoreSettings = false } = {}) => {
    const ops = restoreOps(backup, {
      pathOf: P,
      studentIdFor: (roll) => studentIdFor(classId, roll),
      portalKey,
      restoreSettings,
      classPath: ['classes', classId],
    });
    await backend.write(ops, { wait: true });
    audit({ kind: 'student', action: 'ব্যাকআপ থেকে ফেরত আনা', text: `${(backup.students || []).length} জন শিক্ষার্থী`, detail: backup.exportDate ? fmtDate(backup.exportDate.slice(0, 10)) : '' });
    return (backup.students || []).length;
  };

  /* ───────────── background sync: student portal records + principal's class stats ───────────── */
  const syncing = useRef(false);
  useEffect(() => {
    if (loading || !classDoc) return undefined;
    const t = setTimeout(async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const ops = [];
        students.forEach((s) => {
          const key = portalKey(s.studentId || studentIdFor(classId, s.roll), s.pin || '');
          if (s.status === 'inactive') {
            if (s.portalKey && s.portalHash !== 'off') {
              ops.push({ type: 'delete', path: ['portal', s.portalKey] });
              ops.push({ type: 'merge', path: P('students', s.id), data: { portalHash: 'off' } });
            }
            return;
          }
          const snap = buildPortalSnapshot({
            student: s, fees, examFees, fines, payments, attendance, settings,
            attStats: getStudentAttendanceStats(s.id), totalDue: calculateStudentTotalDue(s.id), leaves: raw.leaves, notices: noticesForPortal(raw.notices, todayISO()),
          });
          const hash = quickHash(JSON.stringify(snap));
          if (hash !== s.portalHash || key !== s.portalKey) {
            ops.push({ type: 'set', path: ['portal', key], data: { ...snap, classId, hash, updatedAt: new Date().toISOString() } });
            ops.push({ type: 'merge', path: P('students', s.id), data: { portalKey: key, portalHash: hash } });
          }
        });

        const today = attendance[todayISO()];
        const stats = {
          month: currentMonth,
          year: currentYear,
          students: activeStudents.length,
          collected: thisMonthCollection,
          monthDue: thisMonthDue,
          totalDue: totalDueAcrossAll,
          paid: paidCount,
          overdue: overdueCount,
          attendanceTaken: !!today,
          present: today ? Object.values(today).filter((v) => v === 'Present' || v === 'Late').length : 0,
          absent: today ? Object.values(today).filter((v) => v === 'Absent').length : 0,
          pendingLeaves: raw.leaves.filter((l) => l.status === 'pending').length,
          todayCash: dayCloseSummary(payments, todayISO()).total,
        };
        const statsHash = quickHash(JSON.stringify(stats));
        if (statsHash !== classDoc.statsHash) ops.push({ type: 'merge', path: ['classes', classId], data: { stats, statsHash } });

        if (ops.length) await backend.write(ops);
      } finally {
        syncing.current = false;
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, students, fees, examFees, fines, payments, attendance, settings, classDoc, raw.leaves, raw.notices]);



  /** Closes a day's cash: what the receipts say, what was counted, and who closed it */
  const closeDay = async ({ date, countedCash, note = '' }) => {
    const sum = dayCloseSummary(payments, date);
    const counted = Number(countedCash) || 0;
    const diff = cashDifference(counted, sum.expectedCash);
    const data = {
      id: date, date, total: sum.total, count: sum.count, expectedCash: sum.expectedCash, countedCash: counted, diff, note,
      byMethod: Object.fromEntries(sum.byMethod.filter((m) => m.total > 0).map((m) => [m.id, m.total])),
      closedBy: profile?.name || settings.inchargeName || '', closedAt: new Date().toISOString(),
    };
    await write([{ type: 'set', path: P('closings', date), data }]);
    audit({ kind: 'payment', action: 'দিনের ক্যাশ ক্লোজ', text: fmtDate(date), detail: diff === 0 ? 'হিসাব মিলেছে' : diff > 0 ? `${taka(diff)} বেশি` : `${taka(-diff)} কম`, amount: sum.total });
    return data;
  };

  const reopenDay = async (date) => {
    await write([{ type: 'delete', path: P('closings', date) }]);
    audit({ kind: 'payment', action: 'দিনের ক্লোজ বাতিল', text: fmtDate(date) });
  };


  /**
   * The in-charge decides a leave application. Approving also turns the days already marked
   * absent inside the range into "Leave" (and so lifts their unpaid absence fine).
   */
  const decideLeave = async (id, status, note = '') => {
    const l = raw.leaves.find((x) => x.id === id);
    if (!l) return { converted: 0 };
    await write([{ type: 'merge', path: P('leaves', id), data: { status, note, decidedAt: new Date().toISOString(), decidedBy: profile?.name || settings.inchargeName || '' } }]);
    let converted = 0;
    if (status === 'approved') {
      for (const ch of leaveAttendanceChanges(l, attendance)) {
        await saveAttendanceRecord(ch.date, ch.records);
        converted += 1;
      }
    }
    audit({
      kind: 'student',
      action: status === 'approved' ? 'ছুটি মঞ্জুর করেছেন' : status === 'rejected' ? 'ছুটি নামঞ্জুর করেছেন' : 'ছুটির সিদ্ধান্ত ফিরিয়েছেন',
      text: `${l.studentName} · রোল ${l.roll}`,
      detail: `${l.from}${l.to && l.to !== l.from ? ` – ${l.to}` : ''} · ${leaveDays(l)} দিন`,
      studentId: l.studentId,
      roll: l.roll,
    });
    return { converted };
  };

  /** A leave the in-charge enters directly (a guardian phoned in): approved at once */
  const addLeave = async ({ student, from, to, reason }) => {
    const id = newId('lv');
    const data = { id, classId, studentId: student.id, roll: Number(student.roll), studentName: student.name, portalKey: student.portalKey || '', from, to: to && to >= from ? to : from, reason: String(reason).trim(), status: 'approved', createdAt: new Date().toISOString(), decidedAt: new Date().toISOString(), decidedBy: profile?.name || '', note: 'ইনচার্জ যোগ করেছেন' };
    await write([{ type: 'set', path: P('leaves', id), data }]);
    for (const ch of leaveAttendanceChanges(data, attendance)) await saveAttendanceRecord(ch.date, ch.records);
    audit({ kind: 'student', action: 'ছুটি যোগ করেছেন', text: `${student.name} · রোল ${student.roll}`, detail: `${data.from}${data.to !== data.from ? ` – ${data.to}` : ''} · ${leaveDays(data)} দিন`, studentId: student.id, roll: student.roll });
    return data;
  };


  /** Posts a notice (or changes one) — it reaches every student's portal */
  const saveNotice = async ({ title, text, kind, pinned, expiresOn }, id = null) => {
    const old = id ? raw.notices.find((n) => n.id === id) : null;
    const data = old
      ? { ...old, title: title.trim(), text: text.trim(), kind, pinned: !!pinned, expiresOn: expiresOn || '', updatedAt: new Date().toISOString() }
      : newNotice({ id: newId('nt'), title, text, kind, pinned, expiresOn, by: profile?.name || settings.inchargeName || '' });
    await write([{ type: 'set', path: P('notices', data.id), data }]);
    audit({ kind: 'student', action: old ? 'নোটিশ বদলেছেন' : 'নোটিশ দিয়েছেন', text: data.title });
    return data;
  };

  const deleteNotice = async (id) => {
    const n = raw.notices.find((x) => x.id === id);
    await write([{ type: 'delete', path: P('notices', id) }]);
    if (n) audit({ kind: 'student', action: 'নোটিশ মুছেছেন', text: n.title });
  };

  /* ───────── reminders: who should be nudged now ───────── */
  const REMIND_BEFORE_DAYS = 2; // first nudge when the deadline is this close
  const REMIND_OVERDUE_EVERY = 3; // then every few days while it stays unpaid
  const reminderQueue = useMemo(() => {
    const today = todayISO();
    const out = { upcoming: [], overdue: [], noPhone: 0 };
    activeStudents.forEach((s) => {
      const owed = fees
        .filter((f) => f.studentId === s.id && !f.beforeStart && Number(f.due) > 0)
        .map((f) => f.deadline || monthDeadline(f.month, Number(f.year), settings.defaultFeeDeadlineDay))
        .sort();
      if (!owed.length) return;
      const last = s.lastReminderAt ? String(s.lastReminderAt).slice(0, 10) : '';
      const overdue = owed.filter((d) => d < today);
      let stage = '';
      if (overdue.length) {
        if (!last || daysBetween(last, today) >= REMIND_OVERDUE_EVERY) stage = 'overdue';
      } else if (daysBetween(today, owed[0]) <= REMIND_BEFORE_DAYS) {
        if (!last || last < shiftISODate(owed[0], -REMIND_BEFORE_DAYS)) stage = 'upcoming';
      }
      if (!stage) return;
      if (!s.guardianPhone && !s.studentPhone) out.noPhone += 1;
      else out[stage].push(s);
    });
    return out;
  }, [activeStudents, fees, settings.defaultFeeDeadlineDay]);

  /** A reminder went out: remember it so the same student is not offered again at once */
  const markReminded = async (ids) => {
    const list = students.filter((s) => ids.includes(s.id));
    if (!list.length) return;
    const stamp = new Date().toISOString();
    await write(list.map((s) => ({ type: 'merge', path: P('students', s.id), data: { lastReminderAt: stamp } })));
    audit({
      kind: 'reminder',
      action: 'রিমাইন্ডার পাঠিয়েছেন',
      text: list.length === 1 ? `${list[0].name} · রোল ${list[0].roll}` : `${list.length} জন অভিভাবক`,
      studentId: list.length === 1 ? list[0].id : null,
      roll: list.length === 1 ? list[0].roll : null,
    });
  };

  const nameOf = (id) => students.find((s) => s.id === id)?.name || '';
  const who = (id, roll) => `${nameOf(id) || 'শিক্ষার্থী'}${roll != null ? ` · রোল ${roll}` : ''}`;
  const L = {
    recordPayment: logged(recordPayment, ([a], p) => ({ kind: 'payment', action: 'পেমেন্ট নিয়েছেন', text: `${a.studentName} · রোল ${a.roll}`, detail: p?.receiptNo, amount: Number(a.amount), studentId: a.studentId, roll: a.roll })),
    updatePayment: logged(updatePayment, ([id, u]) => {
      const o = payments.find((x) => x.id === id);
      if (!o) return null;
      const ch = [];
      if (u.amount != null && Number(u.amount) !== Number(o.amount)) ch.push(`${taka(o.amount)} → ${taka(u.amount)}`);
      if (u.method && u.method !== o.method) ch.push(`${o.method} → ${u.method}`);
      if (u.paymentDate && String(u.paymentDate).slice(0, 10) !== String(o.paymentDate).slice(0, 10)) ch.push('তারিখ বদল');
      return { kind: 'payment', action: 'পেমেন্ট সম্পাদনা', text: `${o.studentName} · রোল ${o.roll}`, detail: [o.receiptNo, ...ch].join(' · '), amount: Number(u.amount ?? o.amount), studentId: o.studentId, roll: o.roll };
    }),
    deletePayment: logged(deletePayment, ([id]) => {
      const o = payments.find((x) => x.id === id);
      return o && { kind: 'payment', action: 'পেমেন্ট ও রশিদ মুছেছেন', text: `${o.studentName} · রোল ${o.roll}`, detail: o.receiptNo, amount: Number(o.amount), studentId: o.studentId, roll: o.roll };
    }),
    addFine: logged(addFine, ([a]) => ({ kind: 'fine', action: 'জরিমানা দিয়েছেন', text: who(a.studentId, a.roll), detail: a.reason, amount: Number(a.amount), studentId: a.studentId, roll: a.roll })),
    updateFine: logged(updateFine, ([id, u]) => {
      const f = fines.find((x) => x.id === id);
      if (!f) return null;
      const ch = [];
      if (u.amount != null && Number(u.amount) !== Number(f.amount)) ch.push(`${taka(f.amount)} → ${taka(u.amount)}`);
      if (u.waived != null && Number(u.waived) !== Number(f.waived || 0)) ch.push(`মওকুফ ${taka(u.waived)}`);
      if (u.reason != null && u.reason !== f.reason) ch.push(`কারণ: ${u.reason}`);
      return ch.length ? { kind: 'fine', action: 'জরিমানা সম্পাদনা', text: who(f.studentId, f.roll), detail: ch.join(' · '), amount: Number(u.amount ?? f.amount), studentId: f.studentId, roll: f.roll } : null;
    }),
    waiveFine: logged(waiveFine, ([id]) => {
      const f = fines.find((x) => x.id === id);
      return f && { kind: 'fine', action: 'জরিমানা মওকুফ', text: who(f.studentId, f.roll), detail: f.reason, amount: Number(f.due), studentId: f.studentId, roll: f.roll };
    }),
    deleteFine: logged(deleteFine, ([id]) => {
      const f = fines.find((x) => x.id === id);
      return f && { kind: 'fine', action: 'জরিমানা মুছেছেন', text: who(f.studentId, f.roll), detail: f.reason, amount: Number(f.amount), studentId: f.studentId, roll: f.roll };
    }),
    waiveStudentFines: logged(waiveStudentFines, ([sid], res) => (Number(res) > 0 ? { kind: 'fine', action: 'জরিমানা মওকুফ', text: who(sid), amount: Number(res), studentId: sid } : null)),
    updateFee: logged(updateFee, ([id, patch]) => {
      const f = fees.find((x) => x.id === id);
      if (!f) return null;
      const label = { amount: 'ফি', fine: 'জরিমানা', fineWaived: 'জরিমানা মওকুফ', deadline: 'শেষ তারিখ', reason: 'কারণ', note: 'নোট', paid: 'পরিশোধ', status: 'অবস্থা' };
      const ch = Object.keys(patch).filter((k) => label[k] && String(patch[k] ?? '') !== String(f[k] ?? '')).map((k) => label[k]);
      return ch.length ? { kind: 'fee', action: 'বেতনের তথ্য বদল', text: `${who(f.studentId, f.roll)} · ${monthBn(f.month)} ${f.year}`, detail: ch.join(', '), studentId: f.studentId, roll: f.roll } : null;
    }),
    markMonthPaid: logged(markMonthPaid, ([m, y], n) => (n > 0 ? { kind: 'fee', action: 'ভর্তির সময় আদায় চিহ্নিত', text: `${monthBn(m)} ${y}`, detail: `${n} জন` } : null)),
    generateMonthFees: logged(generateMonthFees, ([m, y, d], n) => (n > 0 ? { kind: 'fee', action: 'মাসের বেতন তৈরি', text: `${monthBn(m ?? currentMonth)} ${y ?? currentYear}`, detail: `${n} জন${d ? ` · শেষ তারিখ ${fmtDate(d)}` : ''}` } : null)),
    generateArrears: logged(generateArrears, (_a, n) => (n > 0 ? { kind: 'fee', action: 'বাকি মাসের বেতন তৈরি', text: `${n}টি বেতন` } : null)),
    removeMonthFees: logged(removeMonthFees, ([m, y], r) => (r?.removed > 0 ? { kind: 'fee', action: 'মাসের বকেয়া সরিয়েছেন', text: `${monthBn(m)} ${y}`, detail: `${r.removed} জন` } : null)),
    setMonthDeadline: logged(setMonthDeadline, ([m, y, d], n) => (n > 0 ? { kind: 'fee', action: 'শেষ তারিখ বদল', text: `${monthBn(m)} ${y}`, detail: `${fmtDate(d)} · ${n} জন` } : null)),
    createExam: logged(createExam, ([a], n) => ({ kind: 'exam', action: 'পরীক্ষার ফি তৈরি', text: a.examName, detail: `${n} জন`, amount: Number(a.amount) })),
    updateExamFees: logged(updateExamFees, ([ids, p]) => {
      const e = examFees.find((x) => ids.includes(x.id));
      return e && { kind: 'exam', action: 'পরীক্ষার ফি সম্পাদনা', text: p.examName || e.examName, detail: ids.length > 1 ? `${ids.length} জন` : who(e.studentId, e.roll), amount: Number(p.amount ?? e.amount) };
    }),
    deleteExamFees: logged(deleteExamFees, ([ids]) => {
      const e = examFees.find((x) => ids.includes(x.id));
      return e && { kind: 'exam', action: 'পরীক্ষার ফি মুছেছেন', text: e.examName, detail: `${ids.length} জন` };
    }),
    addStudent: logged(addStudent, ([input], st) => ({ kind: 'student', action: 'নতুন ভর্তি', text: `${st?.name || input.name} · রোল ${st?.roll ?? input.roll}`, studentId: st?.id, roll: st?.roll ?? input.roll })),
    deleteStudent: logged(deleteStudent, ([id]) => {
      const st = students.find((x) => x.id === id);
      return st && { kind: 'student', action: 'শিক্ষার্থী মুছেছেন', text: `${st.name} · রোল ${st.roll}`, roll: st.roll };
    }),
    updateStudent: logged(updateStudent, ([id, p]) => {
      const st = students.find((x) => x.id === id);
      if (!st) return null;
      const label = { monthlyFee: 'মাসিক ফি', tuitionFee: 'বেতন', transport: 'পরিবহন', transportFee: 'পরিবহন ফি', status: 'অবস্থা', roll: 'রোল', absentFine: 'অনুপস্থিতি জরিমানা' };
      const ch = Object.keys(p).filter((k) => label[k] && String(p[k] ?? '') !== String(st[k] ?? '')).map((k) => label[k]);
      return ch.length ? { kind: 'student', action: 'শিক্ষার্থীর তথ্য বদল', text: `${st.name} · রোল ${st.roll}`, detail: [...new Set(ch)].join(', '), studentId: id, roll: st.roll } : null;
    }),
  };

  const value = {
    loading,
    classId,
    classDoc,
    profile,
    isPrincipal: profile?.role === 'superadmin',
    isLocal,
    isFirestoreConnected: !isLocal,
    userRole: 'admin',
    exitClass: onExit,
    signOut: onSignOut,
    openPortal: onOpenPortal,

    students, fees, examFees, fines, payments, attendance, settings, setSettings,
    totalStudentsCount: students.length,
    activeStudentsCount: activeStudents.length,
    thisMonthCollection, thisMonthDue, totalDueAcrossAll, paidCount, dueCount, overdueCount,
    missingFeeCount: missingFeeStudents.length,
    feeStartMonth,
    feeEndMonth,
    feeMonths,
    generateArrears,
    waiveStudentFines,
    isBeforeStart: (month, year) => isBeforeFeeStart(month, year, feeStartMonth),
    isAdmissionMonth: (month, year) => isAdmissionMonth(month, year, feeStartMonth),

    activeTab, setActiveTab,

    addStudent, updateStudent, deleteStudent, updateFee, markMonthPaid, generateMonthFees, removeMonthFees, setMonthDeadline, applyAutoFines, saveAttendanceRecord,
    getStudentAttendanceStats, recordPayment, updatePayment, deletePayment, addFine, updateFine, waiveFine, deleteFine, absenceFineFor, createExam, updateExamFees, deleteExamFees, calculateStudentTotalDue,
    generateWhatsAppMessage, getStudentDueItems, importBackup,
    reminderQueue, markReminded, closings, closeDay, reopenDay, rawRecords: raw, getBackupData, leaves: raw.leaves, notices: raw.notices, decideLeave, addLeave, saveNotice, deleteNotice,
    // the same actions, each leaving a line in the audit log
    ...L,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
