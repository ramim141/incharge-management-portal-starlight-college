export const QUERY_SUBJECTS = [
  'বেতন ও ফি সংক্রান্ত',
  'হাজিরা সংক্রান্ত',
  'পরীক্ষা ও প্রবেশপত্র',
  'নাম বা তথ্য সংশোধন',
  'অন্যান্য জিজ্ঞাসা',
];

export const QUERY_STATUS = {
  pending: { bn: 'অপেক্ষায়', tone: 'amber' },
  replied: { bn: 'উত্তর দেওয়া হয়েছে', tone: 'green' },
};

/** Validates chat message input */
export function validateQuery({ message }) {
  const errors = [];
  const m = String(message || '').trim();
  if (!m) errors.push('একটি মেসেজ লিখুন');
  else if (m.length > 600) errors.push('বার্তা ৬০০ অক্ষরের মধ্যে লিখুন');
  return errors;
}

/** Prepares a new message/query object for submission */
export function newQuery({ id, classId, student, portalKey, subject = 'মেসেজ', message, sender = 'student', senderName = '', now = new Date() }) {
  const cleanMsg = String(message || '').trim();
  return {
    id,
    classId,
    studentId: student.id || student.studentId,
    roll: Number(student.roll),
    studentName: student.name,
    portalKey,
    subject: String(subject || 'মেসেজ').trim(),
    message: cleanMsg,
    text: cleanMsg,
    sender,
    senderName: senderName || student.name,
    status: sender === 'teacher' ? 'replied' : 'pending',
    createdAt: now.toISOString(),
    reply: sender === 'teacher' ? cleanMsg : '',
    repliedAt: sender === 'teacher' ? now.toISOString() : null,
    repliedBy: sender === 'teacher' ? (senderName || 'ইনচার্জ') : '',
  };
}

/** Formats query/message list for student portal */
export const queriesForPortal = (all = [], studentId) =>
  all
    .filter((q) => q.studentId === studentId || (studentId && q.studentId === String(studentId)))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((q) => ({
      id: q.id,
      subject: q.subject || '',
      message: q.message || q.text || '',
      text: q.text || q.message || '',
      sender: q.sender || (q.reply && !q.message ? 'teacher' : 'student'),
      senderName: q.senderName || '',
      status: q.status,
      reply: q.reply || '',
      repliedAt: q.repliedAt || null,
      repliedBy: q.repliedBy || '',
      createdAt: q.createdAt,
    }));

/** Converts all queries and replies into a linear real-time chat timeline */
export function toChatMessages(list = []) {
  const messages = [];
  const seenTeacherMessages = new Set();
  const seenStudentMessages = new Set();
  const seenIds = new Set();

  list.forEach((item) => {
    // 1. Explicit teacher message
    if (item.sender === 'teacher') {
      const txt = (item.text || item.message || item.reply || '').trim();
      if (!txt) return;
      const key = `${txt}-${String(item.createdAt).slice(0, 16)}`;
      if (seenTeacherMessages.has(key)) return;
      seenTeacherMessages.add(key);

      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        messages.push({
          id: item.id,
          sender: 'teacher',
          senderName: item.senderName || item.repliedBy || 'ইনচার্জ',
          text: txt,
          createdAt: item.createdAt,
          status: 'delivered',
          queryId: item.id,
        });
      }
      return;
    }

    // 2. Student question/message
    const studentTxt = (item.text || item.message || '').trim();
    if (studentTxt) {
      const key = `${studentTxt}-${String(item.createdAt).slice(0, 16)}`;
      if (!seenStudentMessages.has(key)) {
        seenStudentMessages.add(key);
        const studentMsgId = item.id ? `${item.id}-msg` : item.id;
        if (!seenIds.has(studentMsgId)) {
          seenIds.add(studentMsgId);
          messages.push({
            id: studentMsgId,
            sender: 'student',
            senderName: item.studentName || 'শিক্ষার্থী',
            text: studentTxt,
            createdAt: item.createdAt,
            subject: item.subject,
            status: item.status === 'replied' ? 'seen' : 'sent',
            queryId: item.id,
          });
        }
      }
    }

    // 3. Attached teacher reply (if stored in the same document)
    const replyTxt = (item.reply || '').trim();
    if (replyTxt && item.sender !== 'teacher') {
      const key = `${replyTxt}-${String(item.repliedAt || item.createdAt).slice(0, 16)}`;
      if (!seenTeacherMessages.has(key)) {
        seenTeacherMessages.add(key);
        const replyId = `${item.id}-reply`;
        if (!seenIds.has(replyId)) {
          seenIds.add(replyId);
          messages.push({
            id: replyId,
            sender: 'teacher',
            senderName: item.repliedBy || 'ইনচার্জ',
            text: replyTxt,
            createdAt: item.repliedAt || item.createdAt,
            status: 'delivered',
            queryId: item.id,
          });
        }
      }
    }
  });

  return messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
