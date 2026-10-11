import React, { useMemo, useState } from 'react';
import { Megaphone, Plus, Pin, Pencil, Trash2, Clock3, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useUI } from '../context/UIContext';
import { PageHeader, Card, Badge, Button, IconButton, Sheet, Field, Input, Textarea, EmptyState, cx } from '../components/ui';
import { WhatsAppIcon } from '../components/ReceiptSheet';
import { NOTICE_KINDS, NOTICE_TEMPLATES, sortNotices, isActive, validateNotice, noticeText } from '../lib/notices';
import { fmtDate, todayISO, shiftISODate, waLink } from '../lib/format';

/** The notice board: what guardians see on the student portal. Post, pin, set an end date, remove. */
export const NoticesView = () => {
  const { notices, settings } = useApp();
  const { confirm, toast } = useUI();
  const { deleteNotice } = useApp();
  const [editing, setEditing] = useState(null); // notice | {} (new)
  const today = todayISO();
  const sorted = useMemo(() => sortNotices(notices), [notices]);
  const live = sorted.filter((n) => isActive(n, today));
  const old = sorted.filter((n) => !isActive(n, today));

  const remove = async (n) => {
    const ok = await confirm({ title: 'নোটিশটি মুছবেন?', message: `"${n.title}" শিক্ষার্থীর পোর্টাল থেকেও সরে যাবে।`, confirmText: 'মুছে ফেলুন', tone: 'danger', icon: Trash2 });
    if (!ok) return;
    await deleteNotice(n.id);
    toast('নোটিশ মুছে ফেলা হয়েছে');
  };

  const Item = ({ n, expired }) => {
    const k = NOTICE_KINDS[n.kind] || NOTICE_KINDS.general;
    return (
      <Card className={cx('p-4', expired && 'opacity-70')}>
        <div className="flex items-start gap-3">
          <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', k.tile)}>
            <Megaphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[15.5px] font-bold leading-snug text-ink">
              {n.pinned && <Pin className="h-4 w-4 shrink-0 text-brand-600" />}
              <span className="min-w-0">{n.title}</span>
            </p>
            <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-slate-600">{n.text}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-400">
              <Badge tone="slate">{k.bn}</Badge>
              <span className="flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {fmtDate(String(n.createdAt).slice(0, 10))}
              </span>
              {n.expiresOn && <span>{expired ? 'মেয়াদ শেষ' : `${fmtDate(n.expiresOn, { year: false })} পর্যন্ত`}</span>}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(n)}>
            এডিট
          </Button>
          <Button size="sm" variant="success" as="a" href={waLink('', noticeText(n, { institution: settings.institutionName, className: settings.className }))} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon className="h-4 w-4" /> শেয়ার
          </Button>
          <Button size="sm" variant="soft-danger" icon={Trash2} onClick={() => remove(n)}>
            মুছুন
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="নোটিশ বোর্ড" subtitle="শিক্ষার্থীর পোর্টালে দেখা যাবে" actions={<IconButton icon={Plus} label="নতুন নোটিশ" onClick={() => setEditing({})} />} />

      {notices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="কোনো নোটিশ নেই"
          text="নোটিশ দিলে অভিভাবক পোর্টাল খুললেই দেখতে পাবেন"
          action={
            <Button icon={Plus} onClick={() => setEditing({})}>
              নতুন নোটিশ
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-slate-500">
            <Eye className="h-4 w-4" /> এখন দেখা যাচ্ছে ({live.length})
          </p>
          <div className="stagger space-y-2.5">
            {live.map((n) => (
              <Item key={n.id} n={n} />
            ))}
            {live.length === 0 && <p className="rounded-2xl bg-white px-4 py-6 text-center text-[13.5px] text-slate-400 shadow-card">এই মুহূর্তে কোনো নোটিশ চালু নেই</p>}
          </div>
          {old.length > 0 && (
            <>
              <p className="mb-2 mt-6 px-1 text-[13px] font-semibold text-slate-500">মেয়াদ শেষ ({old.length})</p>
              <div className="space-y-2.5">
                {old.map((n) => (
                  <Item key={n.id} n={n} expired />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} full title={editing?.id ? 'নোটিশ এডিট' : 'নতুন নোটিশ'} subtitle="সবার পোর্টালে একসাথে দেখা যাবে">
        {editing && <NoticeForm key={editing.id || 'new'} notice={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
};

function NoticeForm({ notice, onDone }) {
  const { saveNotice } = useApp();
  const { toast } = useUI();
  const today = todayISO();
  const [title, setTitle] = useState(notice.title || '');
  const [text, setText] = useState(notice.text || '');
  const [kind, setKind] = useState(notice.kind || 'general');
  const [pinned, setPinned] = useState(!!notice.pinned);
  const [expiresOn, setExpiresOn] = useState(notice.expiresOn || '');
  const [errs, setErrs] = useState([]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e = validateNotice({ title, text, expiresOn }, today);
    setErrs(e);
    if (e.length || busy) return;
    setBusy(true);
    await saveNotice({ title, text, kind, pinned, expiresOn }, notice.id || null);
    toast(notice.id ? 'নোটিশ আপডেট হয়েছে' : 'নোটিশ দেওয়া হয়েছে');
    onDone();
  };

  return (
    <div className="space-y-5 pt-1">
      {!notice.id && (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-slate-500">তৈরি নমুনা</p>
          <div className="flex flex-wrap gap-2">
            {NOTICE_TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  setText(t.text);
                  setKind(t.kind);
                }}
                className="press rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label="শিরোনাম">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="যেমন অর্ধবার্ষিক পরীক্ষার রুটিন" />
      </Field>
      <Field label="বিবরণ">
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="নোটিশের পুরো লেখা" />
      </Field>

      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">ধরন</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(NOTICE_KINDS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cx('press rounded-full px-4 py-2 text-[13.5px] font-semibold', kind === k ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600')}>
              {v.bn}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-700">কতদিন দেখাবে</p>
        <div className="mb-2.5 flex flex-wrap gap-2">
          {[
            ['সবসময়', ''],
            ['৭ দিন', shiftISODate(today, 7)],
            ['৩০ দিন', shiftISODate(today, 30)],
          ].map(([label, value]) => (
            <button key={label} type="button" onClick={() => setExpiresOn(value)} className={cx('press rounded-full px-4 py-2 text-[13.5px] font-semibold', expiresOn === value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>
              {label}
            </button>
          ))}
        </div>
        <Input type="date" min={today} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      </div>

      <button type="button" onClick={() => setPinned((p) => !p)} className="press flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-left">
        <Pin className={cx('h-5 w-5', pinned ? 'text-brand-600' : 'text-slate-400')} />
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">সবার উপরে রাখুন</span>
          <span className="block text-[12.5px] text-slate-500">গুরুত্বপূর্ণ নোটিশ আগে দেখাবে</span>
        </span>
        <span className={cx('grid h-6 w-11 items-center rounded-full px-0.5 transition', pinned ? 'bg-brand-600' : 'bg-slate-300')}>
          <span className={cx('h-5 w-5 rounded-full bg-white shadow transition-transform', pinned && 'translate-x-5')} />
        </span>
      </button>

      {errs.length > 0 && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] font-medium text-rose-700">{errs.join(' · ')}</p>}
      <Button size="lg" block disabled={busy} onClick={save}>
        {notice.id ? 'আপডেট করুন' : 'নোটিশ দিন'}
      </Button>
    </div>
  );
}
