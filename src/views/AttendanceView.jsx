import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCheck, Save, Hand } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Segmented, Chips, Card, Avatar, Badge, Button, Progress, cx, DOCK, DOCK_BOTTOM } from '../components/ui';
import { GROUPS, groupBn, ATT_STATUS, ATT_ORDER, todayISO, shiftISODate, fmtDate, dayNameBn } from '../lib/format';

const STATUS_STYLE = {
  Present: { row: '', pill: 'bg-emerald-500 text-white' },
  Absent: { row: 'bg-rose-50/70', pill: 'bg-rose-500 text-white' },
  Late: { row: 'bg-amber-50/70', pill: 'bg-amber-400 text-white' },
  Leave: { row: 'bg-sky-50/70', pill: 'bg-sky-500 text-white' },
};

export const AttendanceView = () => {
  const { students, attendance, saveAttendanceRecord, getStudentAttendanceStats } = useApp();
  const { toast, openStudent, confirm } = useUI();

  const [tab, setTab] = useState('sheet');
  const [date, setDate] = useState(todayISO());
  const [group, setGroup] = useState('All');
  const [records, setRecords] = useState(() => ({ ...(attendance[todayISO()] || {}) }));
  const [dirty, setDirty] = useState(false);

  const active = useMemo(
    () => students.filter((s) => s.status !== 'inactive').sort((a, b) => Number(a.roll) - Number(b.roll)),
    [students],
  );
  const list = active.filter((s) => group === 'All' || s.group === group);
  const saved = !!attendance[date];

  const changeDate = async (next) => {
    if (dirty) {
      const ok = await confirm({ title: 'পরিবর্তন সংরক্ষণ হয়নি', message: 'অন্য দিনে গেলে এই দিনের পরিবর্তন হারিয়ে যাবে।', confirmText: 'তবুও যান', tone: 'danger' });
      if (!ok) return;
    }
    setDate(next);
    setRecords({ ...(attendance[next] || {}) });
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

  const save = async () => {
    const final = { ...records };
    active.forEach((s) => {
      if (!final[s.id]) final[s.id] = 'Present';
    });
    await saveAttendanceRecord(date, final);
    setRecords(final);
    setDirty(false);
    toast(`${fmtDate(date, { year: false })} এর হাজিরা সংরক্ষিত হয়েছে`);
  };

  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  list.forEach((s) => {
    counts[statusOf(s.id)] += 1;
  });
  const rate = list.length ? Math.round(((counts.Present + counts.Late * 0.5) / list.length) * 100) : 0;
  const isToday = date === todayISO();

  return (
    <div>
      <PageHeader title="হাজিরা" subtitle="দৈনিক হাজিরা খাতা">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sheet', label: 'হাজিরা খাতা' },
            { value: 'summary', label: 'সারসংক্ষেপ' },
          ]}
        />
      </PageHeader>

      {tab === 'sheet' ? (
        <>
          <Card className="flex items-center gap-2 p-2">
            <Button variant="ghost" size="sm" className="w-11 px-0" aria-label="আগের দিন" onClick={() => changeDate(shiftISODate(date, -1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <label className="relative flex-1 cursor-pointer text-center">
              <p className="text-[16px] font-bold text-ink">{isToday ? 'আজ' : dayNameBn(date)}</p>
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
            <Button
              variant="ghost"
              size="sm"
              className="w-11 px-0"
              aria-label="পরের দিন"
              disabled={isToday}
              onClick={() => changeDate(shiftISODate(date, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Card>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {ATT_ORDER.map((k) => (
              <div key={k} className="rounded-2xl bg-white py-2.5 text-center ring-1 ring-slate-200/70">
                <p className={cx('tabular text-[20px] font-extrabold', { Present: 'text-emerald-600', Absent: 'text-rose-600', Late: 'text-amber-500', Leave: 'text-sky-600' }[k])}>
                  {counts[k]}
                </p>
                <p className="text-[12px] text-slate-500">{ATT_STATUS[k].bn}</p>
              </div>
            ))}
          </div>

          <Chips
            className="mt-3"
            value={group}
            onChange={setGroup}
            options={[{ value: 'All', label: `সব (${active.length})` }, ...GROUPS.map((g) => ({ value: g.id, label: g.bn }))]}
          />

          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-50/70 px-3.5 py-2.5 text-[13px] text-brand-800">
            <Hand className="h-4 w-4 shrink-0" />
            <span className="flex-1">উ = উপস্থিত, অ = অনুপস্থিত, দে = দেরি, ছু = ছুটি · নামে ট্যাপ করলেও বদলায়</span>
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="soft-success" size="sm" icon={CheckCheck} className="flex-1" onClick={() => markAll('Present')}>
              সবাই উপস্থিত
            </Button>
            <Button variant="soft-danger" size="sm" className="flex-1" onClick={() => markAll('Absent')}>
              সবাই অনুপস্থিত
            </Button>
          </div>

          <Card className="mt-3 divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
            {list.map((s) => {
              const st = statusOf(s.id);
              return (
                <div key={s.id} className={cx('flex items-center transition-colors md:border-b md:border-slate-100 md:odd:border-r', STATUS_STYLE[st].row)}>
                  <button type="button" onClick={() => cycle(s.id)} className="flex min-w-0 flex-1 items-center py-3 pl-4 pr-2 text-left max-[374px]:pl-3">
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-[15px] font-semibold', st === 'Absent' ? 'text-rose-700' : 'text-ink')}>{s.name}</span>
                      <span className="tabular block truncate text-[12.5px] text-slate-500">
                        রোল {s.roll} · {groupBn(s.group)}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1 py-2 pr-2.5 max-[374px]:gap-0.5 max-[374px]:pr-2">
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

          <div
            className={DOCK} style={DOCK_BOTTOM}
          >
            <div className="flex items-center gap-3 rounded-[22px] bg-ink/95 p-2 pl-4 text-white shadow-2xl backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="tabular text-[15px] font-bold">
                  {counts.Present + counts.Late}/{list.length} উপস্থিত · {rate}%
                </p>
                <p className="text-[12px] text-white/60">{dirty ? '● সংরক্ষণ করা হয়নি' : saved ? '✓ সংরক্ষিত' : 'এখনো সংরক্ষণ হয়নি'}</p>
              </div>
              <Button variant={dirty || !saved ? 'success' : 'dark'} size="sm" icon={Save} onClick={save} className={!dirty && saved ? 'bg-white/10' : ''}>
                সংরক্ষণ
              </Button>
            </div>
          </div>
          <div className="h-20" />
        </>
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
          {low} জনের হাজিরা ৭৫% এর নিচে — তালিকার উপরে দেখানো হচ্ছে
        </div>
      )}
      <Card className="divide-y divide-slate-100 overflow-hidden md:grid md:grid-cols-2 md:divide-y-0">
        {rows.map(({ s, st }) => {
          const tone = st.totalClasses === 0 ? 'brand' : st.percentage >= 80 ? 'green' : st.percentage >= 75 ? 'amber' : 'red';
          return (
            <button key={s.id} type="button" onClick={() => onOpen(s)} className="w-full px-4 py-3.5 text-left active:bg-slate-50 md:border-b md:border-slate-100 md:odd:border-r">
              <div className="flex items-center gap-3">
                <Avatar src={s.avatar} name={s.nameEn || s.name} seed={s.id} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                  <p className="tabular text-[12.5px] text-slate-500">
                    রোল {s.roll} · উ {st.present} · অ {st.absent} · মোট {st.totalClasses}
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
