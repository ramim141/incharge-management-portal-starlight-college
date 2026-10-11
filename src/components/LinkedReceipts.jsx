import React from 'react';
import { Pencil, Undo2, Receipt } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Button } from './ui';
import { taka, fmtDate } from '../lib/format';

/** The receipts that paid an exam fee / fine: open, correct the amount or date, or cancel one (money goes back to "due") */
export function LinkedReceipts({ match }) {
  const { payments, deletePayment } = useApp();
  const { openReceipt, openEditPayment, confirm, toast } = useUI();
  const list = payments.filter(match).sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));
  if (list.length === 0) return null;

  const cancel = async (p) => {
    const ok = await confirm({
      title: 'রশিদ বাতিল করবেন?',
      message: `${p.receiptNo} — ${taka(p.amount)} আবার বাকি হিসেবে ফিরে যাবে।`,
      confirmText: 'বাতিল করুন',
      tone: 'danger',
      icon: Undo2,
    });
    if (!ok) return;
    await deletePayment(p.id);
    toast('রশিদ বাতিল হয়েছে, টাকা আবার বাকি');
  };

  return (
    <div className="space-y-2">
      <p className="text-[13.5px] font-semibold text-slate-700">আদায়ের রশিদ</p>
      {list.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
          <button type="button" onClick={() => openReceipt(p)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <Receipt className="h-5 w-5 shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="tabular block truncate text-[14px] font-bold text-ink">
                {taka(p.amount)} · {p.receiptNo}
              </span>
              <span className="block text-[12px] text-slate-500">{fmtDate(p.paymentDate)}</span>
            </span>
          </button>
          <Button size="sm" variant="secondary" icon={Pencil} aria-label="সম্পাদনা" className="w-10 px-0" onClick={() => openEditPayment(p)} />
          <Button size="sm" variant="soft-danger" icon={Undo2} aria-label="বাতিল" className="w-10 px-0" onClick={() => cancel(p)} />
        </div>
      ))}
    </div>
  );
}
