import React from 'react';
import { cx, CONTAINER, GUTTER } from './ui';

/** One grey shimmering block — compose these into the shape of the real screen */
export const Skel = ({ className, style }) => <div aria-hidden="true" className={cx('skeleton', className)} style={style} />;

const Card = ({ className, children }) => <div className={cx('rounded-3xl bg-white p-4 shadow-card', className)}>{children}</div>;

/** Page title + subtitle, like PageHeader */
const HeaderSkel = ({ pill }) => (
  <div className="pb-3 pt-safe">
    <div className="flex min-h-[60px] items-center gap-3 pt-3">
      <div className="flex-1 space-y-2">
        <Skel className="h-6 w-44 rounded-lg" />
        <Skel className="h-3.5 w-32 rounded-md" />
      </div>
      <Skel className="h-11 w-11 rounded-2xl" />
    </div>
    {pill && <Skel className="mt-2 h-10 w-36 rounded-full" />}
  </div>
);

const RowSkel = () => (
  <Card className="flex items-center gap-3 !p-3.5">
    <Skel className="h-11 w-11 shrink-0 rounded-2xl" />
    <div className="flex-1 space-y-2">
      <Skel className="h-4 w-3/5 rounded-md" />
      <Skel className="h-3 w-2/5 rounded-md" />
    </div>
    <Skel className="h-5 w-16 rounded-md" />
  </Card>
);

/** The home dashboard: greeting, search, cash bar, collection card, quick actions, cards */
export function DashboardSkeleton() {
  return (
    <div className="pt-safe" role="status" aria-label="লোড হচ্ছে">
      <div className="flex items-center gap-3.5 pb-4 pt-5">
        <Skel className="h-[56px] w-[56px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skel className="h-3 w-16 rounded-md" />
          <Skel className="h-5 w-40 rounded-lg" />
          <Skel className="h-3 w-48 rounded-md" />
        </div>
        <Skel className="h-11 w-11 rounded-2xl" />
      </div>
      <Skel className="h-12 w-full rounded-2xl" />
      <Skel className="mt-3 h-[62px] w-full rounded-2xl" />
      <Skel className="mt-4 h-[212px] w-full rounded-[28px]" />
      <div className="mt-3 flex justify-center gap-1.5">
        <Skel className="h-2 w-6 rounded-full" />
        <Skel className="h-2 w-2 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skel key={i} className="h-[88px] rounded-3xl" />
        ))}
      </div>
      <Skel className="mt-5 h-[72px] w-full rounded-3xl" />
      <Skel className="mt-5 h-5 w-32 rounded-lg" />
      <Skel className="mt-3 h-36 w-full rounded-3xl" />
    </div>
  );
}

/** Any list screen: header, a summary card, then rows */
export function ListSkeleton({ rows = 6, pill = false, summary = true }) {
  return (
    <div role="status" aria-label="লোড হচ্ছে">
      <HeaderSkel pill={pill} />
      {summary && (
        <Skel className="mb-3 h-[104px] w-full rounded-[28px]" />
      )}
      <Skel className="mb-3 h-12 w-full rounded-2xl" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <RowSkel key={i} />
        ))}
      </div>
    </div>
  );
}

/** Loading fallback for a section, shaped like that section */
export function PageSkeleton({ id }) {
  if (id === 'dashboard') return <DashboardSkeleton />;
  if (id === 'reports' || id === 'settings') return <ListSkeleton rows={4} pill />;
  if (id === 'attendance') return <ListSkeleton rows={8} summary={false} />;
  return <ListSkeleton />;
}

/** Whole app while the class data first arrives: the dashboard shape with the bottom bar in place */
export function ShellSkeleton() {
  return (
    <>
      <main className={cx('mx-auto min-h-dvh', CONTAINER, GUTTER)} style={{ paddingBottom: 'calc(104px + env(safe-area-inset-bottom))' }}>
        <DashboardSkeleton />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-slate-200/70 bg-white/90 md:bottom-4 md:max-w-[520px] md:rounded-[26px] md:border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-hidden="true">
        <div className="grid h-[68px] grid-cols-5 place-items-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skel key={i} className={i === 2 ? 'h-[52px] w-[52px] rounded-[20px]' : 'h-8 w-12 rounded-full'} />
          ))}
        </div>
      </nav>
    </>
  );
}
