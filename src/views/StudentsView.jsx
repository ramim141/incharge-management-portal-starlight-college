import React, { useMemo, useState } from 'react';
import { Download, UserPlus, Users, ChevronRight, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SearchBar, FilterButton, Card, RollBadge, Badge, IconButton, EmptyState, Button, cx, CONTAINER, GUTTER } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { taka, studentTags, downloadCSV, todayISO, waLink } from '../lib/format';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

export const StudentsView = () => {
  const { students, settings, getStudentAttendanceStats, calculateStudentTotalDue } = useApp();
  const { openStudent, openStudentForm, toast } = useUI();
  const [q, setQ] = useState('');
  const DEFAULTS = { status: 'active', group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(DEFAULTS);
  const { status } = filters;

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
      (s.studentId || '').toLowerCase().includes(t);
    const matchG = matchStudentFilter(s, filters);
    const matchS =
      status === 'all' || (status === 'due' ? due > 0 && s.status !== 'inactive' : (s.status || 'active') === status);
    return matchQ && matchG && matchS;
  });

  const exportCSV = () => {
    downloadCSV(
      `${settings.classCode}_Students_${todayISO()}.csv`,
      ['Roll', 'Student ID', 'Name', 'Name (EN)', 'Group', 'Father', 'Mother', 'Guardian Phone', 'Address', 'Monthly Fee', 'Total Due', 'Attendance %', 'Status'],
      filtered.map(({ s, due, att }) => [
        s.roll, s.studentId, s.name, s.nameEn || '', s.group, s.fatherName, s.motherName, s.guardianPhone, s.address, s.monthlyFee, due, att.percentage, s.status,
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
        <Card className="divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
          {filtered.map(({ s, due, att }) => (
            <div
              key={s.id}
              onClick={() => openStudent(s)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80 active:bg-slate-100/70 md:border-b md:border-slate-100 md:odd:border-r"
            >
              <RollBadge roll={s.roll} seed={s.id} size={46} />
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-[15.5px] font-semibold', s.status === 'inactive' ? 'text-slate-400' : 'text-ink')}>{s.name}</p>
                <p className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12.5px] text-slate-500">
                  {studentTags(s) && (
                    <>
                      {studentTags(s)}
                      <span className="text-slate-300">•</span>
                    </>
                  )}
                  <span className={cx('tabular font-semibold', att.totalClasses === 0 ? 'text-slate-400' : att.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600')}>
                    হাজিরা {Math.round(att.percentage)}%
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {due > 0 ? <Badge tone="red">{taka(due)}</Badge> : <Badge tone="green">পরিশোধিত</Badge>}

                {s.guardianPhone && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:${s.guardianPhone}`}
                      aria-label="অভিভাবককে কল করুন"
                      className="press grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100"
                      title="কল করুন"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={waLink(s.guardianPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp মেসেজ"
                      className="press grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      title="WhatsApp"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  </div>
                )}
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </div>
            </div>
          ))}
        </Card>
      )}

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
