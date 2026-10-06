import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCheck, Save, Hand, Gavel, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Segmented, FilterButton, Card, RollBadge, Badge, Button, IconButton, Checkbox, Progress, Sheet, cx, DOCK, DOCK_BOTTOM } from '../components/ui';
import { studentTags, ATT_STATUS, ATT_ORDER, todayISO, shiftISODate, fmtDate, dayNameBn, taka } from '../lib/format';
import { studentFilterGroups, matchStudentFilter } from '../lib/filters';

const STATUS_STYLE = {
  Present: { row: '', pill: 'bg-emerald-500 text-white' },
  Absent: { row: 'bg-rose-50/70', pill: 'bg-rose-500 text-white' },
  Late: { row: 'bg-amber-50/70', pill: 'bg-amber-400 text-white' },
  Leave: { row: 'bg-sky-50/70', pill: 'bg-sky-500 text-white' },
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
  const { students, attendance, saveAttendanceRecord, getStudentAttendanceStats, settings, absenceFineFor } = useApp();
  const { toast, openStudent, confirm } = useUI();

  const [tab, setTab] = useState('sheet');
  const [date, setDate] = useState(todayISO());
  const FILTER_DEFAULTS = { group: 'All', section: 'All', gender: 'All' };
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [records, setRecords] = useState(() => ({ ...(attendance[todayISO()] || {}) }));
  const [dirty, setDirty] = useState(false);
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
  const list = active.filter((s) => matchStudentFilter(s, filters));
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
      <PageHeader title="হাজিরা" subtitle="দৈনিক হাজিরা খাতা" actions={<IconButton icon={Info} label="নিয়ম দেখুন" onClick={() => setHelp(true)} />}>
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



          <div className="mt-3 flex items-center gap-2">
            <Button variant="soft-success" size="sm" icon={CheckCheck} className="flex-1" onClick={() => markAll('Present')}>
              সবাই উপস্থিত
            </Button>
            <Button variant="soft-danger" size="sm" className="flex-1" onClick={() => markAll('Absent')}>
              সবাই অনুপস্থিত
            </Button>
            <FilterButton compact value={filters} defaults={FILTER_DEFAULTS} onChange={setFilters} groups={studentFilterGroups(settings, active)} />
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
                        রোল {s.roll}{studentTags(s) ? ` · ${studentTags(s)}` : ''}
                        {st === 'Absent' && absenceFineFor(s) > 0 && <span className="font-semibold text-rose-600"> · জরিমানা {taka(absenceFineFor(s))}</span>}
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
