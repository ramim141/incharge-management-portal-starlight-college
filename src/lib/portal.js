import { groupBn, sectionBn, genderBn } from './format';

// What a student is allowed to see about themself. This record is stored under a key
// derived from Student ID + PIN; it deliberately leaves out the PIN, fee reasons and admin notes.
export function buildPortalSnapshot({ student: s, fees, examFees, fines, payments, attendance, settings, attStats, totalDue }) {
  const attLog = Object.keys(attendance)
    .filter((d) => attendance[d]?.[s.id])
    .sort()
    .reverse()
    .slice(0, 400) // about a full session, for the portal's attendance calendar
    .map((date) => ({ date, status: attendance[date][s.id] }));

  return {
    v: 1,
    student: {
      id: s.id,
      name: s.name,
      nameEn: s.nameEn || '',
      roll: s.roll,
      group: s.group,
      groupLabel: groupBn(s.group),
      section: s.section || '',
      sectionLabel: sectionBn(s.section),
      genderLabel: settings.useGender === false ? '' : genderBn(s.gender),
      gender: s.gender || '',
      studentId: s.studentId,
      fatherName: s.fatherName || '',
      motherName: s.motherName || '',
      guardianPhone: s.guardianPhone || '',
      address: s.address || '',
      admissionDate: s.admissionDate || '',
      monthlyFee: s.monthlyFee || 0,
    },
    cls: {
      code: settings.classCode,
      institutionName: settings.institutionName,
      sectionName: settings.sectionName,
      inchargeName: settings.inchargeName || '',
      inchargePhone: settings.inchargePhone || '',
      defaultFeeDeadlineDay: settings.defaultFeeDeadlineDay,
      feeStartMonth: settings.feeStartMonth || '',
    },
    fees: fees
      .filter((f) => f.studentId === s.id)
      .map(({ id, studentId, month, year, amount, fine, fineWaived, paid, due, status, deadline, beforeStart }) => ({ id, studentId, month, year, amount, fine: fine || 0, fineWaived: fineWaived || 0, paid: paid || 0, due, status, deadline: deadline || '', beforeStart: !!beforeStart })),
    exams: examFees
      .filter((e) => e.studentId === s.id)
      .map(({ id, studentId, examName, amount, paid, due, status, paymentDate, deadline }) => ({ id, studentId, examName, amount, paid: paid || 0, due: due || 0, status, paymentDate: paymentDate || null, deadline: deadline || '' })),
    fines: fines
      .filter((f) => f.studentId === s.id)
      .map(({ id, studentId, amount, waived, paid, due, reason, date, status }) => ({ id, studentId, amount, waived: waived || 0, paid: paid || 0, due: due || 0, reason, date, status })),
    payments: payments.filter((p) => p.studentId === s.id),
    att: attStats,
    attLog,
    totalDue,
  };
}
