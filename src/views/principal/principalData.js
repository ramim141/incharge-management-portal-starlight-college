import { backend } from '../../backend';
import { studentIdFor } from '../../lib/classLogic';
import { portalKey } from '../../lib/hash';
import { STAFF_DOMAIN, loginIdPath, generateStaffPassword } from '../../lib/staffLogin';

// Ops that keep class.inchargeUid and user.classId pointing at each other
// ("one teacher = one class"): assigning someone clears their old class and the class's old teacher.
export function assignOps({ classes, users, classCode, uid }) {
  const ops = [];
  const cls = classCode ? classes.find((c) => c.id === classCode) : null;
  const teacher = uid ? users.find((u) => u.id === uid) : null;
  const blank = { inchargeUid: null, inchargeName: '', inchargePhone: '', inchargeEmail: '', inchargeDesignation: '' };

  if (teacher?.classId && teacher.classId !== classCode) ops.push({ type: 'merge', path: ['classes', teacher.classId], data: blank });
  if (cls?.inchargeUid && cls.inchargeUid !== uid) ops.push({ type: 'merge', path: ['users', cls.inchargeUid], data: { classId: null } });

  if (cls) {
    ops.push({
      type: 'merge',
      path: ['classes', cls.id],
      data: teacher
        ? {
            inchargeUid: teacher.id,
            inchargeName: teacher.name || '',
            inchargePhone: teacher.phone || '',
            inchargeEmail: teacher.email || '',
            inchargeDesignation: teacher.designation || '',
          }
        : blank,
    });
  }
  if (teacher) ops.push({ type: 'merge', path: ['users', teacher.id], data: { classId: cls ? cls.id : null } });
  return ops;
}

/** Deletes a class with all its data and its students' portal records */
export async function deleteClassDeep({ classes, users, classCode }) {
  const colls = ['students', 'fees', 'examFees', 'fines', 'payments', 'attendance'];
  const ops = [];
  for (const c of colls) {
    const docs = await backend.getCollection(['classes', classCode, c]);
    docs.forEach((d) => {
      ops.push({ type: 'delete', path: ['classes', classCode, c, d.id] });
      if (c === 'students' && d.portalKey) ops.push({ type: 'delete', path: ['portal', d.portalKey] });
    });
  }
  const cls = classes.find((c) => c.id === classCode);
  if (cls?.inchargeUid && users.some((u) => u.id === cls.inchargeUid)) {
    ops.push({ type: 'merge', path: ['users', cls.inchargeUid], data: { classId: null } });
  }
  ops.push({ type: 'delete', path: ['classes', classCode] });
  await backend.write(ops, { wait: true });
}

/**
 * Gives a teacher a new password while keeping their login ID (e.g. T001). The free Firebase plan
 * can't change someone else's password, so a fresh login is created, the ID is pointed at it and
 * the profile + class duty move over; the old login is left with no profile, so it can't be used.
 */
export async function reissueTeacherLogin(t) {
  const password = generateStaffPassword();
  const email = `${t.loginId.toLowerCase()}-${Date.now().toString(36)}@${STAFF_DOMAIN}`;
  const uid = await backend.createAccount(email, password, { secondary: true });
  const { id: oldUid, uid: _u, ...profile } = t;
  const ops = [
    { type: 'set', path: ['users', uid], data: { ...profile, email, pendingEmail: null, mustChangePassword: true, reissuedAt: new Date().toISOString() } },
    { type: 'set', path: loginIdPath(t.loginId), data: { email, uid } },
  ];
  if (t.classId) ops.push({ type: 'merge', path: ['classes', t.classId], data: { inchargeUid: uid } });
  await backend.write(ops, { wait: true });
  await backend.write([{ type: 'delete', path: ['users', oldUid] }], { wait: true });
  return { ...profile, id: uid, email, password };
}

/** Removes a teacher: class duty, profile and login ID (the class's data stays) */
export async function deleteTeacher({ t, classes, users }) {
  const ops = t.classId ? assignOps({ classes, users, classCode: null, uid: t.id }).filter((op) => op.path[0] !== 'users') : [];
  ops.push({ type: 'delete', path: ['users', t.id] });
  if (t.loginId) {
    const entry = await backend.getDoc(loginIdPath(t.loginId));
    if (!entry || entry.uid === t.id) ops.push({ type: 'delete', path: loginIdPath(t.loginId) });
  }
  await backend.write(ops, { wait: true });
}

const CLASS_COLLECTIONS =['students', 'fees', 'examFees', 'fines', 'payments', 'attendance'];

/**
 * Changes a class's code. The code is the class's document id and part of every Student ID, so
 * all class data is copied to the new code, Student IDs and portal records are re-keyed, the
 * in-charge is pointed at the new code, and only then is the old copy deleted (a failure
 * half-way leaves the old class intact). Old receipt numbers keep the old code on purpose.
 */
export async function renameClassCode({ classes, users, oldCode, newCode }) {
  const cls = classes.find((c) => c.id === oldCode);
  if (!cls) throw new Error('ক্লাস পাওয়া যায়নি');
  const { id: _old, ...classData } = cls;

  const docs = {};
  for (const c of CLASS_COLLECTIONS) docs[c] = await backend.getCollection(['classes', oldCode, c]);

  const sets = [{ type: 'set', path: ['classes', newCode], data: { ...classData, code: newCode } }];
  const deletes = [];

  CLASS_COLLECTIONS.forEach((c) => {
    docs[c].forEach(({ id, ...data }) => {
      let next = data;
      if (c === 'students') {
        const studentId = studentIdFor(newCode, data.roll);
        next = { ...data, studentId, portalKey: portalKey(studentId, data.pin || ''), portalHash: null };
      }
      sets.push({ type: 'set', path: ['classes', newCode, c, id], data: next });
      deletes.push({ type: 'delete', path: ['classes', oldCode, c, id] });
    });
  });

  // Move each student's portal record to its new key so they can log in straight away
  for (const s of docs.students) {
    if (!s.portalKey) continue;
    const old = await backend.getDoc(['portal', s.portalKey]);
    const studentId = studentIdFor(newCode, s.roll);
    const key = portalKey(studentId, s.pin || '');
    if (old) {
      const { id: _k, ...snap } = old;
      sets.push({
        type: 'set',
        path: ['portal', key],
        data: { ...snap, classId: newCode, student: { ...snap.student, studentId }, cls: { ...(snap.cls || {}), code: newCode } },
      });
    }
    if (key !== s.portalKey) deletes.push({ type: 'delete', path: ['portal', s.portalKey] });
  }

  users.filter((u) => u.classId === oldCode).forEach((u) => sets.push({ type: 'merge', path: ['users', u.id], data: { classId: newCode } }));
  deletes.push({ type: 'delete', path: ['classes', oldCode] });

  await backend.write(sets, { wait: true });
  await backend.write(deletes, { wait: true });
  return docs.students.length;
}

export const CLASS_PRESETS = ['ষষ্ঠ শ্রেণি', 'সপ্তম শ্রেণি', 'অষ্টম শ্রেণি', 'নবম শ্রেণি', 'দশম শ্রেণি', 'একাদশ শ্রেণি', 'দ্বাদশ শ্রেণি'];

export const SECTION_PRESETS = ['বিজ্ঞান', 'মানবিক', 'ব্যবসায় শিক্ষা', 'ক', 'খ', 'A', 'B'];

export const CLASS_CODE_MAP = {
  'ষষ্ঠ শ্রেণি': 'VI',
  'সপ্তম শ্রেণি': 'VII',
  'অষ্টম শ্রেণি': 'VIII',
  'নবম শ্রেণি': 'IX',
  'দশম শ্রেণি': 'X',
  'একাদশ শ্রেণি': 'XI',
  'দ্বাদশ শ্রেণি': 'XII',
};

export const SECTION_CODE_MAP = {
  'বিজ্ঞান': 'SCI',
  'মানবিক': 'HUM',
  'ব্যবসায় শিক্ষা': 'COM',
  'ক': 'A',
  'খ': 'B',
  'গ': 'C',
  'A': 'A',
  'B': 'B',
  'C': 'C',
};

export function suggestClassCode(name, section, session) {
  const prefix = CLASS_CODE_MAP[name] || '';
  const sec = SECTION_CODE_MAP[section] || (section ? section.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) : '');
  const yearMatch = String(session || '').match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

  if (prefix && sec) return `${prefix}-${sec}`;
  if (prefix) return `${prefix}-${year}`;
  return '';
}
