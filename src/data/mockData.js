// Initial Mock Data for Class XI Management Portal
export const initialSettings = {
  institutionName: "ঢাকা রেসিডেনসিয়াল মডেল কলেজ (একাদশ শ্রেণি)",
  sectionName: "Class XI - Academic Session 2026-2027",
  inchargeName: "প্রফেসর ড. মুহাম্মদ জহিরুল ইসলাম",
  inchargeDesignation: "সহকারী অধ্যাপক ও ক্লাস ইনচার্জ (একাদশ শ্রেণি)",
  inchargePhone: "+8801712345678",
  inchargeEmail: "incharge.xi@college.edu.bd",
  defaultMonthlyFee: 1000,
  defaultFeeDeadlineDay: 10,
  currentMonth: "October",
  currentYear: 2026,
  finePerDay: 50,
  fixedFineAfterDeadline: 100,
  fineType: "fixed", // 'fixed' or 'daily'
  whatsappTemplate: "প্রিয় অভিভাবক,\nআপনার সন্তান {student_name}-এর {month} মাসের বেতন ৳{monthly_fee} এবং সর্বমোট বকেয়া ৳{total_due}।\nবকেয়া পরিশোধের শেষ সময়: {deadline}।\nঅনুগ্রহ করে নির্ধারিত সময়ের মধ্যে কলেজ অফিসে অথবা বিকাশ/নগদে ফি পরিশোধ করার জন্য অনুরোধ করা হলো।\n\nবিকাশ/নগদ (মার্চেন্ট): 01712345678\nবিনীত,\n{incharge_name}\nক্লাস ইনচার্জ, একাদশ শ্রেণি",
};

export const initialStudents = [
  {
    id: "std-101",
    roll: 101,
    studentId: "XI-2026-0101",
    name: "নুসরাত জাহান",
    nameEn: "Nusrat Jahan",
    group: "Science",
    gender: "Female",
    fatherName: "মোজাম্মেল হক",
    motherName: "জাহানারা বেগম",
    guardianPhone: "01611667788",
    address: "বাড়ি ১২, রোড ৫, গুলশান-১, ঢাকা",
    admissionDate: "2026-07-01",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-102",
    roll: 102,
    studentId: "XI-2026-0102",
    name: "করিম চৌধুরী",
    nameEn: "Karim Chowdhury",
    group: "Science",
    gender: "Male",
    fatherName: "কামাল চৌধুরী",
    motherName: "নাজমা বেগম",
    guardianPhone: "01819334455",
    address: "সেকশন ১০, মিরপুর, ঢাকা",
    admissionDate: "2026-07-01",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-103",
    roll: 103,
    studentId: "XI-2026-0103",
    name: "হাসান মাহমুদ",
    nameEn: "Hasan Mahmud",
    group: "Business Studies",
    gender: "Male",
    fatherName: "রফিকুল ইসলাম",
    motherName: "শিরিন আক্তার",
    guardianPhone: "01912445566",
    address: "সেক্টর ৭, উত্তরা, ঢাকা",
    admissionDate: "2026-07-02",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-104",
    roll: 104,
    studentId: "XI-2026-0104",
    name: "সাকিব আল হাসান",
    nameEn: "Sakib Al Hasan",
    group: "Humanities",
    gender: "Male",
    fatherName: "আনিসুর রহমান",
    motherName: "সালমা খাতুন",
    guardianPhone: "01715556677",
    address: "ব্লক সি, মোহাম্মদপুর, ঢাকা",
    admissionDate: "2026-07-02",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-105",
    roll: 105,
    studentId: "XI-2026-0105",
    name: "মো: রহিম আহমেদ",
    nameEn: "Md. Rahim Ahmed",
    group: "Science",
    gender: "Male",
    fatherName: "আব্দুল করিম",
    motherName: "রহিমা বেগম",
    guardianPhone: "01711223344",
    address: "রোড ৮/এ, ধানমন্ডি, ঢাকা",
    admissionDate: "2026-07-01",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-106",
    roll: 106,
    studentId: "XI-2026-0106",
    name: "তানভীর হোসেন",
    nameEn: "Tanvir Hossain",
    group: "Business Studies",
    gender: "Male",
    fatherName: "দেলোয়ার হোসেন",
    motherName: "শাহিদা বেগম",
    guardianPhone: "01817778899",
    address: "রোড ১১, বনানী, ঢাকা",
    admissionDate: "2026-07-03",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-107",
    roll: 107,
    studentId: "XI-2026-0107",
    name: "ফাতিমা আক্তার",
    nameEn: "Fatima Akter",
    group: "Humanities",
    gender: "Female",
    fatherName: "বেলাল আহমেদ",
    motherName: "পারভিন সুলতানা",
    guardianPhone: "01918889900",
    address: "গ্রীন রোড, ফার্মগেট, ঢাকা",
    admissionDate: "2026-07-03",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
  },
  {
    id: "std-108",
    roll: 108,
    studentId: "XI-2026-0108",
    name: "মাহির ফয়সাল",
    nameEn: "Mahir Faisal",
    group: "Science",
    gender: "Male",
    fatherName: "তারিকুল ইসলাম",
    motherName: "ফরিদা ইয়াসমিন",
    guardianPhone: "01719990011",
    address: "লালমাটিয়া, মোহাম্মদপুর, ঢাকা",
    admissionDate: "2026-07-04",
    monthlyFee: 1000,
    pin: "1234",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80"
  }
];

export const initialFees = [
  // Student 105 (Rahim Ahmed) - has past history matching documentation
  {
    id: "fee-105-july",
    studentId: "std-105",
    roll: 105,
    month: "July",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-07-10",
    status: "Paid",
    reason: "",
    note: ""
  },
  {
    id: "fee-105-aug",
    studentId: "std-105",
    roll: 105,
    month: "August",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-08-10",
    status: "Paid",
    reason: "",
    note: ""
  },
  {
    id: "fee-105-sep",
    studentId: "std-105",
    roll: 105,
    month: "September",
    year: 2026,
    amount: 1000,
    paid: 500,
    due: 500,
    fine: 100,
    deadline: "2026-09-10",
    status: "Partial",
    reason: "Financial problem",
    note: "বাকি ৫০০ টাকা অক্টোবরের সাথে দেবে"
  },
  {
    id: "fee-105-oct",
    studentId: "std-105",
    roll: 105,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 0,
    due: 1000,
    fine: 0,
    deadline: "2026-10-10",
    status: "Due",
    reason: "অভিভাবক বাইরে",
    note: "অভিভাবক আগামী সপ্তাহে ঢাকা ফিরে বেতন পরিশোধ করবেন"
  },

  // Student 101 (Nusrat Jahan) - All Paid
  {
    id: "fee-101-july",
    studentId: "std-101",
    roll: 101,
    month: "July",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-07-10",
    status: "Paid"
  },
  {
    id: "fee-101-aug",
    studentId: "std-101",
    roll: 101,
    month: "August",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-08-10",
    status: "Paid"
  },
  {
    id: "fee-101-sep",
    studentId: "std-101",
    roll: 101,
    month: "September",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-09-10",
    status: "Paid"
  },
  {
    id: "fee-101-oct",
    studentId: "std-101",
    roll: 101,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-10-10",
    status: "Paid"
  },

  // Student 102 (Karim) - Due with reason
  {
    id: "fee-102-oct",
    studentId: "std-102",
    roll: 102,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 0,
    due: 1000,
    fine: 100,
    deadline: "2026-10-10",
    status: "Overdue",
    reason: "Financial problem",
    note: "১৫ তারিখের মধ্যে বেতন দেওয়ার প্রতিশ্রুতি দিয়েছেন"
  },

  // Student 103 (Hasan) - Paid
  {
    id: "fee-103-oct",
    studentId: "std-103",
    roll: 103,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 1000,
    due: 0,
    fine: 0,
    deadline: "2026-10-10",
    status: "Paid"
  },

  // Student 104 (Sakib) - Overdue
  {
    id: "fee-104-oct",
    studentId: "std-104",
    roll: 104,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 0,
    due: 1000,
    fine: 100,
    deadline: "2026-10-10",
    status: "Overdue",
    reason: "পরে দেবে",
    note: "সামনের রবিবার বেতন পরিশোধ করবে"
  },

  // Student 107 (Fatima) - Overdue
  {
    id: "fee-107-oct",
    studentId: "std-107",
    roll: 107,
    month: "October",
    year: 2026,
    amount: 1000,
    paid: 0,
    due: 1000,
    fine: 100,
    deadline: "2026-10-10",
    status: "Overdue",
    reason: "অসুস্থ",
    note: "মেডিকেল ট্রিটমেন্টের কারণে সাময়িক বিলম্ব"
  }
];

export const initialExamFees = [
  {
    id: "exam-105-half",
    studentId: "std-105",
    roll: 105,
    examName: "Half Yearly Examination 2026",
    amount: 500,
    paid: 500,
    due: 0,
    status: "Paid",
    paymentDate: "2026-09-05"
  },
  {
    id: "exam-105-annual",
    studentId: "std-105",
    roll: 105,
    examName: "Annual Examination 2026",
    amount: 700,
    paid: 0,
    due: 700,
    status: "Due",
    paymentDate: null
  },
  {
    id: "exam-101-half",
    studentId: "std-101",
    roll: 101,
    examName: "Half Yearly Examination 2026",
    amount: 500,
    paid: 500,
    due: 0,
    status: "Paid",
    paymentDate: "2026-09-02"
  },
  {
    id: "exam-102-half",
    studentId: "std-102",
    roll: 102,
    examName: "Half Yearly Examination 2026",
    amount: 500,
    paid: 0,
    due: 500,
    status: "Due",
    paymentDate: null
  }
];

export const initialFines = [
  {
    id: "fine-105-1",
    studentId: "std-105",
    roll: 105,
    amount: 100,
    reason: "সেপ্টেম্বর বেতন বিলম্ব ফি",
    date: "2026-09-11",
    status: "Active"
  },
  {
    id: "fine-102-1",
    studentId: "std-102",
    roll: 102,
    amount: 100,
    reason: "অক্টোবর বেতন বিলম্ব জরিমানা",
    date: "2026-10-11",
    status: "Active"
  },
  {
    id: "fine-104-1",
    studentId: "std-104",
    roll: 104,
    amount: 100,
    reason: "দেরিতে উপস্থিত হওয়ার জরিমানা",
    date: "2026-10-02",
    status: "Waived"
  }
];

export const initialPayments = [
  {
    id: "pay-101",
    receiptNo: "INV-2026-00101",
    studentId: "std-101",
    roll: 101,
    studentName: "নুসরাত জাহান",
    amount: 1500,
    items: [
      { description: "অক্টোবর ২০২৬ মাসিক বেতন", amount: 1000 },
      { description: "অর্ধবার্ষিক পরীক্ষার ফি", amount: 500 }
    ],
    method: "bKash",
    trxId: "BK982348234",
    paymentDate: "2026-10-02T10:15:00",
    inchargeName: "প্রফেসর ড. মুহাম্মদ জহিরুল ইসলাম"
  },
  {
    id: "pay-105",
    receiptNo: "INV-2026-00105",
    studentId: "std-105",
    roll: 105,
    studentName: "মো: রহিম আহমেদ",
    amount: 1500,
    items: [
      { description: "আগস্ট ২০২৬ মাসিক বেতন", amount: 1000 },
      { description: "অর্ধবার্ষিক পরীক্ষার ফি", amount: 500 }
    ],
    method: "Cash",
    trxId: "",
    paymentDate: "2026-09-05T11:30:00",
    inchargeName: "প্রফেসর ড. মুহাম্মদ জহিরুল ইসলাম"
  },
  {
    id: "pay-103",
    receiptNo: "INV-2026-00103",
    studentId: "std-103",
    roll: 103,
    studentName: "হাসান মাহমুদ",
    amount: 1000,
    items: [
      { description: "অক্টোবর ২০২৬ মাসিক বেতন", amount: 1000 }
    ],
    method: "Nagad",
    trxId: "NG77218392",
    paymentDate: "2026-10-04T14:20:00",
    inchargeName: "প্রফেসর ড. মুহাম্মদ জহিরুল ইসলাম"
  }
];

export const initialAttendance = {
  "2026-10-05": {
    "std-101": "Present",
    "std-102": "Present",
    "std-103": "Absent",
    "std-104": "Present",
    "std-105": "Late",
    "std-106": "Present",
    "std-107": "Leave",
    "std-108": "Present"
  },
  "2026-10-04": {
    "std-101": "Present",
    "std-102": "Present",
    "std-103": "Present",
    "std-104": "Present",
    "std-105": "Present",
    "std-106": "Present",
    "std-107": "Absent",
    "std-108": "Present"
  },
  "2026-10-03": {
    "std-101": "Present",
    "std-102": "Absent",
    "std-103": "Present",
    "std-104": "Present",
    "std-105": "Present",
    "std-106": "Present",
    "std-107": "Present",
    "std-108": "Present"
  }
};
