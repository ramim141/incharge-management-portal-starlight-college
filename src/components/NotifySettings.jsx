import React, { useState } from 'react';
import { BellRing, BellOff, Smartphone } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { Button, cx } from './ui';
import { notifySupported, permission, isEnabled, enableNotifications, disableNotifications, showNotification } from '../lib/notify';

/** Turn system notifications on or off, and try one */
export function NotifySettings() {
  const { toast } = useUI();
  const [on, setOn] = useState(isEnabled);
  const [perm, setPerm] = useState(permission);

  if (!notifySupported()) {
    return <p className="rounded-2xl bg-slate-50 p-3.5 text-[13.5px] text-slate-600">এই ব্রাউজারে নোটিফিকেশন চলে না। অ্যাপটি হোম স্ক্রিনে যোগ করে (Install) আবার দেখুন।</p>;
  }

  const turnOn = async () => {
    const r = await enableNotifications();
    setPerm(permission());
    if (r.ok) {
      setOn(true);
      toast('নোটিফিকেশন চালু হয়েছে');
    } else {
      toast(r.reason === 'denied' ? 'ব্রাউজারে নোটিফিকেশন আটকানো আছে — ব্রাউজারের সেটিংস থেকে অনুমতি দিন' : 'অনুমতি দেওয়া হয়নি', 'error');
    }
  };
  const turnOff = () => {
    disableNotifications();
    setOn(false);
    toast('নোটিফিকেশন বন্ধ হয়েছে');
  };

  return (
    <>
      <div className={cx('flex items-start gap-3 rounded-2xl p-3.5 text-[13.5px]', on ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-600')}>
        {on ? <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />}
        <span>
          {on ? (
            <>
              <b>চালু আছে।</b> নতুন ছুটির আবেদন এলে, সকালে আজকের কাজের সারাংশ, হাজিরা বাকি থাকলে এবং বিকেলে ক্যাশ ক্লোজ বাকি থাকলে জানাবে।
            </>
          ) : perm === 'denied' ? (
            'ব্রাউজারে নোটিফিকেশন আটকানো আছে। ব্রাউজারের সাইট সেটিংস থেকে অনুমতি দিয়ে আবার চালু করুন।'
          ) : (
            'চালু করলে নতুন ছুটির আবেদন ও দিনের জরুরি কাজের কথা ফোনেই জানাবে।'
          )}
        </span>
      </div>

      {on ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="secondary"
            onClick={async () => {
              const ok = await showNotification({ title: 'পরীক্ষা নোটিফিকেশন', body: 'নোটিফিকেশন ঠিকমতো কাজ করছে ✓', tag: 'test' });
              if (!ok) toast('নোটিফিকেশন দেখানো যায়নি', 'error');
            }}
          >
            পরীক্ষা করুন
          </Button>
          <Button variant="soft-danger" onClick={turnOff}>
            বন্ধ করুন
          </Button>
        </div>
      ) : (
        <Button block icon={BellRing} disabled={perm === 'denied'} onClick={turnOn}>
          নোটিফিকেশন চালু করুন
        </Button>
      )}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-400">
        <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        অ্যাপ খোলা থাকলে বা ফোনের ব্যাকগ্রাউন্ডে চললে নোটিফিকেশন আসবে। অ্যাপ পুরোপুরি বন্ধ থাকলে আসবে না — সেটার জন্য আলাদা সার্ভার-সেবা লাগে।
      </p>
    </>
  );
}
