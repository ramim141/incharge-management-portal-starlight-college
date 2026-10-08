import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backend, isLocal } from '../backend';
import { studentIdFor, buildClassSettings, newFeeRow, newStudentRecord, markFeePaid, ADMISSION_NOTE, isBeforeFeeStart, pad } from '../lib/classLogic';
import { EN_MONTHS, todayISO, feeStatus, setClassLabels } from '../lib/format';
import { newId, portalKey, quickHash } from '../lib/hash';
import { buildPortalSnapshot } from '../lib/portal';

// Everything about ONE class: its students, fees, attendance, payments… plus the actions
// screens use. Each in-charge only ever mounts their own class; the principal can mount any.
export const AppContext = createContext(null);

const COLLS = ['students', 'fees', 'examFees', 'fines', 'payments', 'attendance'];

export { studentIdFor };


// "due" is always derived, so a fee row can never disagree with itself
const normalizeFee = (f, feeStartMonth) => {
  // Months before the class's fee start were taken with admission: nothing is owed for them
  if (isBeforeFeeStart(f.month, f.year, feeStartMonth)) {
    return { ...f, amount: Number(f.amount || 0), fine: 0, paid: Number(f.paid || 0), due: 0, status: 'Paid', beforeStart: true };
  }
  const amount = Number(f.amount || 0);
  const fine = Number(f.fine || 0);
  const paid = Number(f.paid || 0);
  const due = Math.max(0, amount + fine - paid);
  let status = f.status;
  if (due === 0 && (paid > 0 || amount === 0)) status = 'Paid';
  else if (paid > 0 && status !== 'Overdue') status = 'Partial';
  else if (status === 'Paid') status = 'Due';
  return { ...f, amount, fine, paid, due, status };
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
  const [raw, setRaw] = useState({ students: [], fees: [], examFees: [], fines: [], payments: [], attendance: [] });
  const [ready, setReady] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');

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
  const students = useMemo(() => [...raw.students].sort((a, b) => Number(a.roll) - Number(b.roll)), [raw.students]);
  const feeStartMonth = classDoc?.settings?.feeStartMonth || '';
  const fees = useMemo(() => raw.fees.map((f) => normalizeFee(f, feeStartMonth)), [raw.fees, feeStartMonth]);
  const examFees = raw.examFees;
  const fines = useMemo(() => raw.fines.map(normalizeFine).sort((a, b) => String(b.date).localeCompare(String(a.date))), [raw.fines]);
  const payments = useMemo(() => [...raw.payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)), [raw.payments]);
  const attendance = useMemo(() => Object.fromEntries(raw.attendance.map((a) => [a.date || a.id, a.records || {}])), [raw.attendance]);

  const now = new Date();
  const currentMonth = EN_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  const settings = useMemo(
    () => buildClassSettings({ classDoc, classId, institution, month: currentMonth, year: currentYear }),
    [classDoc, classId, institution, currentMonth, currentYear],
  );
  // Label helpers (groupBn, sectionBn…) read this class's own department / section names
  setClassLabels(settings);

  const P = (coll, id) => ['classes', classId, coll, id];
  const write = (ops) => backend.write(ops);

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

  const generateWhatsAppMessage = (student) => {
    const fee = currentMonthFees.find((f) => f.studentId === student.id);
    return String(settings.whatsappTemplate || '')
      .replace(/\{student_name\}/g, student.name)
      .replace(/\{month\}/g, currentMonth)
      .replace(/\{monthly_fee\}/g, fee?.amount || student.monthlyFee || settings.defaultMonthlyFee)
      .replace(/\{total_due\}/g, calculateStudentTotalDue(student.id))
      .replace(/\{deadline\}/g, `${settings.defaultFeeDeadlineDay} ${currentMonth} ${currentYear}`)
      .replace(/\{incharge_name\}/g, settings.inchargeName)
      .replace(/\{incharge_phone\}/g, settings.inchargePhone || '')
      .replace(/\{class_name\}/g, settings.className)
      .replace(/\{roll\}/g, student.roll);
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
    const studentId = studentIdFor(classId, merged.roll);
    const key = portalKey(studentId, merged.pin);
    const { id: _ignore, ...data } = { ...patch, roll: Number(merged.roll), studentId, portalKey: key };
    if (key !== old.portalKey) data.portalHash = null;
    const ops = [{ type: 'merge', path: P('students', id), data }];
    if (old.portalKey && old.portalKey !== key) ops.push({ type: 'delete', path: ['portal', old.portalKey] });
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

  const updateFee = (id, patch) => write([{ type: 'merge', path: P('fees', id), data: patch }]);

  const generateMonthFees = async (month = currentMonth, year = currentYear) => {
    if (isBeforeFeeStart(month, year, feeStartMonth)) return 0;
    const have = new Set(fees.filter((f) => f.month === month && Number(f.year) === Number(year)).map((f) => f.studentId));
    const ops = activeStudents
      .filter((s) => !have.has(s.id))
      .map((s) => {
        const row = feeRow(s, month, Number(year));
        return { type: 'set', path: P('fees', row.id), data: row };
      });
    if (ops.length) await write(ops);
    return ops.length;
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
  const recordPayment = async ({ studentId, roll, studentName, amount, items, method = 'Cash', trxId = '', paymentDate = new Date().toISOString(), feeId = null, feeMonths = null, fineId = null, fineIds = null, examFeeId = null }) => {
    const last = payments.reduce((m, p) => Math.max(m, Number(String(p.receiptNo).split('-').pop()) || 0), 100);
    const payment = {
      id: newId('pay'),
      receiptNo: `INV-${classId}-${pad(last + 1, 5)}`,
      studentId,
      roll: Number(roll),
      studentName,
      amount: Number(amount),
      items: items || [{ description: `${currentMonth} Fee`, amount: Number(amount) }],
      method,
      trxId,
      paymentDate,
      inchargeName: profile?.name || settings.inchargeName,
      recordedBy: profile?.uid || null,
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
      const owed = Math.max(0, Number(fee.amount) + Number(fee.fine || 0) - Number(fee.paid || 0));
      const pay = i === monthRows.length - 1 ? left : Math.min(left, owed);
      left -= pay;
      const paid = Number(fee.paid || 0) + pay;
      const due = Math.max(0, Number(fee.amount) + Number(fee.fine || 0) - paid);
      ops.push({ type: 'merge', path: P('fees', fee.id), data: { paid, due, status: due === 0 ? 'Paid' : 'Partial' } });
    });
    await write(ops);
    return payment;
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

  const RULE_KEYS = ['defaultMonthlyFee', 'defaultFeeDeadlineDay', 'fixedFineAfterDeadline', 'finePerDay', 'fineType', 'absentFine', 'feeStartMonth', 'departments', 'sections', 'useGender', 'whatsappTemplate'];
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

  /** Restores a JSON backup (from this or the old single-class version) into this class */
  const importBackup = async (backup) => {
    const ops = [];
    (backup.students || []).forEach((s) => {
      const studentId = studentIdFor(classId, s.roll);
      ops.push({ type: 'set', path: P('students', s.id), data: { ...s, studentId, portalKey: portalKey(studentId, s.pin || '0000'), portalHash: null } });
    });
    ['fees', 'examFees', 'fines', 'payments'].forEach((c) => (backup[c] || []).forEach((d) => ops.push({ type: 'set', path: P(c, d.id), data: d })));
    Object.entries(backup.attendance || {}).forEach(([date, records]) => ops.push({ type: 'set', path: P('attendance', date), data: { date, records } }));
    await backend.write(ops, { wait: true });
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
            attStats: getStudentAttendanceStats(s.id), totalDue: calculateStudentTotalDue(s.id),
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
  }, [loading, students, fees, examFees, fines, payments, attendance, settings, classDoc]);

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
    isBeforeStart: (month, year) => isBeforeFeeStart(month, year, feeStartMonth),

    activeTab, setActiveTab,

    addStudent, updateStudent, deleteStudent, updateFee, markMonthPaid, generateMonthFees, applyAutoFines, saveAttendanceRecord,
    getStudentAttendanceStats, recordPayment, addFine, updateFine, waiveFine, deleteFine, absenceFineFor, createExam, calculateStudentTotalDue,
    generateWhatsAppMessage, importBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
