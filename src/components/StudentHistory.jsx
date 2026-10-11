import React, { useEffect, useMemo, useState } from 'react';
import { ReceiptText, Gavel, HandCoins, UserX, Clock, CalendarOff, CalendarDays, BellRing, Pencil, UserPlus } from 'lucide-react';
import { backend } from '../backend';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { cx } from './ui';
import { studentTimeline, TIMELINE_GROUPS, groupOfKind } from '../lib/timeline';
import { taka, fmtDate, fmtTime, monthBn, EN_MONTHS, toISODate } from '../lib/format';

const LOOK = {
  payment: { icon: ReceiptText, tile: 'bg-emerald-50 text-emerald-600' },
  admission: { icon: HandCoins, tile: 'bg-emerald-50 text-emerald-600' },
  fine: { icon: Gavel, tile: 'bg-rose-50 text-rose-600' },
  leave: { icon: CalendarDays, tile: 'bg-sky-50 text-sky-600' },
  reminder: { icon: BellRing, tile: 'bg-slate-100 text-slate-500' },
  edit: { icon: Pencil, tile: 'bg-violet-50 text-violet-600' },
  joined: { icon: UserPlus, tile: 'bg-brand-50 text-brand-600' },
};
const ATT_LOOK = { Absent: { icon: UserX, tile: 'bg-rose-50 text-rose-600' }, Late: { icon: Clock, tile: 'bg-amber-50 text-amber-600' }, Leave: { icon: CalendarOff, tile: 'bg-sky-50 text-sky-600' } };

/** One student, everything in order: money, absences, fines, leave, reminders and edits */
export function StudentHistory({ student }) {
  const { payments, fines, fees, attendance, leaves, classId } = useApp();
  const { openReceipt } = useUI();
  const [audit, setAudit] = useState([]);
  const [group, setGroup] = useState('all');

  useEffect(() => backend.subscribeCollection(['classes', classId, 'audit'], (rows) => setAudit(rows || [])), [classId]);

  const events = useMemo(
    () => studentTimeline({ student, payments, fines, fees, attendance, audit, leaves }),
    [student, payments, fines, fees, attendance, audit, leaves],
  );
  const list = events.filter((e) => group === 'all' || groupOfKind(e.kind) === group);

  const months = [];
  list.forEach((e) => {
    const key = toISODate(new Date(e.at)).slice(0, 7);
    const g = months[months.length - 1];
    if (g && g.key === key) g.items.push(e);
    else months.push({ key, items: [e] });
  });

  return (
    <div className="mt-4 space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TIMELINE_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={cx('press h-9 shrink-0 rounded-full px-4 text-[13.5px] font-semibold', group === g.id ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}
          >
            {g.bn}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-[14px] text-slate-400">কোনো রেকর্ড নেই</p>
      ) : (
        months.map((m) => (
          <div key={m.key}>
            <p className="mb-1.5 mt-3 px-1 text-[12.5px] font-bold text-slate-400">
              {monthBn(EN_MONTHS[Number(m.key.slice(5, 7)) - 1])} {m.key.slice(0, 4)}
            </p>
            <div className="relative space-y-2.5 pl-1">
              <span aria-hidden="true" className="absolute bottom-5 left-[22px] top-5 w-px bg-slate-200" />
              {m.items.map((e) => {
                const look = e.kind === 'att' ? ATT_LOOK[e.status] : LOOK[e.kind] || LOOK.edit;
                const Icon = look.icon;
                const tap = e.payment ? () => openReceipt(e.payment) : undefined;
                const Tag = tap ? 'button' : 'div';
                return (
                  <Tag key={e.id} type={tap ? 'button' : undefined} onClick={tap} className={cx('relative flex w-full items-start gap-3 text-left', tap && 'press')}>
                    <span className={cx('relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-white', look.tile)}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cx('text-[14px] font-bold leading-snug', e.tone === 'bad' ? 'text-rose-700' : e.tone === 'good' ? 'text-emerald-700' : 'text-ink')}>{e.title}</span>
                        {e.amount != null && e.amount > 0 && (
                          <span className={cx('tabular shrink-0 text-[14px] font-extrabold', e.kind === 'fine' && e.tone !== 'good' ? 'text-rose-600' : 'text-emerald-600')}>{taka(e.amount)}</span>
                        )}
                      </span>
                      {e.text && <span className="block text-[13px] leading-snug text-slate-600">{e.text}</span>}
                      {e.detail && <span className="tabular block text-[12px] text-slate-500">{e.detail}</span>}
                      <span className="mt-0.5 block text-[11.5px] text-slate-400">
                        {fmtDate(String(e.at).slice(0, 10))}
                        {String(e.at).length > 10 && !String(e.at).includes('T00:00:00') ? ` · ${fmtTime(e.at)}` : ''}
                        {e.by ? ` · ${e.by}` : ''}
                      </span>
                    </span>
                  </Tag>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
