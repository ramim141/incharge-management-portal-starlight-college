import {
  initialStudents, initialFees, initialExamFees, initialFines, initialPayments, initialAttendance, initialSettings,
} from '../data/mockData';

const DEMO_PASSWORD = 'admin123';

export const DEMO_ACCOUNTS = [
  { email: 'principal@demo.edu', label: 'অধ্যক্ষ (প্রধান Admin)' },
  { email: 'incharge.xi@college.edu.bd', label: 'একাদশ শ্রেণির ইনচার্জ' },
  { email: 'incharge.xii@demo.edu', label: 'দ্বাদশ শ্রেণির ইনচার্জ' },
];
export { DEMO_PASSWORD };

export const DEFAULT_CLASS_SETTINGS = {
  defaultMonthlyFee: 1000,
  defaultFeeDeadlineDay: 10,
  fixedFineAfterDeadline: 100,
  finePerDay: 50,
  fineType: 'fixed',
  whatsappTemplate: initialSettings.whatsappTemplate.replace('ক্লাস ইনচার্জ, একাদশ শ্রেণি', 'ক্লাস ইনচার্জ, {class_name}'),
};

const readOld = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

/** Builds the demo database. Data from the old single-class version becomes the XI class. */
export function buildDemoDocs() {
  const docs = {};
  const put = (path, data) => {
    docs[path] = data;
  };

  put('meta/institution', { name: 'ঢাকা রেসিডেনসিয়াল মডেল কলেজ', address: 'মোহাম্মদপুর, ঢাকা' });
  put('meta/owner', { uid: 'u-principal' });

  const users = [
    { id: 'u-principal', role: 'superadmin', name: 'অধ্যক্ষ মো: আব্দুল হালিম', email: 'principal@demo.edu', phone: '01700000000', designation: 'অধ্যক্ষ', classId: null },
    { id: 'u-xi', role: 'incharge', name: initialSettings.inchargeName, email: 'incharge.xi@college.edu.bd', phone: '01712345678', designation: 'সহকারী অধ্যাপক', classId: 'XI-2026' },
    { id: 'u-xii', role: 'incharge', name: 'নাসরিন সুলতানা', email: 'incharge.xii@demo.edu', phone: '01811000000', designation: 'প্রভাষক', classId: 'XII-2026' },
    { id: 'u-tanzila', role: 'incharge', name: 'তানজিলা রহমান', email: 'tanzila@demo.edu', phone: '01911000000', designation: 'প্রভাষক', classId: null },
  ];
  users.forEach(({ id, ...u }) => put(`users/${id}`, { ...u, active: true }));

  const classDoc = (code, name, section, inc) => ({
    code,
    name,
    section,
    session: '2026-27',
    inchargeUid: inc.id,
    inchargeName: inc.name,
    inchargePhone: inc.phone,
    inchargeEmail: inc.email,
    inchargeDesignation: inc.designation,
    settings: { ...DEFAULT_CLASS_SETTINGS },
    createdAt: '2026-07-01T00:00:00.000Z',
  });

  // XI — the original demo data (or whatever the teacher entered in the old version)
  const xi = 'XI-2026';
  const oldSettings = readOld('xi_settings_data', null);
  const xiDoc = classDoc(xi, 'একাদশ শ্রেণি', 'বিজ্ঞান, ব্যবসায় ও মানবিক', users[1]);
  if (oldSettings) {
    ['defaultMonthlyFee', 'defaultFeeDeadlineDay', 'fixedFineAfterDeadline', 'whatsappTemplate'].forEach((k) => {
      if (oldSettings[k] != null) xiDoc.settings[k] = oldSettings[k];
    });
  }
  put(`classes/${xi}`, xiDoc);
  const add = (cls, coll, list) => list.forEach((d) => put(`classes/${cls}/${coll}/${d.id}`, d));
  add(xi, 'students', readOld('xi_students_data', initialStudents).map((s) => ({ ...s, studentId: `${xi}-${String(s.roll).padStart(4, '0')}` })));
  add(xi, 'fees', readOld('xi_fees_data', initialFees));
  add(xi, 'examFees', readOld('xi_exam_fees_data', initialExamFees));
  add(xi, 'fines', readOld('xi_fines_data', initialFines));
  add(xi, 'payments', readOld('xi_payments_data', initialPayments).map((p) => ({ ...p, receiptNo: p.receiptNo.replace('INV-2026', `INV-${xi}`) })));
  Object.entries(readOld('xi_attendance_data', initialAttendance)).forEach(([date, records]) => put(`classes/${xi}/attendance/${date}`, { date, records }));

  // XII — a small second class so the principal view has something to compare
  const xii = 'XII-2026';
  put(`classes/${xii}`, classDoc(xii, 'দ্বাদশ শ্রেণি', 'বিজ্ঞান', users[2]));
  const xiiStudents = [
    ['আরিফ হোসেন', 'Arif Hossain', 'Male', '01711000101'],
    ['সুমাইয়া ইসলাম', 'Sumaiya Islam', 'Female', '01711000102'],
    ['রাকিবুল হাসান', 'Rakibul Hasan', 'Male', '01711000103'],
    ['জান্নাতুল ফেরদৌস', 'Jannatul Ferdous', 'Female', '01711000104'],
    ['ইমরান খান', 'Imran Khan', 'Male', '01711000105'],
  ].map(([name, nameEn, gender, phone], i) => ({
    id: `std-xii-${i + 1}`,
    roll: 101 + i,
    studentId: `${xii}-${String(101 + i).padStart(4, '0')}`,
    name,
    nameEn,
    gender,
    group: 'Science',
    fatherName: '',
    motherName: '',
    guardianPhone: phone,
    address: 'ঢাকা',
    admissionDate: '2025-07-01',
    monthlyFee: 1200,
    pin: '1234',
    status: 'active',
    avatar: '',
  }));
  add(xii, 'students', xiiStudents);
  add(
    xii,
    'fees',
    xiiStudents.map((s, i) => {
      const paid = i < 3 ? 1200 : 0;
      return {
        id: `fee-${s.id}-2026-October`,
        studentId: s.id,
        roll: s.roll,
        month: 'October',
        year: 2026,
        amount: 1200,
        paid,
        due: 1200 - paid,
        fine: 0,
        deadline: '2026-10-10',
        status: paid ? 'Paid' : 'Due',
        reason: '',
        note: '',
      };
    }),
  );
  add(
    xii,
    'payments',
    xiiStudents.slice(0, 3).map((s, i) => ({
      id: `pay-xii-${i + 1}`,
      receiptNo: `INV-${xii}-${String(101 + i).padStart(5, '0')}`,
      studentId: s.id,
      roll: s.roll,
      studentName: s.name,
      amount: 1200,
      items: [{ description: 'October 2026 Monthly Fee', amount: 1200 }],
      method: i === 1 ? 'bKash' : 'Cash',
      trxId: '',
      paymentDate: `2026-10-0${3 + i}T10:00:00`,
      inchargeName: users[2].name,
    })),
  );
  put(`classes/${xii}/attendance/2026-10-05`, {
    date: '2026-10-05',
    records: Object.fromEntries(xiiStudents.map((s, i) => [s.id, i === 4 ? 'Absent' : 'Present'])),
  });

  const accounts = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), { uid: u.id, password: DEMO_PASSWORD }]));
  return { docs, accounts };
}
