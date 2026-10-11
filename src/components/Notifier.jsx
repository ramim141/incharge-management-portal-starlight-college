import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { isEnabled, planNotifications, loadState, saveState, showNotification } from '../lib/notify';
import { todayISO } from '../lib/format';
import { dayCloseSummary } from '../lib/dayClose';

/**
 * Runs in the background of the in-charge's app: when something worth a nudge happens (a new leave
 * application) or the time comes for the day's summary, it shows a system notification.
 * Renders nothing. Does nothing unless the in-charge turned notifications on in Settings.
 */
export function Notifier() {
  const { classId, leaves, reminderQueue, attendance, students, payments, closings, setActiveTab } = useApp();
  const latest = useRef(null);
  latest.current = { classId, leaves, reminderQueue, attendance, students, payments, closings };

  useEffect(() => {
    const check = async () => {
      if (!isEnabled()) return;
      const d = latest.current;
      const today = todayISO();
      const active = d.students.filter((s) => s.status !== 'inactive').length;
      const day = dayCloseSummary(d.payments, today);
      const { alerts, state } = planNotifications({
        now: new Date(),
        today,
        leaves: d.leaves.filter((l) => l.status === 'pending'),
        reminders: { overdue: d.reminderQueue.overdue.length, upcoming: d.reminderQueue.upcoming.length },
        attendance: { taken: !!d.attendance[today], active },
        closedToday: !!d.closings[today],
        cashToday: day.total,
        state: loadState(d.classId),
      });
      saveState(d.classId, state);
      for (const a of alerts) await showNotification(a);
    };
    check();
    const timer = setInterval(check, 5 * 60 * 1000); // time-based rules (morning summary, 11am nudge)
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    // tapping a notification asks the open app to go to the right screen
    const onMessage = (e) => e.data?.type === 'notification-click' && e.data.tab && setActiveTab(e.data.tab);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [setActiveTab]);

  // New data arrived (e.g. a leave application) — look right away, not only on the timer
  useEffect(() => {
    if (!isEnabled()) return;
    const t = setTimeout(() => latest.current && document.dispatchEvent(new Event('visibilitychange')), 800);
    return () => clearTimeout(t);
  }, [leaves, reminderQueue, attendance]);

  return null;
}
