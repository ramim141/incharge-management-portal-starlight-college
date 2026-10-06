import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, Mail, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { errorText, isLocal } from '../backend';
import { isStaffEmail } from '../lib/staffLogin';
import { Sheet, Button, Field, Input, cx } from './ui';

const PasswordInput = ({ value, onChange, placeholder, autoComplete = 'new-password', autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="pl-12 pr-12"
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label="পাসওয়ার্ড দেখুন" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-500">
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
};

/** Current + new password (twice). Used from the menu and on forced first-login change. */
export function ChangePasswordForm({ onDone, firstTime }) {
  const { changePassword } = useAuth();
  const { toast } = useUI();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!cur) return setErr(firstTime ? 'অধ্যক্ষের দেওয়া পাসওয়ার্ড দিন' : 'বর্তমান পাসওয়ার্ড দিন');
    if (next.length < 6) return setErr('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন');
    if (next === cur) return setErr('নতুন পাসওয়ার্ড আগেরটি থেকে আলাদা দিন');
    if (next !== again) return setErr('দুইবার একই পাসওয়ার্ড লিখুন');
    setBusy(true);
    try {
      await changePassword(cur, next);
      toast('পাসওয়ার্ড বদলানো হয়েছে');
      onDone?.();
    } catch (er) {
      setErr(errorText(er));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      <Field label={firstTime ? 'অধ্যক্ষের দেওয়া পাসওয়ার্ড' : 'বর্তমান পাসওয়ার্ড'}>
        <PasswordInput value={cur} onChange={(v) => (setCur(v), setErr(''))} autoComplete="current-password" autoFocus />
      </Field>
      <Field label="নতুন পাসওয়ার্ড" hint="কমপক্ষে ৬ অক্ষর — অন্যরা যেন অনুমান করতে না পারে">
        <PasswordInput value={next} onChange={(v) => (setNext(v), setErr(''))} />
      </Field>
      <Field label="নতুন পাসওয়ার্ড আবার" error={err}>
        <PasswordInput value={again} onChange={(v) => (setAgain(v), setErr(''))} />
      </Field>
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? 'সংরক্ষণ হচ্ছে…' : 'পাসওয়ার্ড সংরক্ষণ'}
      </Button>
    </form>
  );
}

/** Adds a real email so "forgot password" can send a reset link */
export function RecoveryEmailForm({ onDone }) {
  const { addRecoveryEmail, profile, user } = useAuth();
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [cur, setCur] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const current = user?.email && !isStaffEmail(user.email) ? user.email : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('সঠিক ইমেইল দিন');
    if (!cur) return setErr('বর্তমান পাসওয়ার্ড দিন');
    setBusy(true);
    try {
      await addRecoveryEmail(cur, email);
      toast(isLocal ? 'রিকভারি ইমেইল যুক্ত হয়েছে' : `${email.trim()} এ একটি লিংক গেছে — লিংকে চাপলেই যুক্ত হবে`);
      onDone?.();
    } catch (er) {
      setErr(errorText(er));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-1">
      <div className="flex gap-3 rounded-2xl bg-brand-50/70 p-3.5 text-[13.5px] leading-relaxed text-brand-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          পাসওয়ার্ড ভুলে গেলে এই ইমেইলে নতুন পাসওয়ার্ডের লিংক যাবে। লগইন আগের মতোই আইডি{profile?.loginId ? ` (${profile.loginId})` : ''} দিয়ে হবে।
        </p>
      </div>
      {current && <p className="text-[13.5px] text-slate-600">এখনকার রিকভারি ইমেইল: <span className="font-semibold text-ink">{current}</span></p>}
      {profile?.pendingEmail && profile.pendingEmail !== current && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {profile.pendingEmail} এ পাঠানো লিংকে এখনো চাপা হয়নি। লিংকে চাপার পর একবার বের হয়ে আবার লগইন করুন।
        </p>
      )}
      <Field label="ইমেইল">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => (setEmail(e.target.value), setErr(''))} placeholder="you@gmail.com" className="pl-12" />
        </div>
      </Field>
      <Field label="বর্তমান পাসওয়ার্ড" error={err}>
        <PasswordInput value={cur} onChange={(v) => (setCur(v), setErr(''))} autoComplete="current-password" />
      </Field>
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? 'পাঠানো হচ্ছে…' : 'যুক্ত করুন'}
      </Button>
    </form>
  );
}

/** Opens one of the account sheets: kind = 'password' | 'email' | null */
export function AccountSheet({ kind, onClose }) {
  return (
    <>
      <Sheet open={kind === 'password'} onClose={onClose} title="পাসওয়ার্ড বদলান">
        {kind === 'password' && <ChangePasswordForm onDone={onClose} />}
      </Sheet>
      <Sheet open={kind === 'email'} onClose={onClose} title="রিকভারি ইমেইল">
        {kind === 'email' && <RecoveryEmailForm onDone={onClose} />}
      </Sheet>
    </>
  );
}

/** Full screen on a teacher's first login: they must replace the principal's password first */
export function ForcePasswordChange({ onSignOut }) {
  const { profile } = useAuth();
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[440px] px-5 pb-10 pt-safe">
        <div className="mt-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-50 text-brand-600">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold text-ink">নিজের পাসওয়ার্ড দিন</h1>
          <p className="mx-auto mt-1.5 max-w-xs text-[14px] text-slate-500">
            স্বাগতম{profile?.name ? `, ${profile.name}` : ''}! নিরাপত্তার জন্য প্রথমবার ঢোকার পর অধ্যক্ষের দেওয়া পাসওয়ার্ড বদলে নিজের পাসওয়ার্ড দিতে হবে।
          </p>
          {profile?.loginId && (
            <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200">
              লগইন আইডি: <span className="tabular ml-1 text-ink">{profile.loginId}</span>
            </p>
          )}
        </div>
        <div className="mt-6 rounded-[28px] bg-white p-5 shadow-card ring-1 ring-slate-200/70">
          <ChangePasswordForm firstTime />
        </div>
        <button type="button" onClick={onSignOut} className={cx('press mx-auto mt-6 flex items-center gap-2 text-[14px] font-semibold text-slate-500')}>
          <LogOut className="h-4 w-4" /> লগআউট
        </button>
      </div>
    </div>
  );
}
