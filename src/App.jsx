import React, { useEffect, useState, lazy, Suspense, Activity } from 'react';
import { LogOut, UserX, School, Settings2, KeyRound, Mail } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { UIProvider, useUI } from './context/UIContext';
import { backend, backendMissing, errorText } from './backend';
import { AppShell } from './components/AppShell';
import { ForcePasswordChange, AccountSheet } from './components/AccountSheets';
import { InstallPrompt } from './components/InstallPrompt';
import { Button, Logo } from './components/ui';
import { PageSkeleton, ShellSkeleton } from './components/Skeletons';
import { SyncStatus } from './components/SyncStatus';
import { Notifier } from './components/Notifier';

// Lazy-loaded views for code splitting
// Staff sessions: start downloading the main screens right away, in parallel with sign-in
if (typeof window !== 'undefined' && localStorage.getItem('xi_view') === 'staff') {
  import('./views/AdminDashboard');
  import('./views/principal/PrincipalApp');
}

// Global sheets: fetched right after the first screen is up, not part of the first download
const PaymentSheet = lazy(() => import('./components/PaymentSheet').then((m) => ({ default: m.PaymentSheet })));
const PaymentEditSheet = lazy(() => import('./components/PaymentEditSheet').then((m) => ({ default: m.PaymentEditSheet })));
const ReceiptSheet = lazy(() => import('./components/ReceiptSheet').then((m) => ({ default: m.ReceiptSheet })));
const WhatsAppSheet = lazy(() => import('./components/WhatsAppSheet').then((m) => ({ default: m.WhatsAppSheet })));
const DayCloseSheet = lazy(() => import('./components/DayCloseSheet').then((m) => ({ default: m.DayCloseSheet })));
const FineSheet = lazy(() => import('./components/FineSheet').then((m) => ({ default: m.FineSheet })));
const StudentDetailSheet = lazy(() => import('./components/StudentSheets').then((m) => ({ default: m.StudentDetailSheet })));
const StudentFormSheet = lazy(() => import('./components/StudentSheets').then((m) => ({ default: m.StudentFormSheet })));

const StudentPortal = lazy(() => import('./views/StudentPortal').then((m) => ({ default: m.StudentPortal })));
const AdminLogin = lazy(() => import('./views/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const PrincipalApp = lazy(() => import('./views/principal/PrincipalApp').then((m) => ({ default: m.PrincipalApp })));
const AdminDashboard = lazy(() => import('./views/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const StudentsView = lazy(() => import('./views/StudentsView').then((m) => ({ default: m.StudentsView })));
const AttendanceView = lazy(() => import('./views/AttendanceView').then((m) => ({ default: m.AttendanceView })));
const FeesView = lazy(() => import('./views/FeesView').then((m) => ({ default: m.FeesView })));
const PaymentsView = lazy(() => import('./views/PaymentsView').then((m) => ({ default: m.PaymentsView })));
const DueStudentsView = lazy(() => import('./views/DueStudentsView').then((m) => ({ default: m.DueStudentsView })));
const ExamFineView = lazy(() => import('./views/ExamFineView').then((m) => ({ default: m.ExamFineView })));
const ReportsView = lazy(() => import('./views/ReportsView').then((m) => ({ default: m.ReportsView })));
const LeavesView = lazy(() => import('./views/LeavesView').then((m) => ({ default: m.LeavesView })));
const NoticesView = lazy(() => import('./views/NoticesView').then((m) => ({ default: m.NoticesView })));
const AuditView = lazy(() => import('./views/AuditView').then((m) => ({ default: m.AuditView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));

const VIEWS = {
  dashboard: AdminDashboard,
  students: StudentsView,
  attendance: AttendanceView,
  fees: FeesView,
  payments: PaymentsView,
  due: DueStudentsView,
  exams: ExamFineView,
  reports: ReportsView,
  settings: SettingsView,
  audit: AuditView,
  leaves: LeavesView,
  notices: NoticesView,
};

const VIEW_KEY = 'xi_view';

export function Splash({ text = 'লোড হচ্ছে…' }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <Logo size={88} className="animate-pulse drop-shadow-md" />
        <p className="text-[14px] font-medium text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function Notice({ icon: Icon, title, text, onSignOut, account }) {
  const [sheet, setSheet] = useState(null);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-slate-500 ring-1 ring-slate-200 shadow-card">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[20px] font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">{text}</p>
        {account && (
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => setSheet('password')}>
              পাসওয়ার্ড বদলান
            </Button>
            <Button variant="secondary" size="sm" icon={Mail} onClick={() => setSheet('email')}>
              রিকভারি ইমেইল
            </Button>
          </div>
        )}
        <Button variant="secondary" icon={LogOut} className={account ? 'mt-3' : 'mt-6'} onClick={onSignOut}>
          লগআউট
        </Button>
      </div>
      {account && <AccountSheet kind={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function ClassViews() {
  const { activeTab, loading, classDoc, exitClass, signOut } = useApp();
  // Sections stay mounted once opened (just hidden), so switching back is instant and keeps filters, scroll and drafts
  const [visited, setVisited] = useState(() => new Set([activeTab]));
  if (!visited.has(activeTab)) setVisited((v) => new Set(v).add(activeTab));

  // Fetch the other sections' code while the app is idle, so the first visit has no loading screen
  useEffect(() => {
    const warm = () => {
      import('./views/StudentsView');
      import('./views/AttendanceView');
      import('./views/FeesView');
      import('./views/PaymentsView');
      import('./views/DueStudentsView');
      import('./views/ExamFineView');
      import('./views/ReportsView');
      import('./views/SettingsView');
      import('./views/AuditView');
      import('./views/LeavesView');
      import('./views/NoticesView');
    };
    const id = window.requestIdleCallback ? window.requestIdleCallback(warm) : setTimeout(warm, 1500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  if (loading) return <ShellSkeleton />;
  if (!classDoc) {
    return (
      <Notice
        icon={School}
        title="ক্লাসটি পাওয়া যায়নি"
        text="এই ক্লাসটি মুছে ফেলা হয়েছে বা আপনার অনুমতি নেই। অধ্যক্ষের সাথে যোগাযোগ করুন।"
        onSignOut={exitClass || signOut}
      />
    );
  }
  return (
    <>
      <AppShell>
        {[...visited, ...(visited.has(activeTab) ? [] : [activeTab])].map((id) => {
          const View = VIEWS[id] || AdminDashboard;
          return (
            // Hidden sections keep their state but stop re-rendering on every data change
            <Activity key={id} mode={id === activeTab ? 'visible' : 'hidden'}>
              <div className="animate-fade">
                <Suspense fallback={<PageSkeleton id={id} />}>
                  <View />
                </Suspense>
              </div>
            </Activity>
          );
        })}
      </AppShell>
      <Notifier />
      {/* Global sheets — any screen can open these through useUI() */}
      <Suspense fallback={null}>
        <StudentDetailSheet />
        <StudentFormSheet />
        <PaymentSheet />
        <PaymentEditSheet />
        <ReceiptSheet />
        <WhatsAppSheet />
        <FineSheet />
        <DayCloseSheet />
      </Suspense>
    </>
  );
}

function Root() {
  const auth = useAuth();
  const { toast } = useUI();
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'portal');
  const [visitingClass, setVisitingClass] = useState(null);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Surface background sync / permission errors instead of failing silently
  useEffect(() => backend.onError((e) => toast(errorText(e), 'error')), [toast]);

  const signOut = async () => {
    setVisitingClass(null);
    await auth.signOut();
  };

  if (view === 'portal') {
    return (
      <Suspense fallback={<Splash text="পোর্টাল লোড হচ্ছে…" />}>
        <StudentPortal onStaffLogin={() => setView('staff')} />
      </Suspense>
    );
  }
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'signedOut') {
    return (
      <Suspense fallback={<Splash text="লগইন লোড হচ্ছে…" />}>
        <AdminLogin onPortal={() => setView('portal')} />
      </Suspense>
    );
  }

  const p = auth.profile;
  if (!p.role || p.active === false) {
    return (
      <Notice
        icon={UserX}
        title="অ্যাকাউন্ট সক্রিয় নয়"
        text="আপনার অ্যাকাউন্টটি বন্ধ আছে বা এখনো তৈরি সম্পূর্ণ হয়নি। অধ্যক্ষের সাথে যোগাযোগ করুন।"
        onSignOut={signOut}
      />
    );
  }

  if (p.mustChangePassword) return <ForcePasswordChange onSignOut={signOut} />;

  if (p.role === 'superadmin' && !visitingClass) {
    return (
      <Suspense fallback={<Splash text="অধ্যক্ষ ড্যাশবোর্ড লোড হচ্ছে…" />}>
        <PrincipalApp onOpenClass={setVisitingClass} onOpenPortal={() => setView('portal')} onSignOut={signOut} />
      </Suspense>
    );
  }

  const classId = p.role === 'superadmin' ? visitingClass : p.classId;
  if (!classId) {
    return (
      <Notice
        icon={School}
        title={`স্বাগতম, ${p.name || ''}`}
        text="আপনাকে এখনো কোনো ক্লাসের দায়িত্ব দেওয়া হয়নি। অধ্যক্ষ ক্লাস দিলে এখানে আপনাআপনি দেখা যাবে।"
        onSignOut={signOut}
        account
      />
    );
  }

  return (
    <AppProvider
      key={classId}
      classId={classId}
      profile={p}
      institution={auth.institution}
      onExit={p.role === 'superadmin' ? () => setVisitingClass(null) : null}
      onSignOut={signOut}
      onOpenPortal={() => setView('portal')}
    >
      <ClassViews />
    </AppProvider>
  );
}

/** Shown when the build has no Firebase keys (see .env.example / FIREBASE_SETUP.md) */
function SetupPending() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-50 text-amber-600">
          <Settings2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-[20px] font-extrabold text-ink">Firebase সেটআপ বাকি</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">
          অ্যাপটি চালু করতে প্রজেক্টের <span className="font-mono text-[13px] text-ink">.env.local</span> ফাইলে Firebase কী বসিয়ে আবার build করুন। ধাপগুলো FIREBASE_SETUP.md ফাইলে আছে।
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (backendMissing) return <SetupPending />;
  return (
    <AuthProvider>
      <UIProvider>
        <Root />
        <SyncStatus />
        <InstallPrompt />
      </UIProvider>
    </AuthProvider>
  );
}
