import React, { useState } from 'react';
import {
  House, Users, CalendarCheck, LayoutGrid, Plus, CreditCard, TriangleAlert, ClipboardList,
  ReceiptText, ChartColumn, Settings, LogOut, UserRound, ChevronRight, Database, ArrowLeft, Building2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { useBackHandler } from '../lib/backstack';
import { Sheet, Avatar, cx, CONTAINER, GUTTER } from './ui';

const TABS = [
  { id: 'dashboard', label: 'হোম', icon: House },
  { id: 'students', label: 'শিক্ষার্থী', icon: Users },
  { id: 'fab' },
  { id: 'attendance', label: 'হাজিরা', icon: CalendarCheck },
  { id: 'more', label: 'মেনু', icon: LayoutGrid },
];

const MENU = [
  { id: 'due', label: 'বকেয়া ও রিমাইন্ডার', hint: 'WhatsApp নোটিশ', icon: TriangleAlert, color: 'bg-rose-50 text-rose-600' },
  { id: 'fees', label: 'মাসিক বেতন', hint: 'মাসভিত্তিক হিসাব', icon: CreditCard, color: 'bg-brand-50 text-brand-600' },
  { id: 'payments', label: 'পেমেন্ট ও রশিদ', hint: 'লেনদেনের ইতিহাস', icon: ReceiptText, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'exams', label: 'পরীক্ষা ও জরিমানা', hint: 'ফি, জরিমানা, মওকুফ', icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
  { id: 'reports', label: 'রিপোর্ট', hint: 'PDF ও Excel', icon: ChartColumn, color: 'bg-sky-50 text-sky-600' },
  { id: 'settings', label: 'সেটিংস', hint: 'ফি নিয়ম, টেমপ্লেট', icon: Settings, color: 'bg-slate-100 text-slate-600' },
];

export function AppShell({ children }) {
  const { activeTab, setActiveTab, overdueCount, settings, isFirestoreConnected, isPrincipal, exitClass, signOut, openPortal, profile } = useApp();
  const { openPayment, confirm } = useUI();
  const [menuOpen, setMenuOpen] = useState(false);

  // Back from any section returns to Home before leaving the app
  useBackHandler(activeTab !== 'dashboard', () => setActiveTab('dashboard'));

  const go = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const isMenuTab = MENU.some((m) => m.id === activeTab);

  const logout = async () => {
    setMenuOpen(false);
    const ok = await confirm({ title: 'লগআউট করবেন?', message: 'আবার প্রবেশ করতে পাসওয়ার্ড লাগবে।', confirmText: 'লগআউট', tone: 'danger', icon: LogOut });
    if (ok) signOut();
  };

  return (
    <>
      <main className={cx('mx-auto min-h-dvh', CONTAINER, GUTTER)} style={{ paddingBottom: 'calc(104px + env(safe-area-inset-bottom) + var(--nav-lift, 0px))' }}>
        {isPrincipal && (
          // The principal is visiting a class — always show where they are and a way back
          <div className="no-print -mx-4 flex items-center gap-2 bg-ink px-4 py-2 text-white sm:-mx-6 sm:px-6" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
            <Building2 className="h-4 w-4 shrink-0 text-brand-300" />
            <p className="min-w-0 flex-1 truncate text-[13px]">
              অধ্যক্ষ হিসেবে দেখছেন · <span className="font-semibold">{settings.className}</span>
            </p>
            <button type="button" onClick={exitClass} className="press flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 text-[12.5px] font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" /> সব ক্লাস
            </button>
          </div>
        )}
        <div key={activeTab} className="animate-fade">{children}</div>
      </main>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-slate-200/70 bg-white/90 shadow-nav backdrop-blur-xl md:bottom-4 md:max-w-[520px] md:rounded-[26px] md:border md:pb-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid h-[68px] grid-cols-5 max-[374px]:h-[62px]">
          {TABS.map((t) => {
            if (t.id === 'fab') {
              return (
                <div key="fab" className="relative flex justify-center">
                  <button
                    type="button"
                    onClick={() => openPayment()}
                    aria-label="টাকা আদায়"
                    className="press absolute -top-6 flex flex-col items-center"
                  >
                    <span className="grid h-[60px] w-[60px] place-items-center rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift ring-[5px] ring-canvas max-[374px]:h-[52px] max-[374px]:w-[52px] max-[374px]:rounded-[18px] md:ring-white">
                      <Plus className="h-7 w-7" strokeWidth={2.6} />
                    </span>
                    <span className="mt-1 text-[11.5px] font-bold text-brand-700">আদায়</span>
                  </button>
                </div>
              );
            }
            const active = t.id === 'more' ? menuOpen || isMenuTab : activeTab === t.id && !menuOpen;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => (t.id === 'more' ? setMenuOpen(true) : go(t.id))}
                className="relative flex flex-col items-center justify-center gap-1"
              >
                <span className={cx('grid h-8 w-14 place-items-center rounded-full transition max-[374px]:w-11', active ? 'bg-brand-50 text-brand-700' : 'text-slate-400')}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={cx('text-[11.5px] font-semibold max-[374px]:text-[10.5px]', active ? 'text-brand-700' : 'text-slate-500')}>{t.label}</span>
                {t.id === 'more' && overdueCount > 0 && (
                  <span className="absolute right-[22%] top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="pt-2">
          <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
            <Avatar name={profile?.name || settings.inchargeName} seed={profile?.uid || 'incharge'} size={52} className="ring-2 ring-white/30" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold">{profile?.name || settings.inchargeName}</p>
              <p className="truncate text-[12.5px] text-white/75">
                {isPrincipal ? 'অধ্যক্ষ' : 'ক্লাস ইনচার্জ'} · {settings.className}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {MENU.map((m) => {
              const Icon = m.icon;
              const active = activeTab === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => go(m.id)}
                  className={cx(
                    'press relative flex flex-col items-start gap-3 rounded-3xl p-4 text-left ring-1 ring-inset',
                    active ? 'bg-brand-50/60 ring-brand-200' : 'bg-white ring-slate-200/80',
                  )}
                >
                  <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', m.color)}>
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold leading-tight text-ink">{m.label}</span>
                    <span className="block text-[12.5px] text-slate-500">{m.hint}</span>
                  </span>
                  {m.id === 'due' && overdueCount > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-rose-500 px-2 text-[12px] font-bold leading-5 text-white">{overdueCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-3xl ring-1 ring-slate-200/80">
            {isPrincipal && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  exitClass();
                }}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
              >
                <Building2 className="h-5 w-5 text-brand-600" />
                <span className="flex-1 text-[15px] font-semibold text-ink">সব ক্লাসে ফিরুন</span>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openPortal();
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50"
            >
              <UserRound className="h-5 w-5 text-slate-500" />
              <span className="flex-1 text-[15px] font-semibold text-ink">শিক্ষার্থী পোর্টাল দেখুন</span>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </button>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Database className="h-5 w-5 text-slate-500" />
              <span className="flex-1 text-[15px] font-semibold text-ink">ডাটাবেজ</span>
              <span className={cx('text-[13px] font-semibold', isFirestoreConnected ? 'text-emerald-600' : 'text-amber-600')}>
                {isFirestoreConnected ? '● Cloud সংযুক্ত' : '● ডেমো (এই ফোনে)'}
              </span>
            </div>
            <button type="button" onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-rose-50">
              <LogOut className="h-5 w-5 text-rose-500" />
              <span className="flex-1 text-[15px] font-semibold text-rose-600">লগআউট</span>
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
