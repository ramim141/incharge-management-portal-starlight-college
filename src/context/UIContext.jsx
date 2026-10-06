import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Sheet, Button } from '../components/ui';

// App-wide UI state: toasts, confirmation sheets and the global sheets
// (student profile, student form, payment, receipt, WhatsApp, fine editor) that any screen can open.
const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const [studentId, setStudentId] = useState(null);
  const [studentForm, setStudentForm] = useState(null); // { student: obj | null }
  const [payment, setPayment] = useState(null); // { student: obj | null }
  const [receipt, setReceipt] = useState(null); // { payment, fresh }
  const [whatsapp, setWhatsapp] = useState(null); // students[]
  const [fineId, setFineId] = useState(null);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  );

  const closeConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const value = useMemo(
    () => ({
      toast,
      confirm,
      studentId,
      openStudent: (s) => setStudentId(s?.id ?? s),
      closeStudent: () => setStudentId(null),
      studentForm,
      openStudentForm: (student = null) => setStudentForm({ student }),
      closeStudentForm: () => setStudentForm(null),
      payment,
      openPayment: (student = null) => setPayment({ student }),
      closePayment: () => setPayment(null),
      receipt,
      openReceipt: (p, fresh = false) => setReceipt({ payment: p, fresh }),
      closeReceipt: () => setReceipt(null),
      whatsapp,
      openWhatsApp: (list) => setWhatsapp(Array.isArray(list) ? list : [list]),
      closeWhatsApp: () => setWhatsapp(null),
      fineId,
      openFine: (f) => setFineId(f?.id ?? f),
      closeFine: () => setFineId(null),
    }),
    [toast, confirm, studentId, studentForm, payment, receipt, whatsapp, fineId],
  );

  const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
  const COLOR = { success: 'text-emerald-400', error: 'text-rose-400', info: 'text-sky-300' };

  return (
    <UIContext.Provider value={value}>
      {children}

      {createPortal(
        <div className="no-print pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
          {toasts.map((t) => {
            const Icon = ICON[t.type] || Info;
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto flex w-full max-w-[440px] animate-toast items-center gap-3 rounded-2xl bg-ink/95 px-4 py-3.5 text-[14.5px] font-medium text-white shadow-2xl backdrop-blur"
              >
                <Icon className={`h-5 w-5 shrink-0 ${COLOR[t.type]}`} />
                <span className="leading-snug">{t.message}</span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}

      <Sheet open={!!confirmState} onClose={() => closeConfirm(false)}>
        {confirmState && (
          <div className="pb-1 pt-3 text-center">
            {confirmState.icon && (
              <div
                className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl ${
                  confirmState.tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'
                }`}
              >
                <confirmState.icon className="h-8 w-8" />
              </div>
            )}
            <h3 className="text-[19px] font-extrabold text-ink">{confirmState.title}</h3>
            {confirmState.message && <p className="mx-auto mt-1.5 max-w-xs text-[14.5px] text-slate-500">{confirmState.message}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText || 'বাতিল'}
              </Button>
              <Button variant={confirmState.tone === 'danger' ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
                {confirmState.confirmText || 'নিশ্চিত'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
