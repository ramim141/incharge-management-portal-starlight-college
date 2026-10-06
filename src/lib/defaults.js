// Starting rules for a newly created class. Each in-charge changes these in Settings.
export const DEFAULT_WHATSAPP_TEMPLATE = [
  'প্রিয় অভিভাবক,',
  'আপনার সন্তান {student_name}-এর {month} মাসের বেতন ৳{monthly_fee} এবং সর্বমোট বকেয়া ৳{total_due}।',
  'বকেয়া পরিশোধের শেষ সময়: {deadline}।',
  'অনুগ্রহ করে নির্ধারিত সময়ের মধ্যে কলেজ অফিসে অথবা বিকাশ/নগদে ফি পরিশোধ করার জন্য অনুরোধ করা হলো।',
  '',
  'বিনীত,',
  '{incharge_name} ({incharge_phone})',
  'ক্লাস ইনচার্জ, {class_name}',
].join('\n');

export const DEFAULT_CLASS_SETTINGS = {
  defaultMonthlyFee: 1000,
  defaultFeeDeadlineDay: 10,
  fixedFineAfterDeadline: 100,
  finePerDay: 50,
  fineType: 'fixed',
  absentFine: 100,
  // The in-charge's own groupings — edited in Settings → বিভাগ ও শাখা
  departments: [
    { id: 'Science', bn: 'বিজ্ঞান' },
    { id: 'Business Studies', bn: 'ব্যবসায় শিক্ষা' },
    { id: 'Humanities', bn: 'মানবিক' },
  ],
  sections: [],
  useGender: true,
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
};
