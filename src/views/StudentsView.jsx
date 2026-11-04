import React, { useMemo, useState } from 'react';
import { Download, UserPlus, Users, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SearchBar, FilterButton, Card, RollBadge, Badge, IconButton, EmptyState, Button, Sheet, cx, CONTAINER, GUTTER, CARD_GRID } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { taka, studentTags, downloadCSV, todayISO, waLink } from '../lib/format';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

export const StudentsView = () => {
  const { students, settings, getStudentAttendanceStats, calculateStudentTotalDue } = useApp();
  const { openStudent, openStudentForm, toast } = useUI();
  const [q, setQ] = useState('');
  const [contactTarget, setContactTarget] = useState(null); // { student, type: 'call' | 'whatsapp' } | null
  const DEFAULTS = { status: 'active', group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(DEFAULTS);
  const { status } = filters;

  const handleCardCall = (e, s) => {
    e.stopPropagation();
    const hasGuardian = Boolean(s.guardianPhone);
    const hasStudent = Boolean(s.studentPhone);
    if (hasGuardian && hasStudent) {
      setContactTarget({ student: s, type: 'call' });
    } else if (hasGuardian) {
      window.location.href = `tel:${s.guardianPhone}`;
    } else if (hasStudent) {
      window.location.href = `tel:${s.studentPhone}`;
    } else {
      toast('মোবাইল নম্বর দেওয়া নেই', 'error');
    }
  };

  const handleCardWhatsApp = (e, s) => {
    e.stopPropagation();
    const hasGuardian = Boolean(s.guardianPhone);
    const hasStudent = Boolean(s.studentPhone);
    if (hasGuardian && hasStudent) {
      setContactTarget({ student: s, type: 'whatsapp' });
    } else if (hasGuardian) {
      window.open(waLink(s.guardianPhone), '_blank');
    } else if (hasStudent) {
      window.open(waLink(s.studentPhone), '_blank');
    } else {
      toast('মোবাইল নম্বর দেওয়া নেই', 'error');
    }
  };

  const rows = useMemo(
    () =>
      students
        .map((s) => ({ s, due: calculateStudentTotalDue(s.id), att: getStudentAttendanceStats(s.id) }))
        .sort((a, b) => Number(a.s.roll) - Number(b.s.roll)),
    [students, calculateStudentTotalDue, getStudentAttendanceStats],
  );

  const t = q.trim().toLowerCase();
  const filtered = rows.filter(({ s, due }) => {
    const matchQ =
      !t ||
      String(s.roll).includes(t) ||
      s.name.toLowerCase().includes(t) ||
      (s.nameEn || '').toLowerCase().includes(t) ||
      (s.guardianPhone || '').includes(t) ||
      (s.studentPhone || '').includes(t) ||
      (s.studentId || '').toLowerCase().includes(t);
    const matchG = matchStudentFilter(s, filters);
    const matchS =
      status === 'all' || (status === 'due' ? due > 0 && s.status !== 'inactive' : (s.status || 'active') === status);
    return matchQ && matchG && matchS;
  });

  const exportCSV = () => {
    downloadCSV(
      `${settings.classCode}_Students_${todayISO()}.csv`,
      ['Roll', 'Student ID', 'Name', 'Name (EN)', 'Group', 'Father', 'Mother', 'Guardian Phone', 'Student Phone', 'Address', 'Monthly Fee', 'Total Due', 'Attendance %', 'Status'],
      filtered.map(({ s, due, att }) => [
        s.roll, s.studentId, s.name, s.nameEn || '', s.group, s.fatherName, s.motherName, s.guardianPhone, s.studentPhone || '', s.address, s.monthlyFee, due, att.percentage, s.status,
      ]),
    );
    toast(`${filtered.length} জনের তালিকা ডাউনলোড হয়েছে`);
  };

  const count = (fn) => rows.filter(fn).length;

  return (
    <div>
      <PageHeader
        title="শিক্ষার্থী"
        subtitle={`মোট ${students.length} জন · ${settings.className}`}
        actions={<IconButton icon={Download} label="CSV ডাউনলোড" onClick={exportCSV} />}
      >
        <div className="flex gap-2">
          <SearchBar className="flex-1" value={q} onChange={setQ} placeholder="রোল, নাম, ফোন বা আইডি" />
          <FilterButton
            value={filters}
            defaults={DEFAULTS}
            onChange={setFilters}
            groups={[
              {
                key: 'status',
                label: 'অবস্থা',
                options: [
                  { value: 'active', label: 'সক্রিয়', count: count(({ s }) => (s.status || 'active') === 'active') },
                  { value: 'due', label: 'বকেয়া আছে', count: count(({ s, due }) => due > 0 && s.status !== 'inactive') },
                  { value: 'inactive', label: 'নিষ্ক্রিয়', count: count(({ s }) => s.status === 'inactive') },
                  { value: 'all', label: 'সবাই', count: rows.length },
                ],
              },
              ...studentFilterGroups(settings, students),
            ]}
          />
        </div>
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="কাউকে পাওয়া যায়নি"
          text="সার্চ বা ফিল্টার বদলে দেখুন"
          action={
            <Button variant="soft" icon={UserPlus} onClick={() => openStudentForm()}>
              নতুন শিক্ষার্থী
            </Button>
          }
        />
      ) : (
        <div className={cx('mt-3', CARD_GRID)}>
          {filtered.map(({ s, due, att }) => (
            <Card key={s.id} className="overflow-hidden transition hover:shadow-card">
              {/* Top info area: Clicking opens student profile */}
              <div
                onClick={() => openStudent(s)}
                className="flex cursor-pointer items-center gap-3 p-3.5 transition active:bg-slate-50/70"
              >
                <RollBadge roll={s.roll} seed={s.id} size={46} />
                <div className="min-w-0 flex-1">
                  {/* Name */}
                  <p className={cx('text-[15.5px] font-bold leading-snug', s.status === 'inactive' ? 'text-slate-400' : 'text-ink')}>
                    {s.name}
                  </p>

                  {/* Niche bibag & attendance */}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
                    {studentTags(s) && (
                      <>
                        <span>{studentTags(s)}</span>
                        <span className="text-slate-300">•</span>
                      </>
                    )}
                    <span className={cx('tabular font-semibold', att.totalClasses === 0 ? 'text-slate-400' : att.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600')}>
                      হাজিরা {Math.round(att.percentage)}%
                    </span>
                  </div>
                </div>

                {/* Right side a tk */}
                <div className="shrink-0 text-right">
                  {due > 0 ? (
                    <Badge tone="red">{taka(due)}</Badge>
                  ) : (
                    <Badge tone="green">পরিশোধিত</Badge>
                  )}
                </div>
              </div>

              {/* Sobar niche duita button: Call and WhatsApp */}
              <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/60 divide-x divide-slate-100">
                <button
                  type="button"
                  onClick={(e) => handleCardCall(e, s)}
                  className={cx(
                    'press flex h-10 items-center justify-center gap-1.5 text-[13px] font-semibold transition',
                    s.guardianPhone || s.studentPhone ? 'text-sky-600 hover:bg-sky-50 active:bg-sky-100' : 'text-slate-300 cursor-not-allowed',
                  )}
                >
                  <Phone className="h-4 w-4" /> কল
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCardWhatsApp(e, s)}
                  className={cx(
                    'press flex h-10 items-center justify-center gap-1.5 text-[13px] font-semibold transition',
                    s.guardianPhone || s.studentPhone ? 'text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100' : 'text-slate-300 cursor-not-allowed',
                  )}
                >
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Contact Picker Modal for Call and WhatsApp */}
      <Sheet
        open={!!contactTarget}
        onClose={() => setContactTarget(null)}
        title={contactTarget?.type === 'call' ? 'কাকে কল করবেন?' : 'WhatsApp-এ কাকে মেসেজ পাঠাবেন?'}
        subtitle={contactTarget?.student ? `${contactTarget.student.name} · রোল ${contactTarget.student.roll}` : ''}
      >
        {contactTarget && (
          <div className="space-y-3 pt-2">
            <p className="text-[13px] text-slate-500 font-medium">
              {contactTarget.type === 'call' ? 'কল করার জন্য নম্বর নির্বাচন করুন:' : 'মেসেজ পাঠানোর জন্য নম্বর নির্বাচন করুন:'}
            </p>

            {contactTarget.student.guardianPhone ? (
              <a
                href={contactTarget.type === 'call' ? `tel:${contactTarget.student.guardianPhone}` : waLink(contactTarget.student.guardianPhone)}
                target={contactTarget.type === 'call' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={() => setContactTarget(null)}
                className="press flex items-center justify-between rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3.5 hover:bg-sky-100/70 transition shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700 text-[20px] shadow-xs">
                    👨‍👦
                  </span>
                  <div>
                    <span className="inline-block rounded-md bg-sky-200/70 px-1.5 py-0.2 text-[11px] font-bold text-sky-800">
                      অভিভাবক
                    </span>
                    <p className="tabular text-[15px] font-bold text-sky-950 mt-0.5">{contactTarget.student.guardianPhone}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-xs">
                  {contactTarget.type === 'call' ? <Phone className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />}
                  <span>{contactTarget.type === 'call' ? 'কল দিন' : 'WhatsApp'}</span>
                </span>
              </a>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 opacity-60 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-500 text-[18px]">👨‍👦</span>
                <div>
                  <p className="text-[13px] font-bold text-slate-600">অভিভাবক</p>
                  <p className="text-[12px] text-slate-400">নম্বর দেওয়া নেই</p>
                </div>
              </div>
            )}

            {contactTarget.student.studentPhone ? (
              <a
                href={contactTarget.type === 'call' ? `tel:${contactTarget.student.studentPhone}` : waLink(contactTarget.student.studentPhone)}
                target={contactTarget.type === 'call' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={() => setContactTarget(null)}
                className="press flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 hover:bg-emerald-100/70 transition shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 text-[20px] shadow-xs">
                    🎓
                  </span>
                  <div>
                    <span className="inline-block rounded-md bg-emerald-200/70 px-1.5 py-0.2 text-[11px] font-bold text-emerald-800">
                      শিক্ষার্থী (Student)
                    </span>
                    <p className="tabular text-[15px] font-bold text-emerald-950 mt-0.5">{contactTarget.student.studentPhone}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-xs">
                  {contactTarget.type === 'call' ? <Phone className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />}
                  <span>{contactTarget.type === 'call' ? 'কল দিন' : 'WhatsApp'}</span>
                </span>
              </a>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 opacity-60 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-500 text-[18px]">🎓</span>
                <div>
                  <p className="text-[13px] font-bold text-slate-600">শিক্ষার্থী</p>
                  <p className="text-[12px] text-slate-400">নম্বর দেওয়া নেই</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <div
        className={cx('no-print pointer-events-none fixed inset-x-0 z-30 mx-auto flex justify-end', CONTAINER, GUTTER)}
        style={{ bottom: 'calc(92px + env(safe-area-inset-bottom) + var(--nav-lift, 0px))' }}
      >
        <button
          type="button"
          onClick={() => openStudentForm()}
          aria-label="নতুন শিক্ষার্থী"
          className="press pointer-events-auto flex h-14 items-center gap-2 rounded-2xl bg-ink pl-4 pr-5 text-[15px] font-semibold text-white shadow-xl max-[374px]:h-12 max-[374px]:pl-3 max-[374px]:pr-4"
        >
          <UserPlus className="h-5 w-5" /> নতুন
        </button>
      </div>
    </div>
  );
};
