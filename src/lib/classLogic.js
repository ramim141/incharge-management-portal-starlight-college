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
    feeStartMonth: c.settings?.feeStartMonth || '',
    feeEndMonth: c.settings?.feeEndMonth || '',
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
    // the transport part of `amount` (collected together with the monthly fee, shown separately)
    transport: student.transport ? Number(student.transportFee || 0) : 0,
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
 * Calculates a period N months after a given period: "2026-07" + 11 → "2027-06"
 */
export const addMonthsPeriod = (period, count = 11) => {
  if (!period || !period.includes('-')) return '';
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + count;
  const ry = Math.floor(total / 12);
  const rm = (total % 12) + 1;
  return `${ry}-${pad(rm, 2)}`;
};

/**
 * True only for the admission/start month (e.g. July 2027 for XI-2027-28).
 * This month's fee was taken at admission — displayed as "বেতন হয়ে গেছে (ভর্তির সময়)", never due.
 */
export const isAdmissionMonth = (month, year, feeStartMonth) => !!feeStartMonth && periodOf(month, year) === feeStartMonth;

/**
 * Months strictly before the class session began (e.g. before July 2027).
 */
export const isBeforeFeeStart = (month, year, feeStartMonth) => !!feeStartMonth && periodOf(month, year) < feeStartMonth;

/**
 * Either the admission month or earlier — tuition was covered at admission, nothing is owed.
 */
export const isAdmissionPaid = (month, year, feeStartMonth) => !!feeStartMonth && periodOf(month, year) <= feeStartMonth;

export const BEFORE_START_LABEL = 'বেতন ভর্তির সময় নেওয়া হয়েছে';
export const ADMISSION_PAID_LABEL = 'বেতন হয়ে গেছে (ভর্তির সময় নেওয়া)';

/**
 * The months a class collects fees for: from its fee start / admission month
 * through its fee end month (or 11 months later / session end).
 * Returns [{ month, year, period }] in chronological order.
 */
export function feeMonthRange({ feeStartMonth, feeEndMonth, currentMonth, currentYear }) {
  const curIdx = ACADEMIC_MONTHS.indexOf(currentMonth);
  const sessionStart = curIdx <= 5 ? currentYear : currentYear - 1;
  let [y, m] = feeStartMonth ? feeStartMonth.split('-').map(Number) : [sessionStart, 7];

  let endPeriod = feeEndMonth;
  if (!endPeriod) {
    if (feeStartMonth) {
      endPeriod = addMonthsPeriod(feeStartMonth, 11);
    } else {
      endPeriod = `${sessionStart + 1}-06`;
    }
  }

  const out = [];
  while (true) {
    const month = EN_MONTHS[m - 1];
    const period = periodOf(month, y);
    out.push({ month, year: y, period });
    if (period >= endPeriod) break;
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
export const feeStartLabel = (feeStartMonth) => {
  if (!feeStartMonth || !feeStartMonth.includes('-')) return '';
  const [y, m] = feeStartMonth.split('-').map(Number);
  const bName = m >= 1 && m <= 12 ? BN_MONTHS[m - 1] : '';
  return bName ? `${bName} ${y}` : feeStartMonth;
};

/**
 * Default for "this month's fee was taken at admission": yes for a new intake (no fee start, or
 * the fee start is this month or later); no for a class already running (start in the past),
 * whose students are not being admitted now.
 */
export const admissionPaidDefault = (feeStartMonth, now = new Date()) =>
  !feeStartMonth || feeStartMonth >= periodOf(EN_MONTHS[now.getMonth()], now.getFullYear());

export const ADMISSION_NOTE = 'ভর্তির সময় আদায়';

/**
 * The same fee row, paid without a receipt (e.g. collected at admission). Admission covers the
 * monthly fee only — a student's transport part stays owed until it is collected.
 */
export function markFeePaid(fee, note = ADMISSION_NOTE) {
  const total = Number(fee.amount) + Number(fee.fine || 0) - Number(fee.fineWaived || 0);
  const transport = Math.min(Math.max(0, Number(fee.transport) || 0), Math.max(0, total));
  const paid = Math.max(Number(fee.paid || 0), total - transport);
  const due = Math.max(0, total - paid);
  return { ...fee, paid, due, status: due > 0 ? 'Partial' : 'Paid', note: note || fee.note || '', settledAt: new Date().toISOString() };
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
