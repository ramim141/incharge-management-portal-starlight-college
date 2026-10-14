import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, CheckCheck, Save, Hand, Gavel, Info, UserCheck, CheckCircle2 } from 'lucide-react';
import { RollCall } from '../components/RollCall';
import { leaveDefaultsFor } from '../lib/leave';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Segmented, FilterButton, Card, RollBadge, Badge, Button, IconButton, Checkbox, Progress, Sheet, cx } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { AbsenteeSheet } from '../components/AbsenteeSheet';
import { MonthlyAttendanceSheet } from '../components/MonthlyAttendanceSheet';
import { ATT_STATUS, ATT_ORDER, todayISO, shiftISODate, fmtDate, dayNameBn, taka } from '../lib/format';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

const STATUS_STYLE = {
  Present: { row: '', pill: 'bg-emerald-500 text-white' },
  Absent: { row: 'bg-rose-50/60', pill: 'bg-rose-500 text-white' },
  Late: { row: '', pill: 'bg-amber-400 text-white' },
  Leave: { row: '', pill: 'bg-sky-500 text-white' },
};

const HELP_KEY = 'xi_att_help';

function AttendanceHelp({ open, onClose, fine }) {
  const [hide, setHide] = useState(false);
  const close = () => {
    if (hide) {
      try {
        localStorage.setItem(HELP_KEY, 'off');
      } catch {
        /* private mode — the popup simply shows again next time */
      }
    }
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="হাজিরা নেওয়ার নিয়ম">
      <div className="space-y-3 pt-1">
        <div className="flex gap-3 rounded-2xl bg-brand-50/70 p-4 text-[14.5px] leading-relaxed text-brand-900">
          <Hand className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">বোতামের মানে</p>
            <p>উ = উপস্থিত, অ = অনুপস্থিত, দে = দেরি, ছু = ছুটি</p>
            <p className="text-[13.5px] text-brand-800/80">নামে ট্যাপ করলেও পরের অবস্থায় বদলায়</p>
          </div>
        </div>
        {fine != null && (
          <div className="flex gap-3 rounded-2xl bg-rose-50/80 p-4 text-[14.5px] leading-relaxed text-rose-900">
            <Gavel className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">অনুপস্থিতির জরিমানা</p>
              <p>
                অনুপস্থিত দিয়ে সংরক্ষণ করলে আপনাআপনি জরিমানা হবে — সাধারণত {taka(fine)}/দিন, শিক্ষার্থীভেদে আলাদা হতে পারে।
              </p>
              <p className="text-[13.5px] text-rose-800/80">পরে "জরিমানা" পাতা থেকে বদলানো বা মওকুফ করা যাবে।</p>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setHide((v) => !v)} className="flex items-center gap-2.5 py-1 text-[14px] font-medium text-slate-600">
          <Checkbox checked={hide} className="h-5 w-5 rounded-md" />
          আর দেখাবেন না
        </button>
        <Button size="lg" block onClick={close}>
          বুঝেছি
        </Button>
      </div>
    </Sheet>
  );
}

export const AttendanceView = () => {
  const { students, attendance, leaves, saveAttendanceRecord, getStudentAttendanceStats, settings, absenceFineFor, classId } = useApp();
  const { toast, openStudent, confirm } = useUI();

  const [waTick, setWaTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setWaTick((t) => t + 1);
    window.addEventListener('absent_wa_sent_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('absent_wa_sent_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const [tab, setTab] = useState('sheet');
  const [date, setDate] = useState(todayISO());
  const FILTER_DEFAULTS = { group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  // A day not yet taken starts with everyone on approved leave already marked "Leave"
  const startOf = (d) => (attendance[d] ? { ...attendance[d] } : leaveDefaultsFor(leaves || [], d));
  const [records, setRecords] = useState(() => startOf(todayISO()));
  const [dirty, setDirty] = useState(false);
  const [absentSheetOpen, setAbsentSheetOpen] = useState(false);
  // How-to popup shown when the page opens, until the teacher ticks "আর দেখাবেন না"
  const [help, setHelp] = useState(() => {
    try {
      return localStorage.getItem(HELP_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const hasAbsentFine = Number(settings.absentFine) > 0 || students.some((s) => Number(s.absentFine) > 0);

  const active = useMemo(
    () => students.filter((s) => s.status !== 'inactive').sort((a, b) => Number(a.roll) - Number(b.roll)),
    [students],
  );
  const absentees = useMemo(
    () => active.filter((s) => (records[s.id] || 'Present') === 'Absent'),
    [active, records],
  );

  const isAbsentMsgDone = useMemo(() => {
    if (!absentees.length) return false;
    let sentSet = new Set();
    try {
      const stored = localStorage.getItem(`absent_wa_sent_${classId || 'default'}_${date}`);
      if (stored) sentSet = new Set(JSON.parse(stored));
    } catch {}
    const reachable = absentees.filter((s) => s.guardianPhone || s.studentPhone);
    return reachable.length === 0 || reachable.every((s) => sentSet.has(s.id));
  }, [absentees, classId, date, waTick]);

  const list = active.filter((s) => matchStudentFilter(s, filters));
  const saved = !!attendance[date];

  const changeDate = async (next) => {
    if (dirty) {
      const ok = await confirm({ title: 'পরিবর্তন সংরক্ষণ হয়নি', message: 'অন্য দিনে গেলে এই দিনের পরিবর্তন হারিয়ে যাবে।', confirmText: 'তবুও যান', tone: 'danger' });
      if (!ok) return;
    }
    setDate(next);
    setRecords(startOf(next));
    setDirty(false);
  };

  const statusOf = (id) => records[id] || 'Present';

  const cycle = (id) => {
    const cur = statusOf(id);
    const next = ATT_ORDER[(ATT_ORDER.indexOf(cur) + 1) % ATT_ORDER.length];
    setRecords((r) => ({ ...r, [id]: next }));
    setDirty(true);
    if (navigator.vibrate) navigator.vibrate(8);
  };

  const setStatus = (id, st) => {
    setRecords((r) => ({ ...r, [id]: st }));
    setDirty(true);
  };

  // One-by-one roll call: rc = index of the student on screen (list.length = summary page)
  const [rc, setRc] = useState(null);
  const rcPick = async (st) => {
    const stu = list[rc];
    if (!stu) return;
    const next = { ...records, [stu.id]: st };
    setRecords(next);
    setDirty(true);
    if (navigator.vibrate) navigator.vibrate(8);
    if (rc + 1 >= list.length) {
      setRc(list.length);
      await save(next);
    } else {
      setRc(rc + 1);
    }
  };

  const markAll = (st) => {
    setRecords((r) => {
      const n = { ...r };
      list.forEach((s) => {
        n[s.id] = st;
      });
      return n;
    });
    setDirty(true);
  };

  const save = async (override) => {
    const final = { ...(override || records) };
    active.forEach((s) => {
      if (!final[s.id]) final[s.id] = 'Present';
    });
    const { added, removed } = await saveAttendanceRecord(date, final);
    setRecords(final);
    setDirty(false);
    const extra = [added && `${added} জনের অনুপস্থিতি জরিমানা যোগ হয়েছে`, removed && `${removed}টি জরিমানা বাদ গেছে`].filter(Boolean).join(' · ');
    toast(`${fmtDate(date, { year: false })} এর হাজিরা সংরক্ষিত${extra ? ` — ${extra}` : ''}`);
  };

  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  list.forEach((s) => {
    counts[statusOf(s.id)] += 1;
  });
  const rate = list.length ? Math.round(((counts.Present + counts.Late * 0.5) / list.length) * 100) : 0;
  const isToday = date === todayISO();

  return (
    <div>
      <AttendanceHelp open={help} onClose={() => setHelp(false)} fine={hasAbsentFine ? settings.absentFine : null} />
      <PageHeader
        title="হাজিরা"
        subtitle={tab === 'sheet' ? `${counts.Present + counts.Late}/${list.length} উপস্থিত · ${rate}%` : tab === 'download' ? 'মাসিক হাজিরা শিট ও PDF ডাউনলোড' : undefined}
        actions={
          <>
            {tab === 'sheet' && (
              <Button size="sm" variant={dirty || !saved ? 'success' : 'secondary'} icon={Save} onClick={() => save()} className="font-bold">
                {dirty || !saved ? 'সংরক্ষণ' : 'সংরক্ষিত'}
              </Button>
            )}
            <IconButton icon={Info} label="নিয়ম দেখুন" onClick={() => setHelp(true)} />
          </>
        }
      >
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sheet', label: 'হাজিরা খাতা' },
            { value: 'summary', label: 'সারসংক্ষেপ' },
            { value: 'download', label: 'ডাউনলোড' },
          ]}
        />
      </PageHeader>

      {tab === 'sheet' ? (
        <>
          {/* Date switcher */}
          <div className="flex items-center justify-between rounded-2xl bg-white px-1 py-1">
            <button
              type="button"
              aria-label="আগের দিন"
              onClick={() => changeDate(shiftISODate(date, -1))}
              className="press grid h-10 w-10 place-items-center rounded-xl text-slate-500 active:bg-slate-100"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <label className="relative cursor-pointer text-center">
              <p className="text-[16px] font-bold leading-tight text-ink">
                {isToday ? 'আজ' : dayNameBn(date)}
                <span className={cx('ml-1.5 inline-block h-2 w-2 rounded-full align-middle', dirty ? 'bg-amber-400' : saved ? 'bg-emerald-500' : 'bg-slate-300')} />
              </p>
              <p className="text-[12.5px] text-slate-500">{fmtDate(date)}</p>
              <input
                type="date"
                value={date}
                max={todayISO()}
                onChange={(e) => e.target.value && changeDate(e.target.value)}
                className="absolute inset-0 opacity-0"
                aria-label="তারিখ বাছুন"
              />
            </label>
            <button
              type="button"
              aria-label="পরের দিন"
              disabled={isToday}
              onClick={() => changeDate(shiftISODate(date, 1))}
              className="press grid h-10 w-10 place-items-center rounded-xl text-slate-500 active:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Counts */}
          <div className="mt-2.5 grid grid-cols-4 divide-x divide-slate-100 rounded-2xl bg-white py-2.5">
            {ATT_ORDER.map((k) => (
              <div key={k} className="text-center">
                <p className={cx('tabular text-[19px] font-extrabold leading-tight', { Present: 'text-emerald-600', Absent: 'text-rose-600', Late: 'text-amber-500', Leave: 'text-sky-600' }[k])}>
                  {counts[k]}
                </p>
                <p className="text-[11.5px] text-slate-500">{ATT_STATUS[k].bn}</p>
              </div>
            ))}
          </div>

          {counts.Absent > 0 && (
            <button
              type="button"
              onClick={() => setAbsentSheetOpen(true)}
              className={cx(
                'press mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[12.5px] font-bold transition shadow-xs',
                isAbsentMsgDone
                  ? 'border border-emerald-200/90 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              )}
            >
              {isAbsentMsgDone ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>মেসেজ পাঠানো সম্পন্ন</span>
                </>
              ) : (
                <>
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>অনুপস্থিত {counts.Absent} জনের অভিভাবককে WhatsApp</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={!list.length}
            onClick={() => setRc(0)}
            className={cx(
              'press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-bold text-white shadow-lift transition disabled:opacity-40',
              saved && !dirty
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-brand-600 hover:bg-brand-700'
            )}
          >
            {saved && !dirty ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isToday ? 'আজকের হাজিরা নেওয়া সম্পন্ন' : 'হাজিরা নেওয়া সম্পন্ন'}</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                <span>একজন একজন করে হাজিরা নিন</span>
              </>
            )}
          </button>

          {/* Quick actions */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => markAll('Present')}
              className="press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-[13.5px] font-bold text-emerald-700"
            >
              <CheckCheck className="h-4 w-4" />
              সবাই উপস্থিত
            </button>
            <button
              type="button"
              onClick={() => markAll('Absent')}
              className="press h-10 flex-1 rounded-xl bg-rose-50 text-[13.5px] font-bold text-rose-700"
            >
              সবাই অনুপস্থিত
            </button>
            <FilterButton compact value={filters} defaults={FILTER_DEFAULTS} onChange={setFilters} groups={studentFilterGroups(settings, active)} />
          </div>

          {/* Students */}
          <Card className="mt-3 divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
            {list.map((s) => {
              const st = statusOf(s.id);
              const fine = st === 'Absent' ? absenceFineFor(s) : 0;
              return (
                <div key={s.id} className={cx('flex items-center transition-colors md:border-b md:border-slate-100 md:odd:border-r', STATUS_STYLE[st].row)}>
                  <button type="button" onClick={() => cycle(s.id)} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-1.5 text-left">
                    <RollBadge roll={s.roll} seed={s.id} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-[15px] font-semibold', st === 'Absent' ? 'text-rose-700' : 'text-ink')}>{s.name}</span>
                      {fine > 0 && <span className="tabular block text-[11.5px] font-semibold text-rose-600">জরিমানা {taka(fine)}</span>}
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1 py-2 pr-2.5 max-[374px]:gap-0.5 max-[374px]:pr-1.5">
                    {ATT_ORDER.map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-label={ATT_STATUS[k].bn}
                        onClick={() => setStatus(s.id, k)}
                        className={cx(
                          'press grid h-10 w-9 place-items-center rounded-xl text-[14px] font-bold transition max-[374px]:h-9 max-[374px]:w-8 max-[374px]:rounded-lg max-[374px]:text-[13px]',
                          st === k ? STATUS_STYLE[k].pill : 'bg-slate-100/80 text-slate-400',
                        )}
                      >
                        {ATT_STATUS[k].short}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>

          {rc !== null && (
            <RollCall
              list={list}
              step={rc}
              records={records}
              getStats={getStudentAttendanceStats}
              fineFor={absenceFineFor}
              counts={counts}
              rate={rate}
              dirty={dirty}
              date={date}
              onPick={rcPick}
              onStep={setRc}
              onSave={() => save()}
              onWhatsApp={() => setAbsentSheetOpen(true)}
              isAbsentMsgDone={isAbsentMsgDone}
              onClose={() => setRc(null)}
            />
          )}

          <AbsenteeSheet
            open={absentSheetOpen}
            onClose={() => setAbsentSheetOpen(false)}
            date={date}
            absentStudents={absentees}
          />
        </>
      ) : tab === 'download' ? (
        <MonthlyAttendanceSheet
          students={active}
          attendance={attendance}
          settings={settings}
          onOpenStudent={openStudent}
        />
      ) : (
        <Summary students={active} getStats={getStudentAttendanceStats} onOpen={openStudent} />
      )}
    </div>
  );
};

function Summary({ students, getStats, onOpen }) {
  const rows = students
    .map((s) => ({ s, st: getStats(s.id) }))
    .sort((a, b) => a.st.percentage - b.st.percentage);
  const low = rows.filter((r) => r.st.totalClasses > 0 && r.st.percentage < 75).length;

  return (
    <>
      {low > 0 && (
        <div className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-[13.5px] font-medium text-rose-700 ring-1 ring-rose-100">
          {low} জনের হাজিরা 75% এর নিচে — তালিকার উপরে দেখানো হচ্ছে
        </div>
      )}
      <Card className="divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
        {rows.map(({ s, st }) => {
          const tone = st.totalClasses === 0 ? 'brand' : st.percentage >= 80 ? 'green' : st.percentage >= 75 ? 'amber' : 'red';
          return (
            <button key={s.id} type="button" onClick={() => onOpen(s)} className="w-full px-4 py-3.5 text-left active:bg-slate-50 md:border-b md:border-slate-100 md:odd:border-r">
              <div className="flex items-center gap-3">
                <RollBadge roll={s.roll} seed={s.id} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                  <p className="tabular text-[12.5px] text-slate-500">
                    উ {st.present} · অ {st.absent} · মোট {st.totalClasses}
                  </p>
                </div>
                <Badge tone={tone}>{Math.round(st.percentage)}%</Badge>
              </div>
              <Progress value={st.percentage} tone={tone === 'brand' ? 'brand' : tone} className="mt-2.5 h-1.5" />
            </button>
          );
        })}
      </Card>
    </>
  );
}
