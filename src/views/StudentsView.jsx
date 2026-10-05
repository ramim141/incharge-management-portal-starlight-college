import React, { useMemo, useState } from 'react';
import { Download, UserPlus, Users, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, SearchBar, Chips, Card, Avatar, Badge, IconButton, EmptyState, Button, cx, CONTAINER, GUTTER } from '../components/ui';
import { taka, GROUPS, groupBn, downloadCSV, todayISO } from '../lib/format';

export const StudentsView = () => {
  const { students, getStudentAttendanceStats, calculateStudentTotalDue } = useApp();
  const { openStudent, openStudentForm, toast } = useUI();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const [status, setStatus] = useState('active');

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
    const matchG = group === 'All' || s.group === group;
    const matchS =
      status === 'all' || (status === 'due' ? due > 0 && s.status !== 'inactive' : (s.status || 'active') === status);
    return matchQ && matchG && matchS;
  });

  const exportCSV = () => {
    downloadCSV(
      `XI_Students_${todayISO()}.csv`,
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
        subtitle={`মোট ${students.length} জন · একাদশ শ্রেণি`}
        actions={<IconButton icon={Download} label="CSV ডাউনলোড" onClick={exportCSV} />}
      >
        <SearchBar value={q} onChange={setQ} placeholder="রোল, নাম, ফোন বা আইডি" />
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'সক্রিয়', count: count(({ s }) => (s.status || 'active') === 'active') },
            { value: 'due', label: 'বকেয়া আছে', count: count(({ s, due }) => due > 0 && s.status !== 'inactive') },
            { value: 'inactive', label: 'নিষ্ক্রিয়', count: count(({ s }) => s.status === 'inactive') },
            { value: 'all', label: 'সবাই', count: rows.length },
          ]}
        />
      </PageHeader>

      <Chips
        className="mb-3"
        value={group}
        onChange={setGroup}
        options={[{ value: 'All', label: 'সব বিভাগ' }, ...GROUPS.map((g) => ({ value: g.id, label: g.bn }))]}
      />

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
            <button key={s.id} type="button" onClick={() => openStudent(s)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50 md:border-b md:border-slate-100 md:odd:border-r">
              <div className="relative">
                <Avatar src={s.avatar} name={s.nameEn || s.name} seed={s.id} size={48} />
                <span className="tabular absolute -bottom-1 -left-1 rounded-md bg-ink px-1.5 text-[11px] font-bold leading-[18px] text-white ring-2 ring-white">
                  {s.roll}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-[15.5px] font-semibold', s.status === 'inactive' ? 'text-slate-400' : 'text-ink')}>{s.name}</p>
                <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
                  {groupBn(s.group)}
                  <span className="text-slate-300">•</span>
                  <span className={cx('tabular font-semibold', att.totalClasses === 0 ? 'text-slate-400' : att.percentage >= 75 ? 'text-emerald-600' : 'text-rose-600')}>
                    হাজিরা {Math.round(att.percentage)}%
                  </span>
                </p>
              </div>
              {due > 0 ? <Badge tone="red">{taka(due)}</Badge> : <Badge tone="green">পরিশোধিত</Badge>}
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </button>
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
