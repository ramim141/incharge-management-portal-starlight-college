// Bulk student import for the principal: a CSV file or rows pasted from Excel / Google Sheets.
// Each row goes to the class named in its "class" column (or the class picked on screen).
import { newStudentRecord, newFeeRow, buildClassSettings } from './classLogic';
import { buildPortalSnapshot } from './portal';
import { quickHash } from './hash';
import { setClassLabels } from './format';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toEnDigits = (s) => String(s ?? '').replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d));
const clean = (s) => String(s ?? '').replace(/^﻿/, '').trim();
const key = (s) => clean(s).toLowerCase().replace(/[\s._\-()/]+/g, '');

/** Splits CSV / TSV text into rows; handles quotes, commas inside quotes and Windows line ends */
export function parseTable(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => clean(c) !== ''));
}

// Accepted header names (Bangla or English, any case/spacing) → field
const HEADERS = {
  classCode: ['class', 'classcode', 'ক্লাস', 'ক্লাসকোড', 'শ্রেণি', 'শ্রেণী'],
  roll: ['roll', 'rollno', 'rollnumber', 'রোল', 'রোলনং', 'রোলনম্বর'],
  name: ['name', 'namebangla', 'namebn', 'নাম', 'নামবাংলা', 'নামবাংলায়', 'শিক্ষার্থীরনাম'],
  nameEn: ['nameen', 'nameenglish', 'englishname', 'নামইংরেজি', 'ইংরেজিনাম'],
  group: ['group', 'department', 'dept', 'বিভাগ', 'গ্রুপ'],
  section: ['section', 'শাখা'],
  gender: ['gender', 'sex', 'লিঙ্গ', 'ছাত্রছাত্রী'],
  fatherName: ['father', 'fathername', 'fathersname', 'পিতা', 'পিতারনাম', 'বাবারনাম'],
  motherName: ['mother', 'mothername', 'mothersname', 'মাতা', 'মাতারনাম', 'মায়েরনাম'],
  guardianPhone: ['phone', 'mobile', 'guardianphone', 'guardianmobile', 'মোবাইল', 'ফোন', 'অভিভাবকেরমোবাইল', 'অভিভাবকেরফোন'],
  address: ['address', 'ঠিকানা'],
  monthlyFee: ['fee', 'monthlyfee', 'বেতন', 'মাসিকবেতন'],
  pin: ['pin', 'পিন'],
};
const FIELD_OF = Object.fromEntries(Object.entries(HEADERS).flatMap(([f, names]) => names.map((n) => [key(n), f])));

export const TEMPLATE_CSV =
  'class,roll,name,nameEn,department,section,gender,father,mother,phone,address,fee,pin\n' +
  'XI-2026,101,মো: রহিম আহমেদ,Md. Rahim Ahmed,বিজ্ঞান,,ছাত্র,আব্দুল করিম,রহিমা বেগম,01712345678,ঢাকা,1000,\n';

const GENDER = { male: 'Male', m: 'Male', boy: 'Male', ছাত্র: 'Male', পুরুষ: 'Male', female: 'Female', f: 'Female', girl: 'Female', ছাত্রী: 'Female', মহিলা: 'Female' };
const DEPT_ALIASES = {
  Science: ['science', 'sci', 'বিজ্ঞান'],
  'Business Studies': ['business', 'businessstudies', 'commerce', 'ব্যবসায়', 'ব্যবসায়শিক্ষা', 'বাণিজ্য'],
  Humanities: ['humanities', 'arts', 'hum', 'মানবিক'],
};

/** Finds (or creates) the class's department / section entry for a typed value */
function matchGroup(list, value, aliases = {}) {
  const v = key(value);
  if (!v) return { id: '', added: null };
  const hit = list.find((d) => key(d.bn) === v || key(d.id) === v || (aliases[d.id] || []).some((a) => key(a) === v));
  if (hit) return { id: hit.id, added: null };
  const entry = { id: `g-${Date.now().toString(36)}${list.length}`, bn: clean(value) };
  list.push(entry);
  return { id: entry.id, added: entry };
}

/**
 * Turns parsed rows into a per-class plan.
 * classes: [{ id, name, settings }], existing: { [classId]: students[] }
 */
export function planImport(rows, { classes, existing, defaultClass }) {
  const errors = [];
  if (rows.length < 2) return { plan: [], errors: [{ row: 0, msg: 'প্রথম লাইনে কলামের নাম, তার নিচে শিক্ষার্থীদের তথ্য দিন' }], unknownHeaders: [] };

  const header = rows[0].map((h) => FIELD_OF[key(h)] || null);
  const unknownHeaders = rows[0].filter((h, i) => clean(h) && !header[i]).map(clean);
  if (!header.includes('roll') || !header.includes('name')) {
    return { plan: [], errors: [{ row: 1, msg: 'কমপক্ষে "রোল" ও "নাম" কলাম লাগবে' }], unknownHeaders };
  }

  const byCode = new Map(classes.map((c) => [c.id.toUpperCase(), c]));
  const byName = new Map();
  classes.forEach((c) => byName.set(key(c.name), byName.has(key(c.name)) ? 'ambiguous' : c));

  const groups = new Map(); // classId → { cls, students, departments, sections, addedDepts, addedSections, skipped }
  const seen = new Set();

  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const rec = {};
    header.forEach((f, c) => {
      if (f) rec[f] = clean(cells[c]);
    });

    let cls = defaultClass ? byCode.get(defaultClass.toUpperCase()) : null;
    if (rec.classCode) {
      const found = byCode.get(rec.classCode.toUpperCase()) || byName.get(key(rec.classCode));
      if (found === 'ambiguous') return errors.push({ row: line, msg: `"${rec.classCode}" নামে একাধিক ক্লাস — ক্লাস কোড লিখুন` });
      if (!found) return errors.push({ row: line, msg: `"${rec.classCode}" ক্লাস পাওয়া যায়নি` });
      cls = found;
    }
    if (!cls) return errors.push({ row: line, msg: 'কোন ক্লাস তা নেই — "ক্লাস" কলাম দিন বা উপরে ক্লাস বাছুন' });

    const roll = Number(toEnDigits(rec.roll));
    if (!Number.isInteger(roll) || roll <= 0 || roll > 999999) return errors.push({ row: line, msg: `রোল "${rec.roll || ''}" সঠিক নয়` });
    if (!rec.name) return errors.push({ row: line, msg: 'নাম নেই' });

    const dupKey = `${cls.id}|${roll}`;
    if (seen.has(dupKey)) return errors.push({ row: line, msg: `রোল ${roll} (${cls.name}) তালিকায় দুবার আছে` });
    seen.add(dupKey);

    if (!groups.has(cls.id)) {
      const s = cls.settings || {};
      groups.set(cls.id, {
        cls,
        students: [],
        skipped: [],
        departments: [...(s.departments || [])].map((d) => ({ ...d })),
        sections: [...(s.sections || [])].map((d) => ({ ...d })),
        addedDepts: [],
        addedSections: [],
      });
    }
    const g = groups.get(cls.id);
    if ((existing[cls.id] || []).some((st) => Number(st.roll) === roll)) {
      g.skipped.push({ row: line, roll, name: rec.name });
      return undefined;
    }

    let phone = toEnDigits(rec.guardianPhone).replace(/[^0-9]/g, '');
    if (phone.startsWith('88')) phone = phone.slice(2);
    if (phone.length === 10 && phone.startsWith('1')) phone = `0${phone}`;
    const pin = toEnDigits(rec.pin).replace(/\D/g, '');
    if (rec.pin && !/^\d{4,6}$/.test(pin)) return errors.push({ row: line, msg: `পিন "${rec.pin}" ৪–৬ সংখ্যার হতে হবে` });

    const dept = matchGroup(g.departments, rec.group, DEPT_ALIASES);
    if (dept.added) g.addedDepts.push(dept.added);
    const sec = matchGroup(g.sections, rec.section);
    if (sec.added) g.addedSections.push(sec.added);

    g.students.push({
      row: line,
      input: {
        name: rec.name,
        nameEn: rec.nameEn || '',
        roll,
        group: dept.id || (g.departments[0]?.id ?? ''),
        section: sec.id,
        gender: GENDER[key(rec.gender)] || '',
        fatherName: rec.fatherName || '',
        motherName: rec.motherName || '',
        guardianPhone: phone,
        address: rec.address || '',
        monthlyFee: Number(toEnDigits(rec.monthlyFee)) || '',
        pin,
        admissionDate: new Date().toISOString().slice(0, 10),
        absentFine: '',
        status: 'active',
      },
    });
    return undefined;
  });

  return { plan: [...groups.values()], errors, unknownHeaders };
}

/** Firestore ops for a plan: student + this month's fee + ready-to-use portal record per student */
export function buildImportOps(plan, { institution, month, year }) {
  const ops = [];
  const created = [];
  plan.forEach((g) => {
    const classDoc = { ...g.cls, settings: { ...(g.cls.settings || {}), departments: g.departments, sections: g.sections } };
    const settings = buildClassSettings({ classDoc, classId: g.cls.id, institution, month, year });
    setClassLabels(settings); // portal records carry this class's department/section names
    if (g.addedDepts.length || g.addedSections.length) {
      ops.push({ type: 'merge', path: ['classes', g.cls.id], data: { settings: classDoc.settings } });
    }
    g.students.forEach(({ input }) => {
      const student = newStudentRecord(input, g.cls.id, settings);
      const fee = newFeeRow(student, settings);
      const snap = buildPortalSnapshot({
        student,
        fees: [fee],
        examFees: [],
        fines: [],
        payments: [],
        attendance: {},
        settings,
        attStats: { totalClasses: 0, present: 0, absent: 0, late: 0, leave: 0, percentage: 100 },
        totalDue: fee.due,
      });
      const hash = quickHash(JSON.stringify(snap));
      ops.push({ type: 'set', path: ['classes', g.cls.id, 'students', student.id], data: { ...student, portalHash: hash } });
      ops.push({ type: 'set', path: ['classes', g.cls.id, 'fees', fee.id], data: fee });
      ops.push({ type: 'set', path: ['portal', student.portalKey], data: { ...snap, classId: g.cls.id, hash, updatedAt: new Date().toISOString() } });
      created.push({ classCode: g.cls.id, className: g.cls.name, roll: student.roll, name: student.name, pin: student.pin, phone: student.guardianPhone });
    });
  });
  return { ops, created };
}
