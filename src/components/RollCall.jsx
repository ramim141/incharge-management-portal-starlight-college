import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CheckCheck, Save, X } from 'lucide-react';
import { Card, RollBadge, Button, Progress, cx } from './ui';
import { WhatsAppIcon } from './ReceiptSheet';
import { studentTags, ATT_STATUS, ATT_ORDER, fmtDate, taka } from '../lib/format';

const PICK = {
  Present: 'bg-emerald-500 text-white',
  Absent: 'bg-rose-500 text-white',
  Late: 'bg-amber-400 text-white',
  Leave: 'bg-sky-500 text-white',
};
const NUM = { Present: 'text-emerald-600', Absent: 'text-rose-600', Late: 'text-amber-500', Leave: 'text-sky-600' };

// Full-screen "one student at a time" roll call. step === list.length is the summary page.
export function RollCall({ list, step, records, getStats, fineFor, counts, rate, dirty, date, onPick, onStep, onSave, onWhatsApp, isAbsentMsgDone, onClose }) {
  const [flash, setFlash] = useState(null);
  const total = list.length;
  const done = step >= total;
  const stu = list[step];
  const current = stu ? records[stu.id] : null;
  const stats = stu ? getStats(stu.id) : null;
  const fine = stu ? fineFor(stu) : 0;
  const absentees = done ? list.filter((x) => (records[x.id] || 'Present') === 'Absent') : [];

  const choose = (k) => {
    if (flash) return;
    setFlash(k);
    setTimeout(() => {
      setFlash(null);
      onPick(k);
    }, 180);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-canvas pt-safe" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-4">
        <div className="flex items-center gap-3 pb-3 pt-4">
          <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="press grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-600">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="tabular text-[13px] font-semibold text-slate-500">
              {done ? 'সম্পূর্ণ' : `${step + 1} / ${total}`} · {fmtDate(date, { year: false })}
            </p>
            <Progress value={(step / total) * 100} tone="brand" className="mt-1.5 h-1.5" />
          </div>
        </div>

        {!done ? (
          <>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <RollBadge roll={stu.roll} seed={stu.id} size={84} />
              <h2 className="mt-5 px-2 text-[26px] font-extrabold leading-tight text-ink">{stu.name}</h2>
              <p className="mt-1.5 text-[14px] text-slate-500">{studentTags(stu) || `রোল ${stu.roll}`}</p>
              {stats && stats.totalClasses > 0 && (
                <div className="tabular mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-slate-600">
                  <span>উপস্থিতি {Math.round(stats.percentage)}%</span>
                  <span className="text-slate-300">|</span>
                  <span>অনুপস্থিত {stats.absent} দিন</span>
                </div>
              )}
              {fine > 0 && <p className="tabular mt-2 text-[12.5px] text-rose-600">অনুপস্থিত হলে জরিমানা {taka(fine)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              {ATT_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => choose(k)}
                  className={cx('press h-[72px] rounded-2xl text-[18px] font-extrabold transition', (flash || current) === k ? PICK[k] : 'bg-white text-ink')}
                >
                  {ATT_STATUS[k].bn}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3">
              <button type="button" disabled={step === 0} onClick={() => onStep(step - 1)} className="press flex h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-semibold text-slate-500 disabled:opacity-30">
                <ChevronLeft className="h-5 w-5" /> আগের জন
              </button>
              <button type="button" onClick={() => onStep(step + 1)} className="press flex h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-semibold text-slate-500">
                এড়িয়ে যান <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              <div className="mt-2 text-center">
                <span className={cx('mx-auto grid h-14 w-14 place-items-center rounded-full', dirty ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                  <CheckCheck className="h-7 w-7" />
                </span>
                <h2 className="mt-3 text-[22px] font-extrabold text-ink">{dirty ? 'সংরক্ষণ বাকি' : 'হাজিরা সংরক্ষিত'}</h2>
                <p className="tabular text-[14px] text-slate-500">
                  {counts.Present + counts.Late}/{total} উপস্থিত · {rate}%
                </p>
              </div>
              <div className="mt-5 grid grid-cols-4 divide-x divide-slate-100 rounded-2xl bg-white py-3">
                {ATT_ORDER.map((k) => (
                  <div key={k} className="text-center">
                    <p className={cx('tabular text-[22px] font-extrabold leading-tight', NUM[k])}>{counts[k]}</p>
                    <p className="text-[12px] text-slate-500">{ATT_STATUS[k].bn}</p>
                  </div>
                ))}
              </div>
              {absentees.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[13px] font-bold text-rose-700">অনুপস্থিত ({absentees.length})</p>
                  <Card className="divide-y divide-slate-100 overflow-hidden">
                    {absentees.map((x) => (
                      <div key={x.id} className="flex items-center gap-2.5 px-3 py-2.5">
                        <RollBadge roll={x.roll} seed={x.id} size={38} />
                        <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">{x.name}</p>
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </div>
            <div className="space-y-2.5 pt-2">
              {dirty && (
                <Button size="lg" block variant="success" icon={Save} onClick={onSave}>
                  সংরক্ষণ করুন
                </Button>
              )}
              {absentees.length > 0 && (
                <Button
                  size="lg"
                  block
                  variant={isAbsentMsgDone ? 'soft-success' : 'soft-danger'}
                  icon={isAbsentMsgDone ? Check : WhatsAppIcon}
                  onClick={onWhatsApp}
                >
                  {isAbsentMsgDone ? 'মেসেজ পাঠানো সম্পন্ন' : 'অভিভাবকদের WhatsApp পাঠান'}
                </Button>
              )}
              <div className="flex gap-2.5">
                <Button size="lg" variant="secondary" className="flex-1" onClick={() => onStep(total - 1)}>
                  সম্পাদনা
                </Button>
                <Button size="lg" className="flex-1" onClick={onClose}>
                  শেষ
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
