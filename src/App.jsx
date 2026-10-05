import React, { useEffect, useState } from 'react';
import { GraduationCap, LogOut, UserX, School } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { UIProvider, useUI } from './context/UIContext';
import { backend, errorText } from './backend';
import { AppShell } from './components/AppShell';
import { PaymentSheet } from './components/PaymentSheet';
import { ReceiptSheet } from './components/ReceiptSheet';
import { WhatsAppSheet } from './components/WhatsAppSheet';
import { StudentDetailSheet, StudentFormSheet } from './components/StudentSheets';
import { Button } from './components/ui';
import { StudentPortal } from './views/StudentPortal';
import { AdminLogin } from './views/AdminLogin';
import { PrincipalApp } from './views/principal/PrincipalApp';
import { AdminDashboard } from './views/AdminDashboard';
import { StudentsView } from './views/StudentsView';
import { AttendanceView } from './views/AttendanceView';
import { FeesView } from './views/FeesView';
import { PaymentsView } from './views/PaymentsView';
import { DueStudentsView } from './views/DueStudentsView';
import { ExamFineView } from './views/ExamFineView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

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
};

const VIEW_KEY = 'xi_view';

export function Splash({ text = 'লোড হচ্ছে…' }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-16 w-16 animate-pulse place-items-center rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift">
          <GraduationCap className="h-8 w-8" />
        </div>
        <p className="text-[14px] font-medium text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function Notice({ icon: Icon, title, text, onSignOut }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-slate-500 ring-1 ring-slate-200 shadow-card">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[20px] font-extrabold text-ink">{title}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-slate-500">{text}</p>
        <Button variant="secondary" icon={LogOut} className="mt-6" onClick={onSignOut}>
          লগআউট
        </Button>
      </div>
    </div>
  );
}

function ClassViews() {
  const { activeTab, loading, classDoc, exitClass, signOut } = useApp();
  if (loading) return <Splash text="ক্লাসের তথ্য আনা হচ্ছে…" />;
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
  const View = VIEWS[activeTab] || AdminDashboard;
  return (
    <>
      <AppShell>
        <View />
      </AppShell>
      {/* Global sheets — any screen can open these through useUI() */}
      <StudentDetailSheet />
      <StudentFormSheet />
      <PaymentSheet />
      <ReceiptSheet />
      <WhatsAppSheet />
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

  if (view === 'portal') return <StudentPortal onStaffLogin={() => setView('staff')} />;
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'signedOut') return <AdminLogin onPortal={() => setView('portal')} />;

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

  if (p.role === 'superadmin' && !visitingClass) {
    return <PrincipalApp onOpenClass={setVisitingClass} onOpenPortal={() => setView('portal')} onSignOut={signOut} />;
  }

  const classId = p.role === 'superadmin' ? visitingClass : p.classId;
  if (!classId) {
    return (
      <Notice
        icon={School}
        title={`স্বাগতম, ${p.name || ''}`}
        text="আপনাকে এখনো কোনো ক্লাসের দায়িত্ব দেওয়া হয়নি। অধ্যক্ষ ক্লাস দিলে এখানে আপনাআপনি দেখা যাবে।"
        onSignOut={signOut}
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

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <Root />
      </UIProvider>
    </AuthProvider>
  );
}
