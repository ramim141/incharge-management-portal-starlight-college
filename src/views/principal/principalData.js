import { backend } from '../../backend';

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

export const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
};

export const CLASS_PRESETS = ['ষষ্ঠ শ্রেণি', 'সপ্তম শ্রেণি', 'অষ্টম শ্রেণি', 'নবম শ্রেণি', 'দশম শ্রেণি', 'একাদশ শ্রেণি', 'দ্বাদশ শ্রেণি'];
