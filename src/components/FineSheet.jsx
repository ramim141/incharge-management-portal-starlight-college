import React, { useState } from 'react';
import { Trash2, Undo2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, RollBadge, Badge, Button, Field, Input, cx } from './ui';
import { taka, fmtDate, FINE_STATUS } from '../lib/format';

/** Edit one fine: change its amount or reason, waive all or part of it (মওকুফ), or undo a waiver */
export function FineSheet() {
  const { fineId, closeFine } = useUI();
  const { fines } = useApp();
  const fine = fines.find((f) => f.id === fineId);
  return (
    <Sheet open={!!fine} onClose={closeFine} title="জরিমানা সম্পাদনা" subtitle={fine ? `${fine.reason} · ${fmtDate(fine.date)}` : ''}>
      {fine && <FineForm key={fine.id} fine={fine} />}
    </Sheet>
  );
}

function FineForm({ fine: f }) {
  const { students, updateFine, deleteFine } = useApp();
  const { closeFine, confirm, toast } = useUI();
  const s = students.find((x) => x.id === f.studentId);

  const [amount, setAmount] = useState(String(f.amount));
  const [reason, setReason] = useState(f.reason || '');
  const [waived, setWaived] = useState(String(f.waived || 0));
  const [note, setNote] = useState(f.waiveNote || '');
  const [saving, setSaving] = useState(false);

  const amt = Number(amount) || 0;
  const w = Number(waived) || 0;
  const maxWaive = Math.max(0, amt - f.paid);
  const due = Math.max(0, amt - f.paid - w);

  let err = '';
  if (amt < f.paid) err = `ইতিমধ্যে ${taka(f.paid)} পরিশোধ হয়েছে — এর কম করা যাবে না`;
  else if (w < 0 || w > maxWaive) err = `সর্বোচ্চ ${taka(maxWaive)} মওকুফ করা যায়`;
  else if (!reason.trim()) err = 'কারণ লিখুন';

  const dirty = amt !== f.amount || w !== f.waived || reason.trim() !== (f.reason || '') || note.trim() !== (f.waiveNote || '');

  const save = async () => {
    if (err || saving) return;
    setSaving(true);
    await updateFine(f.id, { amount: amt, reason: reason.trim(), waived: w, waiveNote: note.trim() });
    setSaving(false);
    toast(w >= maxWaive && maxWaive > 0 ? 'জরিমানা সম্পূর্ণ মওকুফ হয়েছে' : w > 0 ? `${taka(w)} মওকুফ করা হয়েছে` : 'জরিমানা আপডেট হয়েছে');
    closeFine();
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'জরিমানাটি মুছবেন?',
      message: `${s?.name || `রোল ${f.roll}`} — ${taka(f.amount)} (${f.reason})`,
      confirmText: 'মুছে ফেলুন',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    await deleteFine(f.id);
    toast('জরিমানা মুছে ফেলা হয়েছে');
    closeFine();
  };

  const quick = [
    { label: 'মওকুফ নেই', v: 0 },
    { label: 'অর্ধেক', v: Math.round(maxWaive / 2) },
    { label: 'সম্পূর্ণ', v: maxWaive },
  ];

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
        <RollBadge roll={s?.roll ?? f.roll} seed={f.studentId} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-ink">{s?.name || `রোল ${f.roll}`}</p>
          <p className="text-[13px] text-slate-500">{f.kind === 'absent' ? 'অনুপস্থিতির জন্য স্বয়ংক্রিয় জরিমানা' : 'হাতে দেওয়া জরিমানা'}</p>
        </div>
        <Badge tone={FINE_STATUS[f.status].tone}>{FINE_STATUS[f.status].bn}</Badge>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['জরিমানা', amt, 'text-ink'],
          ['মওকুফ', w, 'text-slate-500'],
          ['পরিশোধ', f.paid, 'text-emerald-600'],
          ['বাকি', due, due > 0 ? 'text-rose-600' : 'text-emerald-600'],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-2xl bg-white py-2.5 ring-1 ring-slate-200/70">
            <p className={cx('tabular text-[16px] font-extrabold', c)}>{taka(v)}</p>
            <p className="text-[12px] text-slate-500">{k}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="জরিমানার পরিমাণ (৳)">
          <Input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="মওকুফ (৳)">
          <Input type="number" inputMode="numeric" min={0} value={waived} onChange={(e) => setWaived(e.target.value)} />
        </Field>
      </div>

      <div className="-mt-2 flex gap-2">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setWaived(String(q.v))}
            className={cx('press flex-1 rounded-xl py-2 text-[13.5px] font-bold', w === q.v ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}
          >
            {q.label}
          </button>
        ))}
      </div>

      <Field label="কারণ">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {w > 0 && (
        <Field label="মওকুফের কারণ (ঐচ্ছিক)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="যেমন অসুস্থতার কারণে অনুপস্থিত" />
        </Field>
      )}

      {f.waivedAt && f.waived > 0 && (
        <p className="text-[12.5px] text-slate-500">
          {fmtDate(f.waivedAt)} তারিখে {taka(f.waived)} মওকুফ করা হয়েছে{f.editedBy ? ` · ${f.editedBy}` : ''}
        </p>
      )}

      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{err}</p>}

      <div className="space-y-2.5">
        <Button size="lg" block icon={Save} disabled={!!err || !dirty || saving} onClick={save}>
          {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
        </Button>
        {f.waived > 0 && (
          <Button variant="secondary" block icon={Undo2} onClick={() => setWaived('0')}>
            মওকুফ বাতিল করুন
          </Button>
        )}
        {f.paid === 0 && (
          <Button variant="soft-danger" block icon={Trash2} onClick={remove}>
            জরিমানা মুছে ফেলুন
          </Button>
        )}
      </div>
    </div>
  );
}
