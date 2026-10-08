// Pure helpers shared by the in-charge's class screen (AppContext) and the principal's bulk student
// import, so a student added either way gets exactly the same records.
import { DEFAULT_CLASS_SETTINGS } from './defaults';
import { EN_MONTHS, BN_MONTHS, ACADEMIC_MONTHS } from './format';
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

/** "2026-11" for November 2026 — how fee months are compared */
export const periodOf = (month, year) => `${year}-${pad(EN_MONTHS.indexOf(month) + 1, 2)}`;

/**
 * Class setting `feeStartMonth` ("2026-11"): fees are collected from this month on. Earlier months
 * were taken with admission — never owed, never collected, labelled "ভর্তির সময় নেওয়া".
 */
export const isBeforeFeeStart = (month, year, feeStartMonth) => !!feeStartMonth && periodOf(month, year) < feeStartMonth;

export const BEFORE_START_LABEL = 'বেতন ভর্তির সময় নেওয়া হয়েছে';

/**
 * The months a class collects fees for: from its fee start month (or the current session's July)
 * through the end of the current session (June) — e.g. January 2026 → June 2027 for a class
 * carrying arrears. Returns [{ month, year, period }] in order.
 */
export function feeMonthRange({ feeStartMonth, currentMonth, currentYear }) {
  const curIdx = ACADEMIC_MONTHS.indexOf(currentMonth);
  const sessionStart = curIdx <= 5 ? currentYear : currentYear - 1;
  let [y, m] = feeStartMonth ? feeStartMonth.split('-').map(Number) : [sessionStart, 7];
  const out = [];
  while (y < sessionStart + 1 || (y === sessionStart + 1 && m <= 6)) {
    const month = EN_MONTHS[m - 1];
    out.push({ month, year: y, period: periodOf(month, y) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 60) break; // safety: never more than 5 years
  }
  return out;
}

/** "নভেম্বর 2026" for "2026-11" */
export const feeStartLabel = (feeStartMonth) => (feeStartMonth ? `${BN_MONTHS[Number(feeStartMonth.slice(5)) - 1]} ${feeStartMonth.slice(0, 4)}` : '');

/**
 * Default for "this month's fee was taken at admission": yes for a new intake (no fee start, or
 * the fee start is this month or later); no for a class already running (start in the past),
 * whose students are not being admitted now.
 */
export const admissionPaidDefault = (feeStartMonth, now = new Date()) =>
  !feeStartMonth || feeStartMonth >= periodOf(EN_MONTHS[now.getMonth()], now.getFullYear());

export const ADMISSION_NOTE = 'ভর্তির সময় আদায়';

/** The same fee row, fully paid without a receipt (e.g. collected at admission) */
export function markFeePaid(fee, note = ADMISSION_NOTE) {
  const total = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
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
