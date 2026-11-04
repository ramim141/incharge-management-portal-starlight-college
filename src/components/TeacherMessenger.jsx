import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Send, ArrowLeft, Search, Phone, CheckCheck, Clock, ThumbsUp, SquarePen, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Avatar, cx } from './ui';
import { MessengerIcon } from './PortalExtras';
import { WhatsAppIcon } from './ReceiptSheet';
import { fmtTime, waLink } from '../lib/format';
import { toChatMessages } from '../lib/query';

export function TeacherFloatingMessenger() {
  const { queries = [], students = [], sendChatMessage, settings, profile } = useApp();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef(null);

  const pendingCount = useMemo(
    () => queries.filter((q) => q.status === 'pending').length,
    [queries],
  );

  // Allow external triggers (e.g. from Dashboard TodoCard or Alert cards)
  useEffect(() => {
    const handleOpen = (e) => {
      setOpen(true);
      if (e?.detail?.studentId) {
        setSelectedStudentId(String(e.detail.studentId));
      }
    };
    window.addEventListener('open_teacher_messenger', handleOpen);
    return () => window.removeEventListener('open_teacher_messenger', handleOpen);
  }, []);

  // Group queries into student conversations
  const threads = useMemo(() => {
    const map = new Map();
    queries.forEach((q) => {
      const sid = String(q.studentId || q.student?.id || q.roll || 'unknown');
      if (!map.has(sid)) {
        const studentObj = students.find(
          (s) => String(s.id) === sid || String(s.studentId) === sid || Number(s.roll) === Number(q.roll),
        );
        map.set(sid, {
          studentId: sid,
          studentName: q.studentName || studentObj?.name || 'শিক্ষার্থী',
          roll: q.roll != null ? q.roll : studentObj?.roll,
          student: studentObj,
          queries: [],
          pendingCount: 0,
          latestAt: q.createdAt,
          latestMessage: q.text || q.message || q.reply || '',
          latestSender: q.sender || (q.reply ? 'teacher' : 'student'),
        });
      }
      const thread = map.get(sid);
      thread.queries.push(q);
      if (q.status === 'pending') thread.pendingCount += 1;
      if (String(q.createdAt) >= String(thread.latestAt)) {
        thread.latestAt = q.createdAt;
        thread.latestMessage = q.text || q.message || q.reply || '';
        thread.latestSender = q.sender || (q.reply ? 'teacher' : 'student');
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
      if (b.pendingCount > 0 && a.pendingCount === 0) return 1;
      return String(b.latestAt).localeCompare(String(a.latestAt));
    });
  }, [queries, students]);

  // Filtered threads for inbox search
  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const nameMatch = String(t.studentName || '').toLowerCase().includes(q);
      const rollMatch = String(t.roll || '').includes(q);
      return nameMatch || rollMatch;
    });
  }, [threads, search]);

  const activeThread = useMemo(() => {
    if (!selectedStudentId) return null;
    const found = threads.find((t) => String(t.studentId) === String(selectedStudentId));
    if (found) return found;

    // If starting a new conversation with a student who hasn't messaged yet
    const stu = students.find((s) => String(s.id) === String(selectedStudentId) || String(s.studentId) === String(selectedStudentId));
    if (stu) {
      return {
        studentId: String(stu.id),
        studentName: stu.name,
        roll: stu.roll,
        student: stu,
        queries: [],
        pendingCount: 0,
        latestAt: new Date().toISOString(),
        latestMessage: '',
      };
    }
    return null;
  }, [threads, selectedStudentId, students]);

  // Unified linear chat stream
  const activeChatMessages = useMemo(() => {
    if (!activeThread) return [];
    return toChatMessages(activeThread.queries);
  }, [activeThread]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (activeThread) {
      setTimeout(() => scrollToBottom('smooth'), 60);
    }
  }, [activeThread, activeChatMessages.length]);

  const handleSend = async (textOverride = null) => {
    const textToSend = String(textOverride != null ? textOverride : replyText).trim();
    if (!textToSend || !activeThread || busy) return;

    setBusy(true);
    try {
      if (textOverride == null) setReplyText('');
      await sendChatMessage({
        studentId: activeThread.studentId,
        roll: activeThread.roll,
        studentName: activeThread.studentName,
        portalKey: activeThread.student?.portalKey || '',
        text: textToSend,
      });
      setTimeout(() => scrollToBottom('smooth'), 60);
    } catch (err) {
      toast(err?.message || 'মেসেজ পাঠাতে ব্যর্থ হয়েছে', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Prevent background scroll when modal is open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      {/* Floating Messenger Action Bubble */}
      <aside
        aria-label="শিক্ষার্থী মেসেঞ্জার"
        className="no-print fixed bottom-24 right-4 z-40 flex flex-col items-end sm:bottom-24 sm:right-6 md:right-8"
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#006AFF] via-[#0084FF] to-[#00C6FF] text-white shadow-xl shadow-blue-500/35 transition-all duration-200 hover:scale-105 active:scale-95"
          title="মেসেঞ্জার"
        >
          <MessengerIcon className="h-7 w-7 transition-transform group-hover:scale-110" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-extrabold text-white shadow-md ring-2 ring-white animate-bounce">
              {pendingCount}
            </span>
          )}
        </button>
      </aside>

      {/* Messenger Modal Container */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[650px] sm:max-h-[90vh] sm:rounded-3xl">
            {activeThread ? (
              /* ================== SCREEN 2: NATIVE MESSENGER CHAT ================== */
              <div className="flex flex-1 min-h-0 flex-col bg-[#F0F2F5]">
                {/* Chat App Bar */}
                <header
                  className="shrink-0 flex items-center justify-between border-b border-slate-200/60 bg-white px-3 pb-2.5 pt-3 shadow-xs"
                  style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(null)}
                      className="press -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                      title="চ্যাট তালিকায় ফিরুন"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="relative">
                      <Avatar
                        name={activeThread.studentName}
                        seed={activeThread.studentId}
                        size={38}
                        className="ring-2 ring-blue-100"
                      />
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900">
                        {activeThread.studentName}
                      </p>
                      <p className="truncate text-[11.5px] font-medium text-slate-500">
                        {activeThread.roll != null ? `রোল: ${activeThread.roll}` : ''}
                        {settings?.className ? ` · ${settings.className}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Quick Call & WhatsApp Buttons */}
                    {(() => {
                      const phone = activeThread.student?.guardianPhone || activeThread.student?.studentPhone;
                      return (
                        phone && (
                          <>
                            <a
                              href={`tel:${phone}`}
                              title="কল করুন"
                              className="press flex h-9 w-9 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                            <a
                              href={waLink(phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp"
                              className="press flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50"
                            >
                              <WhatsAppIcon className="h-4 w-4" />
                            </a>
                          </>
                        )
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="press flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                      title="বন্ধ করুন"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </header>

                {/* Message Stream */}
                <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-2 bg-[#F0F2F5] overscroll-contain">
                  {activeChatMessages.length === 0 ? (
                    <div className="my-auto py-8 text-center">
                      <Avatar
                        name={activeThread.studentName}
                        seed={activeThread.studentId}
                        size={64}
                        className="mx-auto mb-2.5 ring-4 ring-blue-100 shadow-sm"
                      />
                      <p className="text-[16px] font-extrabold text-slate-900">{activeThread.studentName}</p>
                      <p className="text-[12px] text-slate-500">
                        {activeThread.roll != null ? `রোল: ${activeThread.roll}` : ''}
                      </p>
                      <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-slate-400">
                        এই শিক্ষার্থীর সাথে এখনো কোনো মেসেজ আদান-প্রদান হয়নি। নিচে যেকোনো বার্তা লিখে চ্যাট শুরু করুন।
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="my-1.5 flex justify-center">
                        <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-semibold text-slate-500 shadow-xs border border-slate-200/60">
                          কথোপকথন
                        </span>
                      </div>

                      {activeChatMessages.map((msg) => {
                        const isTeacher = msg.sender === 'teacher';
                        const isThumb = msg.text === '👍';

                        return (
                          <div key={msg.id} className={cx('flex flex-col', isTeacher ? 'items-end' : 'items-start')}>
                            {isThumb ? (
                              <div className="my-1 px-1">
                                <span className="text-[34px] leading-none select-none animate-in zoom-in-50 duration-150">
                                  👍
                                </span>
                                <p className={cx('mt-0.5 text-[10px] text-slate-400', isTeacher ? 'text-right' : 'text-left')}>
                                  {fmtTime(msg.createdAt)}
                                </p>
                              </div>
                            ) : isTeacher ? (
                              /* Outgoing Bubble (Teacher - Messenger Blue) */
                              <div className="group relative max-w-[80%] rounded-[18px] rounded-br-[4px] bg-[#0084FF] px-3.5 py-2 text-[14px] leading-relaxed text-white shadow-xs">
                                <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-blue-100/90">
                                  <span>{fmtTime(msg.createdAt)}</span>
                                  <CheckCheck className="h-3 w-3 text-cyan-200" title="ডেলিভার্ড" />
                                </div>
                              </div>
                            ) : (
                              /* Incoming Bubble (Student - Messenger Gray) */
                              <div className="flex items-end gap-1.5 max-w-[85%]">
                                <Avatar
                                  name={activeThread.studentName}
                                  seed={activeThread.studentId}
                                  size={26}
                                  className="ring-1 ring-slate-200 shrink-0"
                                />
                                <div className="rounded-[18px] rounded-bl-[4px] bg-[#E4E6EB] px-3.5 py-2 text-[14px] leading-relaxed text-slate-900 shadow-xs">
                                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                                  <p className="mt-0.5 text-right text-[10px] text-slate-500">
                                    {fmtTime(msg.createdAt)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Messenger Input Footer */}
                <footer
                  className="shrink-0 border-t border-slate-200/80 bg-white px-3 pt-2 shadow-lg"
                  style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
                >
                  <div className="flex items-end gap-2">
                    <div className="flex min-h-[40px] flex-1 items-center rounded-full bg-[#F0F2F5] px-4 py-1.5 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084FF]">
                      <textarea
                        rows={1}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="একটি মেসেজ লিখুন…"
                        maxLength={600}
                        className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14.5px] text-slate-800 outline-none placeholder:text-slate-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                    </div>

                    {replyText.trim() ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSend()}
                        className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0084FF] text-white shadow-md transition hover:bg-[#0073e6] active:scale-95 disabled:opacity-40"
                        title="পাঠান"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSend('👍')}
                        className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0084FF] transition hover:bg-blue-50 active:scale-90"
                        title="Thumbs Up"
                      >
                        <ThumbsUp className="h-6 w-6 fill-current" />
                      </button>
                    )}
                  </div>
                </footer>
              </div>
            ) : (
              /* ================== SCREEN 1: MESSENGER INBOX (CHATS) ================== */
              <div className="flex flex-1 min-h-0 flex-col bg-white">
                {/* Inbox Header */}
                <header
                  className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-3 shadow-2xs"
                  style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 14px))' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#006AFF] to-[#00C6FF] text-white shadow-md shadow-blue-500/25">
                        <MessengerIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-slate-900">
                          চ্যাটসমূহ
                        </h2>
                        <p className="text-[11.5px] font-medium text-slate-500">
                          {pendingCount > 0 ? `${pendingCount}টি মেসেজের উত্তর বাকি` : 'সব মেসেজ হালনাগাদ'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* New Chat Button */}
                      <button
                        type="button"
                        onClick={() => setNewChatOpen(true)}
                        className="press grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                        title="নতুন মেসেজ পাঠান"
                      >
                        <SquarePen className="h-4.5 w-4.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="press grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                        title="বন্ধ করুন"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="mt-3 relative flex items-center">
                    <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="মেসেঞ্জারে খুঁজুন…"
                      className="h-10 w-full rounded-full bg-[#F0F2F5] pl-10 pr-4 text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#0084FF]/25"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 text-[12px] font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </header>

                {/* Active Students Story / Contacts Carousel */}
                {students.length > 0 && (
                  <div className="shrink-0 border-b border-slate-100 px-3.5 py-2.5">
                    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                      {students.slice(0, 15).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedStudentId(String(s.id))}
                          className="press flex flex-col items-center gap-1 shrink-0"
                          style={{ width: '56px' }}
                        >
                          <div className="relative">
                            <Avatar name={s.name} seed={s.id} size={46} className="ring-2 ring-blue-500/80" />
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          </div>
                          <span className="truncate w-full text-center text-[10.5px] font-bold text-slate-700">
                            রোল {s.roll}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation List */}
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100/70 overscroll-contain">
                  {filteredThreads.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[#0084FF]">
                        <MessengerIcon className="h-8 w-8" />
                      </div>
                      <p className="text-[15px] font-extrabold text-slate-800">
                        {search ? 'কোনো মেসেজ পাওয়া যায়নি' : 'এখনো কোনো মেসেজ নেই'}
                      </p>
                      <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-slate-500">
                        উপরে পেন আইকন (✏️) ট্যাপ করে যেকোনো শিক্ষার্থীকে সরাসরি মেসেজ পাঠাতে পারবেন।
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewChatOpen(true)}
                        className="press mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#0084FF] px-4 py-2 text-[13px] font-bold text-white shadow-md shadow-blue-500/25"
                      >
                        <SquarePen className="h-4 w-4" />
                        নতুন মেসেজ শুরু করুন
                      </button>
                    </div>
                  ) : (
                    filteredThreads.map((thread) => {
                      const isPending = thread.pendingCount > 0;
                      return (
                        <button
                          key={thread.studentId}
                          type="button"
                          onClick={() => setSelectedStudentId(String(thread.studentId))}
                          className={cx(
                            'press flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                            isPending && 'bg-blue-50/40',
                          )}
                        >
                          <div className="relative">
                            <Avatar
                              name={thread.studentName}
                              seed={thread.studentId}
                              size={48}
                              className="ring-1 ring-slate-200"
                            />
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className={cx('truncate text-[14.5px]', isPending ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800')}>
                                {thread.studentName}
                                {thread.roll != null && (
                                  <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                                    (রোল {thread.roll})
                                  </span>
                                )}
                              </p>
                              <span className={cx('shrink-0 text-[11px]', isPending ? 'font-bold text-[#0084FF]' : 'text-slate-400')}>
                                {thread.latestAt ? fmtTime(thread.latestAt) : ''}
                              </span>
                            </div>

                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className={cx('truncate text-[13px]', isPending ? 'font-bold text-slate-900' : 'text-slate-500')}>
                                {thread.latestSender === 'teacher' ? 'আপনি: ' : ''}
                                {thread.latestMessage || 'কথোপকথন'}
                              </p>

                              {isPending && (
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#0084FF]" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Chat Picker Sheet */}
      {newChatOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="no-print fixed inset-0 z-60 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div className="flex h-[85dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-[16px] font-extrabold text-slate-900">নতুন মেসেজ</h3>
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen(false);
                  setNewChatSearch('');
                }}
                className="press grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="border-b border-slate-100 p-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
                  autoFocus
                  className="h-10 w-full rounded-full bg-[#F0F2F5] pl-10 pr-4 text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#0084FF]/25"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
              {students
                .filter((s) => {
                  const q = newChatSearch.trim().toLowerCase();
                  if (!q) return true;
                  return String(s.name || '').toLowerCase().includes(q) || String(s.roll || '').includes(q);
                })
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(String(s.id));
                      setNewChatOpen(false);
                      setNewChatSearch('');
                    }}
                    className="press flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <Avatar name={s.name} seed={s.id} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-slate-900">{s.name}</p>
                      <p className="text-[11.5px] text-slate-500">রোল {s.roll}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
