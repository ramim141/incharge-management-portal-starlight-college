import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CreditCard, Calendar, Hash, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { Sheet, Button, Field, Input, cx } from './ui';
import { taka, todayISO, toISODate, METHODS } from '../lib/format';

export function PaymentEditSheet() {
  const { editPayment, closeEditPayment, openReceipt, toast } = useUI();
  const { updatePayment } = useApp();
  const p = editPayment;

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [trxId, setTrxId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (p) {
      setAmount(String(p.amount ?? ''));
      setMethod(p.method || 'Cash');
      setTrxId(p.trxId || '');
      setPaymentDate(p.paymentDate ? toISODate(new Date(p.paymentDate)) : todayISO());
      setDesc(p.items?.map((it) => it.description).join(', ') || '');
      setErr('');
    }
  }, [p]);

  if (!p) return null;

  const save = async () => {
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) {
      setErr('সঠিক টাকার পরিমাণ দিন');
      return;
    }
    setSaving(true);
    try {
      const dateObj = paymentDate ? new Date(paymentDate) : new Date();
      // Keep existing time or now
      const orig = p.paymentDate ? new Date(p.paymentDate) : new Date();
      dateObj.setHours(orig.getHours(), orig.getMinutes());

      const items = desc.trim()
        ? [{ description: desc.trim(), amount: numAmt }]
        : p.items;

      const updated = await updatePayment(p.id, {
        amount: numAmt,
        method,
        trxId: method === 'Cash' ? '' : trxId.trim(),
        paymentDate: dateObj.toISOString(),
        items,
      });

      toast('পেমেন্ট ও ডাটাবেজ সফলভাবে আপডেট করা হয়েছে');
      closeEditPayment();
      if (updated) {
        openReceipt(updated);
      }
    } catch (e) {
      setErr('আপডেট করতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={!!p}
      onClose={closeEditPayment}
      title="পেমেন্ট সম্পাদনা"
      subtitle={`${p.studentName} (রোল ${p.roll}) · ${p.receiptNo}`}
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={closeEditPayment} disabled={saving}>
            বাতিল
          </Button>
          <Button icon={Save} onClick={save} disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-2xl bg-amber-50 p-3.5 text-[13px] text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-start gap-2 leading-relaxed">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              টাকার পরিমাণ পরিবর্তন করলে শিক্ষার্থীর সংশ্লিষ্ট ফি, জরিমানা বা বকেয়ার হিসাব ডাটাবেজে স্বয়ংক্রিয়ভাবে সমন্বয় হবে।
            </span>
          </p>
        </div>

        {err && (
          <div className="rounded-xl bg-rose-50 p-3 text-[13px] text-rose-700 ring-1 ring-rose-200">
            {err}
          </div>
        )}

        <Field label="টাকার পরিমাণ (৳)" required>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErr('');
            }}
            placeholder="যেমন 1000"
            className="text-[17px] font-bold"
          />
        </Field>

        <Field label="পেমেন্ট মাধ্যম">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={cx(
                    'press rounded-2xl py-2.5 text-center text-[13.5px] font-semibold transition',
                    active
                      ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-600'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200',
                  )}
                >
                  {m.bn}
                </button>
              );
            })}
          </div>
        </Field>

        {method !== 'Cash' && (
          <Field label="ট্রানজেকশন আইডি (TrxID) বা নোট">
            <Input
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              placeholder="যেমন BK92841029"
            />
          </Field>
        )}

        <Field label="পেমেন্টের তারিখ">
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </Field>

        <Field label="ফি বিবরণ">
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="যেমন অক্টোবর ২০২৬ মাসিক বেতন"
          />
        </Field>
      </div>
    </Sheet>
  );
}
