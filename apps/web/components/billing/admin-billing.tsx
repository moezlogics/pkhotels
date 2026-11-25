'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarClock, Check, ExternalLink, FileText, Loader2, MessageCircle, Phone, Plus, Receipt, Rocket, Save, Search, Settings2, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, StatCard } from '@/components/dashboard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fmtDate, invoiceState, invoiceTitle, LinesTable, monthName } from '@/components/billing/hotel-billing';
import { siteSettingsApi } from '@/lib/api';
import { pkr, waLink } from '@/lib/hotels';
import { apiError, billingApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

type Tab = 'chase' | 'verify' | 'invoices' | 'boosts' | 'settings';

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  dispute: { label: 'Stay dispute', tone: 'bg-rose-600 text-white' },
  overdue: { label: 'Overdue', tone: 'bg-rose-50 text-rose-700' },
  plan_ended: { label: 'Plan ended', tone: 'bg-amber-50 text-amber-800' },
  due_soon: { label: 'Due soon', tone: 'bg-highlight text-ink' },
  plan_ending: { label: 'Plan ending', tone: 'bg-accent text-ink' },
  boost_ending: { label: 'Boost ending', tone: 'bg-sky-50 text-sky-700' },
};

function lastMonth() {
  const d = new Date(Date.now() + 5 * 3_600_000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/**
 * Admin → Billing: who to chase today, payments to verify, every invoice,
 * boost prices and the billing terms. Payment accounts stay on their own page
 * (Payment Methods) — invoices simply show whatever is active there.
 */
export default function AdminBilling() {
  const [tab, setTab] = useState<Tab>('chase');
  const [sum, setSum] = useState<any>(null);
  const loadSum = useCallback(() => billingApi.summary().then(setSum).catch(() => undefined), []);
  useEffect(() => {
    void loadSum();
  }, [loadSum]);

  const tabs: { k: Tab; label: string; n?: number }[] = [
    { k: 'chase', label: 'To follow up', n: (sum?.overdue.n ?? 0) + (sum?.disputes ?? 0) },
    { k: 'verify', label: 'Verify payments', n: sum?.verify.n },
    { k: 'invoices', label: 'All invoices' },
    { k: 'boosts', label: 'Boost prices' },
    { k: 'settings', label: 'Terms' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" description="Commission invoices, boosts and who needs a reminder." actions={<GenerateButton onDone={loadSum} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="To verify" value={sum ? pkr(sum.verify.amount) : '—'} hint={`${sum?.verify.n ?? 0} payment(s)`} icon={BadgeCheck} tone="info" loading={!sum} />
        <StatCard label="Overdue" value={sum ? pkr(sum.overdue.amount) : '—'} hint={`${sum?.overdue.n ?? 0} invoice(s)${sum?.holds ? ` · ${sum.holds} paused` : ''}`} icon={AlertTriangle} tone="danger" loading={!sum} />
        <StatCard label="Outstanding" value={sum ? pkr(sum.outstanding.amount) : '—'} hint={`${sum?.dueSoon.n ?? 0} due in 3 days`} icon={CalendarClock} tone="warning" loading={!sum} />
        <StatCard label="Collected this month" value={sum ? pkr(sum.collected.amount) : '—'} hint={`${sum?.collected.n ?? 0} paid`} icon={Wallet} tone="success" loading={!sum} />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14.5px] font-semibold', tab === t.k ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-[color:var(--border)]')}
          >
            {t.label}
            {!!t.n && <span className={cn('rounded-full px-1.5 text-[12px]', tab === t.k ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground')}>{t.n}</span>}
          </button>
        ))}
      </div>

      {tab === 'chase' && <FollowUps onChange={loadSum} />}
      {tab === 'verify' && <InvoiceList status="submitted" onChange={loadSum} />}
      {tab === 'invoices' && <InvoiceList onChange={loadSum} filters />}
      {tab === 'boosts' && <BoostPrices />}
      {tab === 'settings' && <Terms />}
    </div>
  );
}

function GenerateButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const period = lastMonth();
    if (!confirm(`Create commission invoices for ${monthName(period)} now? (This also runs on its own on the 3rd.) Hotels already invoiced for that month are skipped.`)) return;
    setBusy(true);
    try {
      const r = await billingApi.generate(period);
      toast.success(r.created ? `${r.created} invoice(s) created · ${pkr(r.amount)}` : 'Nothing new to bill.');
      onDone();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void run()} disabled={busy} className="btn-ink btn-sm">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Bill last month
    </button>
  );
}

/* ── To follow up ── */

function FollowUps({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');
  const load = useCallback(() => billingApi.followUps().then(setRows).catch((e) => toast.error(apiError(e))), []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!rows) return <Spinner />;
  const shown = filter ? rows.filter((r) => r.kind === filter) : rows;
  const kinds = [...new Set(rows.map((r) => r.kind))];

  const remind = async (r: any) => {
    window.open(waLink(r.whatsapp, r.message), '_blank');
    if (['overdue', 'due_soon'].includes(r.kind)) {
      await billingApi.note(r.id, { reminded: true }).catch(() => undefined);
      void load();
    }
  };
  const decide = async (r: any, d: 'upheld' | 'rejected') => {
    try {
      await billingApi.dispute(r.id, d);
      toast.success(d === 'upheld' ? 'Marked as stayed — it will be billed.' : 'Hotel’s status kept.');
      void load();
      onChange();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-3">
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Chip on={!filter} onClick={() => setFilter('')}>All {rows.length}</Chip>
          {kinds.map((k) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{KIND_LABEL[k]?.label} {rows.filter((r) => r.kind === k).length}</Chip>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <Empty text="Nobody to chase. Overdue invoices, ending plans and boosts, and stay disputes show here." />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const k = KIND_LABEL[r.kind] ?? { label: r.kind, tone: '' };
            return (
              <li key={`${r.kind}-${r.id}`} className="rounded-[22px] border border-[color:var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', k.tone)}>{k.label}</span>
                      {r.kind === 'overdue' && r.days > 0 && <span className="text-[13px] font-semibold text-rose-700">{r.days} day{r.days === 1 ? '' : 's'} late</span>}
                      {r.reminders > 0 && <span className="text-[12.5px] text-neutral-500">Reminded {r.reminders}× · last {fmtDate(r.lastReminderAt)}</span>}
                    </div>
                    <p className="mt-1.5 text-[16px] font-semibold text-ink">{r.hotelName}{r.cityName ? <span className="font-normal text-neutral-500"> · {r.cityName}</span> : null}</p>
                    <p className="text-[14px] text-neutral-600">{r.title}</p>
                    {r.kind === 'dispute' && (
                      <div className="mt-2 space-y-1 rounded-xl bg-[#f7f5fc] p-3 text-[13.5px] text-neutral-700">
                        <p><span className="font-semibold">Guest:</span> {r.ownerName} · {r.dates} · {pkr(r.total)}</p>
                        {r.hotelReason && <p><span className="font-semibold">Hotel said:</span> {r.hotelReason}</p>}
                        {r.note && <p><span className="font-semibold">Guest says:</span> {r.note}</p>}
                      </div>
                    )}
                    <p className="mt-1 text-[13.5px] text-neutral-500">{r.kind !== 'dispute' && r.ownerName ? `${r.ownerName} · ` : ''}{r.phone || 'No phone'}</p>
                  </div>
                  {r.amount > 0 && <p className="text-[18px] font-bold text-ink tabular">{pkr(r.amount)}</p>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.whatsapp && <button type="button" onClick={() => void remind(r)} className="btn-yellow btn-sm"><MessageCircle className="h-4 w-4" /> WhatsApp</button>}
                  {r.phone && <a href={`tel:${r.phone}`} className="btn-ghost btn-sm"><Phone className="h-4 w-4" /> Call</a>}
                  {r.kind === 'dispute' && (
                    <>
                      <button type="button" onClick={() => void decide(r, 'upheld')} className="btn-ink btn-sm"><Check className="h-4 w-4" /> Guest stayed</button>
                      <button type="button" onClick={() => void decide(r, 'rejected')} className="btn-ghost btn-sm"><X className="h-4 w-4" /> Keep hotel’s status</button>
                    </>
                  )}
                </div>
                {['overdue', 'due_soon'].includes(r.kind) && <NoteBox id={r.id} value={r.adminNote} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteBox({ id, value }: { id: string; value: string }) {
  const [v, setV] = useState(value || '');
  const [saved, setSaved] = useState(value || '');
  return (
    <div className="mt-3 flex gap-2">
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Private note — e.g. promised to pay Friday" className="h-10" />
      {v !== saved && (
        <button
          type="button"
          className="btn-ink btn-sm"
          onClick={async () => {
            await billingApi.note(id, { adminNote: v });
            setSaved(v);
            toast.success('Note saved');
          }}
        >
          <Save className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── Invoices (verify queue and all) ── */

function InvoiceList({ status, filters, onChange }: { status?: string; filters?: boolean; onChange: () => void }) {
  const [st, setSt] = useState(status ?? 'all');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    () => billingApi.list({ status: st, kind: kind || undefined, q: q || undefined, page }).then(setData).catch((e) => toast.error(apiError(e))),
    [st, kind, q, page],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      void load();
      onChange();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="space-y-3">
      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'open', 'overdue', 'submitted', 'paid', 'void'].map((s) => (
            <Chip key={s} on={st === s} onClick={() => { setSt(s); setPage(1); }}>{s === 'all' ? 'All' : s === 'open' ? 'Unpaid' : s === 'submitted' ? 'To verify' : s.charAt(0).toUpperCase() + s.slice(1)}</Chip>
          ))}
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="h-9 rounded-full border border-[color:var(--border)] bg-white px-3 text-[14px]">
            <option value="">Commission & boosts</option>
            <option value="commission">Commission</option>
            <option value="boost">Boosts</option>
          </select>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Hotel, city or invoice no." className="h-10 pl-9" />
          </div>
        </div>
      )}
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty text={status === 'submitted' ? 'No payments waiting. When a hotel uploads a screenshot it shows here.' : 'No invoices match.'} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((i: any) => {
            const s = invoiceState(i);
            const owner = i.owner || {};
            const wa = owner.whatsappNumber || i.hotel?.whatsapp || owner.phone || i.hotel?.phone;
            return (
              <li key={i._id} className="rounded-[22px] border border-[color:var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start gap-3">
                  {i.proofUrl && i.status === 'submitted' && (
                    <a href={i.proofUrl} target="_blank" rel="noreferrer" className="block h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-neutral-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={i.proofUrl} alt="Payment screenshot" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', s.tone)}>{s.label}</span>
                      <span className="text-[13px] text-neutral-500">{i.number}</span>
                      {i.hotel?.billingHold && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11.5px] font-semibold text-white">Bookings paused</span>}
                    </div>
                    <p className="mt-1 text-[16px] font-semibold text-ink">{i.hotelName} <span className="font-normal text-neutral-500">· {invoiceTitle(i)}</span></p>
                    <p className="text-[13.5px] text-neutral-500">
                      {owner.name || 'Owner'}{owner.phone ? ` · ${owner.phone}` : ''} · {i.status === 'paid' ? `paid ${fmtDate(i.paidAt)}` : `due ${fmtDate(i.dueDate)}`}
                      {i.status === 'submitted' ? ` · sent ${fmtDate(i.submittedAt)}${i.paymentMethod ? ` via ${i.paymentMethod}` : ''}${i.paymentNote ? ` · ${i.paymentNote}` : ''}` : ''}
                    </p>
                    {i.rejectionReason && i.status === 'rejected' && <p className="mt-1 text-[13px] text-amber-800">Rejected: {i.rejectionReason}</p>}
                    {i.adminNote && <p className="mt-1 text-[13px] text-neutral-600">Note: {i.adminNote}</p>}
                  </div>
                  <p className="text-[18px] font-bold text-ink tabular">{pkr(i.amount)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['submitted', 'unpaid', 'rejected'].includes(i.status) && (
                    <button type="button" onClick={() => { if (i.status !== 'submitted' && !confirm('Mark as paid without a screenshot (e.g. paid in cash)?')) return; void act(() => billingApi.approve(i._id), i.kind === 'boost' ? 'Paid — the boost is live.' : 'Marked paid.'); }} className="btn-yellow btn-sm">
                      <Check className="h-4 w-4" /> {i.status === 'submitted' ? 'Payment received' : 'Mark paid'}
                    </button>
                  )}
                  {i.status === 'submitted' && (
                    <button type="button" onClick={() => { const r = prompt('Why can’t you verify it? The hotel sees this.', 'We could not find this payment. Please check the amount and send the screenshot again.'); if (r !== null) void act(() => billingApi.reject(i._id, r), 'Sent back to the hotel.'); }} className="btn-ghost btn-sm">
                      <X className="h-4 w-4" /> Not received
                    </button>
                  )}
                  {i.proofUrl && <a href={i.proofUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><ExternalLink className="h-4 w-4" /> Screenshot</a>}
                  {wa && i.status !== 'paid' && i.status !== 'void' && (
                    <button type="button" onClick={() => { window.open(waLink(wa, `Assalam-o-Alaikum, PakHotels invoice ${i.number} for ${i.hotelName} (${pkr(i.amount)}) is due on ${fmtDate(i.dueDate)}. Please pay from Dashboard → Billing. Shukriya!`), '_blank'); void billingApi.note(i._id, { reminded: true }); }} className="btn-ghost btn-sm">
                      <MessageCircle className="h-4 w-4" /> Remind
                    </button>
                  )}
                  {i.lines?.length > 0 && <button type="button" onClick={() => setOpen(open === i._id ? null : i._id)} className="btn-ghost btn-sm"><Receipt className="h-4 w-4" /> {open === i._id ? 'Hide' : 'Lines'}</button>}
                  {!['paid', 'void'].includes(i.status) && (
                    <button type="button" onClick={() => { const n = prompt('Cancel this invoice? Reason (kept as a private note):', ''); if (n !== null) void act(() => billingApi.void(i._id, n), 'Invoice cancelled.'); }} className="ml-auto text-[13.5px] font-medium text-neutral-500 hover:text-rose-600">
                      Cancel invoice
                    </button>
                  )}
                </div>
                {open === i._id && <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--border)]"><LinesTable lines={i.lines} /></div>}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost btn-sm disabled:opacity-40">Previous</button>
          <span className="text-[14px] text-neutral-500">Page {page} of {data.pages}</span>
          <button type="button" disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="btn-ghost btn-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

/* ── Boost prices ── */

function BoostPrices() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = useCallback(() => billingApi.boosts().then(setRows).catch((e) => toast.error(apiError(e))), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!rows) return <Spinner />;
  return (
    <div className="space-y-3">
      {rows.map((r) => <BoostRow key={r._id} row={r} onSaved={load} />)}
      <BoostRow row={null} onSaved={load} />
      <p className="text-[13.5px] text-neutral-500">“Top of city” lifts the hotel above all others in its city and search; “Homepage featured” puts it in the homepage rail. A boost that has been bought before is switched off instead of deleted.</p>
    </div>
  );
}

function BoostRow({ row, onSaved }: { row: any | null; onSaved: () => void }) {
  const [f, setF] = useState(row ?? { name: '', placement: 'top', days: 7, price: 1500, highlight: false, isActive: true, order: 9 });
  const [adding, setAdding] = useState(false);
  if (!row && !adding) {
    return <button type="button" onClick={() => setAdding(true)} className="btn-ghost btn-sm"><Plus className="h-4 w-4" /> Add a boost</button>;
  }
  const save = async () => {
    try {
      await billingApi.saveBoost(row?._id ?? null, f);
      toast.success('Saved');
      if (!row) setAdding(false);
      onSaved();
    } catch (e) {
      toast.error(apiError(e));
    }
  };
  return (
    <div className={cn('grid gap-2 rounded-[22px] border border-[color:var(--border)] bg-white p-4 sm:grid-cols-[1fr_150px_90px_120px_auto]', row && !row.isActive && 'opacity-60')}>
      <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name, e.g. Top of city · 7 days" />
      <select value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })} className="h-11 rounded-xl border border-[color:var(--border)] bg-white px-3 text-[14px]">
        <option value="top">Top of city</option>
        <option value="featured">Homepage featured</option>
      </select>
      <Input type="number" min={1} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} aria-label="Days" />
      <Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} aria-label="Price (Rs)" />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={!!f.highlight} onChange={(e) => setF({ ...f, highlight: e.target.checked })} /> Best value</label>
        <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={f.isActive !== false} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> On</label>
        <button type="button" onClick={() => void save()} className="btn-ink btn-sm"><Save className="h-4 w-4" /></button>
        {row ? (
          <button type="button" aria-label="Delete" onClick={async () => { if (!confirm('Delete this boost?')) return; await billingApi.deleteBoost(row._id); onSaved(); }} className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] text-neutral-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        ) : (
          <button type="button" aria-label="Cancel" onClick={() => setAdding(false)} className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] text-neutral-500"><X className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

/* ── Terms ── */

function Terms() {
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    siteSettingsApi.get().then((s: any) => setF({ billingDueDays: s.billingDueDays ?? 10, billingHoldDays: s.billingHoldDays ?? 15, billingWhatsapp: s.billingWhatsapp ?? '', billingNote: s.billingNote ?? '' })).catch(() => setF({ billingDueDays: 10, billingHoldDays: 15, billingWhatsapp: '', billingNote: '' }));
  }, []);
  if (!f) return <Spinner />;
  const save = async () => {
    setBusy(true);
    try {
      await siteSettingsApi.save(f);
      toast.success('Billing terms saved');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-2xl space-y-4 rounded-[22px] border border-[color:var(--border)] bg-white p-5">
      <p className="flex items-center gap-2 text-[17px] font-bold text-ink"><Settings2 className="h-5 w-5" /> Billing terms</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-semibold text-ink">Days to pay a commission invoice
          <Input type="number" min={3} max={45} className="mt-1.5" value={f.billingDueDays} onChange={(e) => setF({ ...f, billingDueDays: Number(e.target.value) })} />
        </label>
        <label className="block text-[14px] font-semibold text-ink">Pause online booking after (days overdue)
          <Input type="number" min={0} max={90} className="mt-1.5" value={f.billingHoldDays} onChange={(e) => setF({ ...f, billingHoldDays: Number(e.target.value) })} />
          <span className="mt-1 block text-[12.5px] font-normal text-neutral-500">0 = never pause</span>
        </label>
      </div>
      <label className="block text-[14px] font-semibold text-ink">WhatsApp for payment questions
        <Input className="mt-1.5" placeholder="03xx xxxxxxx (empty = the site’s contact WhatsApp)" value={f.billingWhatsapp} onChange={(e) => setF({ ...f, billingWhatsapp: e.target.value })} />
      </label>
      <label className="block text-[14px] font-semibold text-ink">Note on every invoice
        <Textarea className="mt-1.5" rows={2} maxLength={300} placeholder="e.g. Write the invoice number in the transfer note." value={f.billingNote} onChange={(e) => setF({ ...f, billingNote: e.target.value })} />
      </label>
      <p className="text-[13px] text-neutral-500">Bank, JazzCash and Easypaisa accounts shown on invoices are managed in <a href="/dashboard/payment-methods" className="font-semibold text-ink underline">Payment Methods</a>. Commission rates are set per plan in Packages.</p>
      <button type="button" disabled={busy} onClick={() => void save()} className="btn-yellow btn-sm">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
    </div>
  );
}

/* ── bits ── */

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-9 rounded-full px-3.5 text-[13.5px] font-semibold', on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-[color:var(--border)]')}>
      {children}
    </button>
  );
}
function Spinner() {
  return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[color:var(--border)] bg-white p-10 text-center">
      <Rocket className="mx-auto h-8 w-8 text-neutral-300" />
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-neutral-500">{text}</p>
    </div>
  );
}
