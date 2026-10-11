import React, { useMemo, useState } from 'react';
import { Megaphone, Pin, ChevronDown } from 'lucide-react';
import { Card, Badge, cx } from './ui';
import { NOTICE_KINDS, activeNotices } from '../lib/notices';
import { fmtDate, todayISO } from '../lib/format';

const SEEN_KEY = 'xi_portal_notices_seen';
const readSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || [];
  } catch {
    return [];
  }
};

/** The class notices on the student's home screen: newest and pinned first; new ones are marked until opened */
export function NoticeBoard({ notices = [] }) {
  const list = useMemo(() => activeNotices(notices, todayISO()), [notices]);
  const [seen, setSeen] = useState(readSeen);
  const [open, setOpen] = useState(null);
  if (list.length === 0) return null;

  const toggle = (n) => {
    const next = open === n.id ? null : n.id;
    setOpen(next);
    if (next && !seen.includes(n.id)) {
      const all = [...seen, n.id].slice(-200);
      setSeen(all);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(all));
      } catch {
        /* private mode: the "new" mark just stays */
      }
    }
  };
  const fresh = list.filter((n) => !seen.includes(n.id)).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <Megaphone className="h-5 w-5 text-brand-600" />
        <p className="text-[15px] font-bold text-ink">নোটিশ</p>
        {fresh > 0 && <Badge tone="red">{fresh}টি নতুন</Badge>}
      </div>
      <div className="divide-y divide-slate-100">
        {list.map((n) => {
          const k = NOTICE_KINDS[n.kind] || NOTICE_KINDS.general;
          const isNew = !seen.includes(n.id);
          const expanded = open === n.id;
          return (
            <button key={n.id} type="button" onClick={() => toggle(n)} className="press block w-full px-5 py-3.5 text-left">
              <span className="flex items-start gap-3">
                <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', k.tile)}>
                  <Megaphone className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[14.5px] font-bold leading-snug text-ink">
                    {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                    <span className="min-w-0">{n.title}</span>
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="নতুন" />}
                  </span>
                  <span className={cx('mt-0.5 block whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600', !expanded && 'line-clamp-2')}>{n.text}</span>
                  <span className="mt-1 block text-[12px] text-slate-400">{fmtDate(String(n.createdAt).slice(0, 10))}</span>
                </span>
                <ChevronDown className={cx('mt-1 h-4 w-4 shrink-0 text-slate-300 transition', expanded && 'rotate-180')} />
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
