// Pure helpers shared by the in-charge's class screen (AppContext) and the principal's bulk student
// import, so a student added either way gets exactly the same records.
import { DEFAULT_CLASS_SETTINGS } from './defaults';
import { EN_MONTHS } from './format';
import { newId, portalKey } from './hash';

export const pad = (n, w) => String(n).padStart(w, '0');

export const studentIdFor = (classId, roll) => `${classId}-${pad(roll, 4)}`;

export const monthDeadline = (month, year, day) =>
  `${year}-${pad(EN_MONTHS.indexOf(month) + 1, 2)}-${pad(Math.min(28, Math.max(1, Number(day) || 10)), 2)}`;

/** Effective settings of a class: defaults + the class's own rules + names shown on screens */
export function buildClassSettings({ classDoc, classId, institution, month, year }) {
  const c = classDoc || {};
  return {
    ...DEFAULT_CLASS_SETTINGS,
    ...(c.settings || {}),
    classCode: classId,
    className: c.name || classId,
    institutionName: institution?.name || '',
    sectionName: [c.name, c.section, c.session && `সেশন ${c.session}`].filter(Boolean).join(' · '),
    inchargeName: c.inchargeName || '',
    inchargeDesignation: c.inchargeDesignation || '',
    inchargePhone: c.inchargePhone || '',
    inchargeEmail: c.inchargeEmail || '',
    currentMonth: month,
    currentYear: year,
  };
}

/** A month's fee row for a student (unpaid) */
export function newFeeRow(student, settings, month = settings.currentMonth, year = settings.currentYear) {
  const amount = Number(student.monthlyFee || settings.defaultMonthlyFee);
  return {
    id: `fee-${student.id}-${year}-${month}`,
    studentId: student.id,
    roll: Number(student.roll),
    month,
    year,
    amount,
    paid: 0,
    due: amount,
    fine: 0,
    deadline: monthDeadline(month, year, settings.defaultFeeDeadlineDay),
    status: 'Due',
    reason: '',
    note: '',
  };
}

export const ADMISSION_NOTE = 'ভর্তির সময় আদায়';

/** The same fee row, fully paid without a receipt (e.g. collected at admission) */
export function markFeePaid(fee, note = ADMISSION_NOTE) {
  const total = Number(fee.amount) + Number(fee.fine || 0);
  return { ...fee, paid: total, due: 0, status: 'Paid', note: note || fee.note || '', settledAt: new Date().toISOString() };
}

export const randomPin = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return pad(1000 + (a[0] % 9000), 4);
};

/** Full student record from form/import input; a PIN is generated when none is given */
export function newStudentRecord(input, classId, settings) {
  const id = newId('std');
  const roll = Number(input.roll);
  const studentId = studentIdFor(classId, roll);
  const pin = String(input.pin || randomPin());
  return {
    ...input,
    id,
    roll,
    studentId,
    pin,
    monthlyFee: Number(input.monthlyFee || settings.defaultMonthlyFee),
    status: input.status || 'active',
    portalKey: portalKey(studentId, pin),
    portalHash: null,
  };
}
