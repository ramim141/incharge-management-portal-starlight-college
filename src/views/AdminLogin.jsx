import React, { useState } from 'react';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowLeft, Zap, Building2, UserRound, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { isDemo, errorText } from '../backend';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../backend/demoSeed';
import { Button, Field, Input, cx } from '../components/ui';

const Hero = ({ title, subtitle, onPortal }) => (
  <>
    <button
      type="button"
      onClick={onPortal}
      className="press mt-4 inline-flex h-10 items-center gap-1.5 self-start rounded-full bg-white/15 pl-3 pr-4 text-[14px] font-semibold text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      শিক্ষার্থী পোর্টাল
    </button>
    <div className="mt-8 text-white max-[374px]:mt-5">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
        <GraduationCap className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-[28px] font-extrabold leading-tight max-[374px]:text-[24px]">{title}</h1>
      {subtitle && <p className="mt-1 text-[14px] text-white/75">{subtitle}</p>}
    </div>
  </>
);

const Shell = ({ children }) => (
  <div className="relative min-h-dvh overflow-hidden bg-canvas">
    <div className="absolute inset-x-0 top-0 h-[46dvh] rounded-b-[44px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
    <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
    <div className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pb-8 pt-safe">{children}</div>
  </div>
);

const IconInput = ({ icon: Icon, right, className, ...props }) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
    <Input {...props} className={cx('pl-12', right && 'pr-12', className)} />
    {right}
  </div>
);

export const AdminLogin = ({ onPortal }) => {
  const { signIn, resetPassword, institution, needsSetup } = useAuth();
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  if (needsSetup && !isDemo) return <FirstSetup onPortal={onPortal} />;

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const login = async (e, creds) => {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    if (!em || !pw) return fail('ইমেইল ও পাসওয়ার্ড দিন');
    setBusy(true);
    try {
      await signIn(em, pw);
    } catch (err) {
      fail(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) return fail('আগে আপনার ইমেইল লিখুন');
    try {
      await resetPassword(email);
      toast(`${email} এ পাসওয়ার্ড বদলানোর লিংক পাঠানো হয়েছে`);
    } catch (err) {
      fail(errorText(err));
    }
  };

  return (
    <Shell>
      <Hero title="শিক্ষক লগইন" subtitle={institution?.name || 'অধ্যক্ষ ও ক্লাস ইনচার্জদের জন্য'} onPortal={onPortal} />

      <form onSubmit={login} className={cx('mt-7 space-y-4 rounded-[28px] bg-white p-5 shadow-xl', shake && 'animate-shake')}>
        <Field label="ইমেইল">
          <IconInput icon={Mail} type="email" inputMode="email" autoComplete="username" autoCapitalize="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu.bd" />
        </Field>
        <Field label="পাসওয়ার্ড" error={error}>
          <IconInput
            icon={Lock}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="••••••••"
            right={
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-500"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />
        </Field>
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'যাচাই হচ্ছে…' : 'প্রবেশ করুন'}
        </Button>
        {!isDemo && (
          <button type="button" onClick={forgot} className="block w-full text-center text-[13.5px] font-semibold text-brand-600">
            পাসওয়ার্ড ভুলে গেছেন?
          </button>
        )}
      </form>

      {isDemo && (
        <div className="mt-5 rounded-3xl bg-white/80 p-4 ring-1 ring-slate-200">
          <div className="mb-3 flex items-center gap-2 text-[13px] text-slate-600">
            <Zap className="h-4 w-4 text-amber-500" />
            ডেমো অ্যাকাউন্ট — ট্যাপ করলেই প্রবেশ (পাসওয়ার্ড <span className="tabular font-bold text-ink">{DEMO_PASSWORD}</span>)
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => login(null, { email: a.email, password: DEMO_PASSWORD })}
                className="press flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-slate-200"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-ink">{a.label}</span>
                  <span className="block truncate text-[12.5px] text-slate-500">{a.email}</span>
                </span>
                <ArrowLeft className="h-4 w-4 rotate-180 text-slate-300" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
};

/** First run on a new Firebase project: create the principal (super admin) account */
function FirstSetup({ onPortal }) {
  const { bootstrap } = useAuth();
  const [f, setF] = useState({ institutionName: '', name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.institutionName || !f.name || !f.email || f.password.length < 6) return setError('সব ঘর পূরণ করুন (পাসওয়ার্ড কমপক্ষে ৬ অক্ষর)');
    setBusy(true);
    try {
      await bootstrap(f);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Hero title="প্রথমবার সেটআপ" subtitle="প্রতিষ্ঠান ও অধ্যক্ষের (প্রধান Admin) অ্যাকাউন্ট তৈরি করুন" onPortal={onPortal} />
      <form onSubmit={submit} className="mt-7 space-y-4 rounded-[28px] bg-white p-5 shadow-xl">
        <Field label="প্রতিষ্ঠানের নাম">
          <IconInput icon={Building2} value={f.institutionName} onChange={set('institutionName')} placeholder="যেমন ঢাকা মডেল কলেজ" />
        </Field>
        <Field label="অধ্যক্ষের নাম">
          <IconInput icon={UserRound} value={f.name} onChange={set('name')} />
        </Field>
        <Field label="মোবাইল">
          <IconInput icon={Phone} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
        </Field>
        <Field label="ইমেইল (লগইনের জন্য)">
          <IconInput icon={Mail} type="email" autoCapitalize="off" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="পাসওয়ার্ড" hint="কমপক্ষে ৬ অক্ষর" error={error}>
          <IconInput icon={Lock} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'তৈরি হচ্ছে…' : 'সেটআপ সম্পন্ন করুন'}
        </Button>
        <p className="text-center text-[12.5px] text-slate-500">এটি একবারই করতে হবে। এরপর অধ্যক্ষ ক্লাস ও শিক্ষকদের অ্যাকাউন্ট তৈরি করবেন।</p>
      </form>
    </Shell>
  );
}
