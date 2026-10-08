import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ChevronLeft, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useBackHandler } from '../lib/backstack';
import logoUrl from '../assets/images/logo.png';
import { ACADEMIC_MONTHS, EN_MONTHS, BN_MONTHS } from '../lib/format';

export const cx = (...c) => c.filter(Boolean).join(' ');

/*
 * Responsive layout tokens
 *  - small phones (<375px): `max-[374px]:` tweaks shrink type and controls
 *  - large phones / tablets: the app column widens and card lists go 2-up
 */
export const CONTAINER = 'max-w-[480px] sm:max-w-[600px] md:max-w-[720px] lg:max-w-[960px]';
export const GUTTER = 'px-4 sm:px-6';
// Edge-to-edge strip inside the gutter (sticky headers, scrolling chip rows)
export const BLEED = '-mx-4 px-4 sm:-mx-6 sm:px-6';
// Fixed bars (save / send) that sit just above the bottom nav
export const DOCK = 'no-print fixed inset-x-0 z-30 mx-auto max-w-[480px] px-4 sm:max-w-[560px]';
export const DOCK_BOTTOM = { bottom: 'calc(80px + env(safe-area-inset-bottom) + var(--nav-lift, 0px))' };
// Card lists: one column on phones, two on tablets
export const CARD_GRID = 'space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0';

export const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};
const DOTS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  sky: 'bg-sky-500',
  brand: 'bg-brand-500',
  slate: 'bg-slate-400',
};
export const TONE_TEXT = {
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-rose-600',
  sky: 'text-sky-600',
  brand: 'text-brand-600',
  slate: 'text-slate-500',
};

export function Badge({ tone = 'slate', dot, children, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

const AVATAR_BG = [
  'from-brand-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-cyan-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

export function Avatar({ src, name = '', seed, size = 44, className, rounded = 'rounded-2xl' }) {
  const [failed, setFailed] = useState(false);
  const label = String(name).trim();
  const initials = label
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || label.slice(0, 1);
  const key = String(seed ?? label);
  const bg = AVATAR_BG[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={style}
        className={cx('shrink-0 object-cover bg-slate-100', rounded, className)}
      />
    );
  }
  return (
    <div
      style={style}
      className={cx('shrink-0 grid place-items-center bg-gradient-to-br text-white font-bold', bg, rounded, className)}
    >
      {initials}
    </div>
  );
}

/** Class setting "বেতন শুরুর মাস": months before it were collected with admission */
export function FeeStartSelect({ value, onChange }) {
  const now = new Date();
  const curIdx = ACADEMIC_MONTHS.indexOf(EN_MONTHS[now.getMonth()]);
  const sessionStart = curIdx <= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const options = ACADEMIC_MONTHS.map((m, i) => {
    const y = i <= 5 ? sessionStart : sessionStart + 1;
    return { value: `${y}-${String(EN_MONTHS.indexOf(m) + 1).padStart(2, '0')}`, label: `${BN_MONTHS[EN_MONTHS.indexOf(m)]} ${y}` };
  });
  if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: value });
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl bg-slate-50 px-4 text-[16px] font-medium text-ink outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-brand-500"
    >
      <option value="">শুরু থেকেই (ভর্তির মাস থেকে)</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label} থেকে
        </option>
      ))}
    </select>
  );
}

/** Tick box shown when adding students: the admission-month fee was already collected */
export function PaidAtAdmission({ checked, onChange, month, beforeStart, startLabel }) {
  // Month before the class's fee start: nothing to choose — it was taken with admission
  if (beforeStart) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200">
        <Checkbox checked className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">{month ? `${month}: ` : ''}বেতন ভর্তির সময় নেওয়া হয়েছে</span>
          <span className="block text-[12.5px] text-slate-500">মাসিক বেতন নেওয়া শুরু {startLabel || 'পরের মাস'} থেকে</span>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx('press flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-inset', checked ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200')}
    >
      <Checkbox checked={checked} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ink">ভর্তির সময় {month ? `${month} মাসের ` : 'এই মাসের '}বেতন নেওয়া হয়েছে</span>
        <span className="block text-[12.5px] text-slate-500">টিক থাকলে এই মাস পরিশোধিত হিসেবে থাকবে — বাকি দেখাবে না</span>
      </span>
    </button>
  );
}

/** The college logo (src/assets/images/logo.png) — used on the portal, login, splash and receipts */
export function Logo({ size = 64, className }) {
  return <img src={logoUrl} alt="Starlight College" width={size} height={size} style={{ width: size, height: size }} className={cx('shrink-0 object-contain', className)} />;
}

/** Students are shown by their roll number instead of a photo. Rolls can be up to 6 digits: long
 *  ones keep a readable size and the badge widens instead of the digits shrinking. */
export function RollBadge({ roll, seed, size = 44, className, rounded = 'rounded-2xl', label }) {
  const text = String(roll ?? '?');
  const key = String(seed ?? text);
  const bg = AVATAR_BG[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
  const showLabel = label ?? size >= 60;
  const scale = text.length <= 2 ? 0.42 : text.length === 3 ? 0.36 : 0.3;
  const wide = text.length > 4;
  return (
    <div
      style={{ width: wide ? 'auto' : size, minWidth: size, height: size, paddingInline: wide ? Math.round(size * 0.16) : undefined }}
      className={cx('tabular shrink-0 flex flex-col items-center justify-center bg-gradient-to-br text-white leading-none', bg, rounded, className)}
      aria-label={`রোল ${text}`}
    >
      {showLabel && <span style={{ fontSize: Math.max(10, Math.round(size * 0.15)) }} className="mb-0.5 font-semibold text-white/75">রোল</span>}
      <span style={{ fontSize: Math.round(size * scale) }} className="font-extrabold tracking-tight">
        {text}
      </span>
    </div>
  );
}

const BTN = {
  primary: 'bg-brand-600 text-white shadow-lift hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  dark: 'bg-ink text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400',
  success: 'bg-emerald-600 text-white shadow-[0_10px_30px_-12px_rgba(5,150,105,.6)] hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  secondary: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  'soft-danger': 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  'soft-success': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
};
const BTN_SIZE = {
  lg: 'h-14 px-6 text-[16px] rounded-2xl gap-2',
  md: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
  sm: 'h-10 px-4 text-[14px] rounded-xl gap-1.5',
  xs: 'h-8 px-3 text-[13px] rounded-lg gap-1',
};

export function Button({ variant = 'primary', size = 'md', icon: Icon, block, className, children, as: As = 'button', ...rest }) {
  return (
    <As
      {...(As === 'button' ? { type: 'button' } : {})}
      {...rest}
      className={cx(
        'press inline-flex items-center justify-center font-semibold whitespace-nowrap disabled:cursor-not-allowed',
        BTN[variant],
        BTN_SIZE[size],
        block && 'w-full',
        className,
      )}
    >
      {Icon && <Icon className={size === 'xs' || size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.2} />}
      {children}
    </As>
  );
}

export function IconButton({ icon: Icon, label, className, badge, tone = 'default', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'press relative grid h-11 w-11 place-items-center rounded-2xl',
        tone === 'default' && 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200/80 shadow-card',
        tone === 'plain' && 'text-slate-600 hover:bg-slate-100',
        tone === 'glass' && 'bg-white/15 text-white ring-1 ring-inset ring-white/20',
        className,
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2.1} />
      {badge ? (
        <span className="absolute -right-1 -top-1 min-w-[20px] h-5 rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function Card({ className, children, ...rest }) {
  return (
    <div {...rest} className={cx('rounded-3xl bg-white ring-1 ring-slate-200/70 shadow-card', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, hint, action }) {
  return (
    <div className="mb-2.5 mt-6 flex items-end justify-between px-1">
      <div>
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {hint && <p className="text-[12.5px] text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-[13.5px] font-semibold text-slate-700">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-[12.5px] font-medium text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12.5px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

// 16px font prevents iOS from zooming into inputs
export const inputCls =
  'w-full h-12 px-4 rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200 text-[16px] font-medium text-ink placeholder:text-slate-400 outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-500';

export const Input = React.forwardRef(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx(inputCls, className)} />;
});

export function Textarea({ className, ...rest }) {
  return <textarea {...rest} className={cx(inputCls, 'h-auto py-3 leading-relaxed', className)} />;
}

export function SearchBar({ value, onChange, placeholder = 'খুঁজুন…', className, autoFocus, inputMode }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(inputCls, 'bg-white pl-12 pr-11 shadow-card ring-slate-200/80 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          aria-label="মুছুন"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-slate-200 text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Chips({ options, value, onChange, className, bleed = true }) {
  return (
    <div className={cx('no-scrollbar flex gap-2 overflow-x-auto pb-0.5', bleed && BLEED, className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition',
              active ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200',
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cx(
                  'rounded-full px-1.5 text-[12px] tabular',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One small button instead of rows of filter chips. `groups` = [{ key, label, options: [{ value, label, count }] }],
 * `value` = { [key]: selected }, `defaults` = the "no filter" value of each group.
 */
export function FilterButton({ groups, value, defaults, onChange, className, compact }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const shown = groups.filter((g) => g.options.length > 1);
  const active = shown.filter((g) => value[g.key] !== defaults[g.key]).length;
  if (!shown.length) return null;
  return (
    <>
      <button
        type="button"
        aria-label="ফিল্টার"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className={cx(
          'press relative grid shrink-0 place-items-center shadow-card ring-1 ring-inset',
          compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl',
          active ? 'bg-ink text-white ring-ink' : 'bg-white text-slate-600 ring-slate-200/80',
          className,
        )}
      >
        <SlidersHorizontal className="h-5 w-5" />
        {active > 0 && (
          <span className="tabular absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white ring-2 ring-canvas">
            {active}
          </span>
        )}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="ফিল্টার"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setDraft(defaults)}>
              রিসেট
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              দেখুন
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pt-1">
          {shown.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-[13px] font-bold text-slate-500">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = draft[g.key] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, [g.key]: o.value }))}
                      className={cx(
                        'press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold',
                        on ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {o.label}
                      {o.count != null && <span className={cx('tabular text-[12px]', on ? 'text-white/70' : 'text-slate-400')}>{o.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** Compact dropdown pill — for picking a month, report type, etc. without a row of chips */
export function SelectPill({ value, onChange, options, className, label }) {
  return (
    <label className={cx('press relative inline-flex h-10 items-center gap-1.5 rounded-full bg-white pl-4 pr-9 text-[14px] font-semibold text-ink shadow-card ring-1 ring-inset ring-slate-200/80', className)}>
      {label && <span className="text-slate-500">{label}</span>}
      <span className="truncate">{options.find((o) => o.value === value)?.label}</span>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label || 'বাছুন'}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count != null ? ` (${o.count})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('grid gap-1 rounded-2xl bg-slate-200/60 p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-10 rounded-xl text-[14px] font-semibold transition',
            o.value === value ? 'bg-white text-ink shadow-card' : 'text-slate-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = 'green', className, track = 'bg-slate-100' }) {
  const bar = { green: 'bg-emerald-500', red: 'bg-rose-500', amber: 'bg-amber-500', brand: 'bg-brand-500', white: 'bg-white' }[tone];
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full', track, className)}>
      <div className={cx('h-full rounded-full transition-all duration-700', bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, tone = 'green', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { green: '#10b981', red: '#f43f5e', amber: '#f59e0b', brand: '#5045e5' }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef0f5" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white text-slate-400 ring-1 ring-slate-200 shadow-card">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <p className="text-[16px] font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-xs text-[14px] text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Sticky large-title page header */
export function PageHeader({ title, subtitle, actions, onBack, children }) {
  return (
    <header className={cx('no-print sticky top-0 z-30 mb-3 bg-canvas/95 pb-3 pt-safe backdrop-blur-xl', BLEED)}>
      <div className="flex min-h-[60px] items-center gap-3 pt-3">
        {onBack && <IconButton icon={ChevronLeft} label="ফিরে যান" onClick={onBack} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-ink max-[374px]:text-[20px] md:text-[26px]">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-2 space-y-3">{children}</div>}
    </header>
  );
}

let zSeed = 0;
let openSheets = 0;

function SheetInner({ onClose, title, subtitle, children, footer, full, headerRight, tone, printable }) {
  const [z] = useState(() => 60 + ++zSeed);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);

  useBackHandler(true, onClose);

  useEffect(() => {
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheets -= 1;
      if (openSheets <= 0) document.body.style.overflow = '';
    };
  }, []);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 110) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6" style={{ zIndex: z }} role="dialog" aria-modal="true">
      <div className="no-print absolute inset-0 animate-fade bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'relative flex w-full max-w-[480px] animate-sheet flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-w-[560px] md:rounded-[28px]',
          full ? 'h-[94dvh] md:h-[min(88dvh,860px)]' : 'max-h-[92dvh] md:max-h-[88dvh]',
          printable && 'print-area',
        )}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? 'none' : 'transform .2s ease' }}
      >
        <div
          className={cx('no-print shrink-0 touch-none rounded-t-[28px] md:pt-2', tone)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-center pb-1 pt-2.5 md:hidden">
            <div className={cx('h-1.5 w-10 rounded-full', tone ? 'bg-white/40' : 'bg-slate-200')} />
          </div>
          {(title || headerRight) && (
            <div className="flex items-start gap-3 px-5 pb-3 pt-1">
              <div className="min-w-0 flex-1">
                {title && <h2 className={cx('text-[19px] font-extrabold leading-snug', tone ? 'text-white' : 'text-ink')}>{title}</h2>}
                {subtitle && <p className={cx('text-[13.5px]', tone ? 'text-white/75' : 'text-slate-500')}>{subtitle}</p>}
              </div>
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="বন্ধ করুন"
                className={cx('press grid h-9 w-9 shrink-0 place-items-center rounded-full', tone ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && (
          <div className="no-print shrink-0 border-t border-slate-100 bg-white px-5 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bottom sheet — the app's only modal pattern. Swipe down, tap outside or press Back to close. */
export function Sheet({ open, ...props }) {
  if (!open) return null;
  return createPortal(<SheetInner {...props} />, document.body);
}

export function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {Icon && (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-[18px] w-[18px]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-slate-500">{label}</p>
        <p className={cx('truncate text-[15px] font-semibold text-ink', mono && 'tabular tracking-wide')}>{value || '—'}</p>
      </div>
    </div>
  );
}

export function Checkbox({ checked, className }) {
  return (
    <span
      className={cx(
        'grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-2 ring-inset transition',
        checked ? 'bg-brand-600 ring-brand-600' : 'bg-white ring-slate-300',
        className,
      )}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </span>
  );
}
