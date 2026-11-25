'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BedDouble, Receipt, Rocket, CalendarCheck, Check, Clock, DoorOpen, Eye, Hotel, KeyRound, Loader2, LogOut, Plus, Wallet, X } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { BOOKING_STATUS, fmtDay, hotelPath, pkr, waLink } from '@/lib/hotels';
import { apiError, billingApi, bookingsApi, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { Loading, NoHotelYet } from '@/components/hotel-dashboard/use-managed-hotel';

function Bars({ daily }: { daily: { _id: string; n: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.n));
  return (
    <div className="flex h-28 items-end gap-1">
      {daily.map((d) => (
        <div key={d._id} className="group relative flex-1">
          <div className="rounded-t bg-primary/80 transition group-hover:bg-primary" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 0 }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{d._id.slice(5)}: {d.n}</span>
        </div>
      ))}
    </div>
  );
}

function RecentList({ items, admin }: { items: any[]; admin?: boolean }) {
  if (!items.length) return <p className="py-8 text-center text-[15px] text-neutral-500">Nobody arriving today.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((b) => {
        const s = BOOKING_STATUS[b.status] ?? { label: b.status, tone: '' };
        return (
          <li key={b._id}>
            <Link href={`/dashboard/bookings?ref=${b.ref}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{b.guestName} {admin && <span className="font-normal text-slate-500">· {b.hotelName}</span>}</p>
                <p className="text-xs text-slate-500">{fmtDay(b.checkIn)} – {fmtDay(b.checkOut)} · {b.rooms.map((r: any) => `${r.qty}× ${r.name}`).join(', ')}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', s.tone)}>{s.label}</span>
                <p className="mt-0.5 text-sm font-semibold">{pkr(b.total)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RequestCard({ b, onDone }: { b: any; onDone: () => void }) {
  const [busy, setBusy] = useState('');
  const act = async (status: 'confirmed' | 'declined') => {
    setBusy(status);
    try {
      await bookingsApi.setStatus(b._id, { status, ...(status === 'declined' ? { note: 'No rooms free for these dates' } : {}) });
      toast.success(status === 'confirmed' ? 'Booking confirmed. The guest has been told.' : 'Request declined.');
      if (status === 'confirmed' && (b.guestPhone?.startsWith('03') || b.guestPhone?.startsWith('+'))) {
        toast('Send the guest a WhatsApp?', {
          action: { label: 'Open WhatsApp', onClick: () => window.open(waLink(b.guestPhone, `Assalam o Alaikum ${b.guestName}, your booking ${b.ref} at ${b.hotelName} for ${fmtDay(b.checkIn)} is confirmed. See you soon!`), '_blank') },
        });
      }
      onDone();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };
  return (
    <li className="rounded-[20px] border border-[color:var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16.5px] font-semibold text-ink">{b.guestName}</p>
          <p className="mt-0.5 text-[14px] text-neutral-500">{fmtDay(b.checkIn)} – {fmtDay(b.checkOut)} · {b.rooms.map((r: any) => `${r.qty}× ${r.name}`).join(', ')}</p>
        </div>
        <p className="font-display shrink-0 text-[18px] font-bold text-ink tabular">{pkr(b.total)}</p>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button type="button" disabled={!!busy} onClick={() => act('confirmed')} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-[15px] font-semibold text-white disabled:opacity-60">
          {busy === 'confirmed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
        </button>
        <button type="button" disabled={!!busy} onClick={() => act('declined')} className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-neutral-300 bg-white text-[15px] font-semibold text-ink disabled:opacity-60">
          {busy === 'declined' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Decline
        </button>
        <Link href={`/dashboard/bookings?ref=${b.ref}`} aria-label="Open booking" className="grid h-11 w-11 place-items-center rounded-full bg-[#f7f5fc] text-ink">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

/** What the owner must know about money today: paused bookings, an invoice due, or a nudge to boost. */
function BillingNotice({ bill, live }: { bill: any; live: boolean }) {
  if (!bill) return null;
  const open = (bill.invoices ?? []).filter((i: any) => ['unpaid', 'rejected'].includes(i.status));
  const overdue = open.filter((i: any) => i.overdue);
  if (bill.hotel.billingHold || overdue.length) {
    return (
      <Link href="/dashboard/billing" className="flex items-center gap-3 rounded-[22px] bg-rose-600 p-4 text-white">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{bill.hotel.billingHold ? 'Online booking is paused' : 'An invoice is overdue'}</span>
          <span className="block text-[14px] text-white/85">Pay {pkr(bill.balance)} to {bill.hotel.billingHold ? 'start taking bookings again' : 'keep taking bookings'}.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>
    );
  }
  if (open.length) {
    const next = [...open].sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
    return (
      <Link href="/dashboard/billing" className="flex items-center gap-3 rounded-[22px] border border-[color:var(--border)] bg-white p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Receipt className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Invoice {next.number} · {pkr(next.amount)}</span>
          <span className="block text-[14px] text-neutral-500">Due {new Date(next.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — pay by bank, JazzCash or Easypaisa</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-ink" />
      </Link>
    );
  }
  if (live && !bill.boosts?.top && !bill.boosts?.featured && bill.boosts?.plans?.length) {
    const cheapest = [...bill.boosts.plans].sort((a: any, b: any) => a.price - b.price)[0];
    return (
      <Link href="/dashboard/boost" className="flex items-center gap-3 rounded-[22px] bg-accent p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white"><Rocket className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Get seen first in your city</span>
          <span className="block text-[14px] text-neutral-600">Boost your hotel to the top from {pkr(cheapest.price)} for {cheapest.days} days.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-ink" />
      </Link>
    );
  }
  return null;
}

function OwnerOverview() {
  const [mine, setMine] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);

  const load = useCallback(() => {
    hotelsApi.mine().then(async (m) => {
      setMine(m);
      if (!m.hotel) return;
      billingApi.mine().then(setBill).catch(() => undefined);
      const [s, p, a] = await Promise.all([bookingsApi.stats(), bookingsApi.list({ status: 'pending', limit: 8 }), bookingsApi.list({ view: 'arrivals', limit: 8 })]);
      setStats(s);
      setPending(p.items);
      setArrivals(a.items);
    }).catch(() => setMine({ hotel: null }));
  }, []);
  useEffect(() => load(), [load]);

  if (!mine) return <Loading />;
  if (!mine.hotel) return <NoHotelYet isAdmin={false} />;
  const h = mine.hotel;
  const u = mine.usage;
  const checklist = [
    { done: !!h.name && !!h.address, label: 'Hotel name and address', hint: 'So guests can find you', href: '/dashboard/hotel?tab=basics' },
    { done: !!h.coverImage && (h.gallery?.length ?? 0) >= 4, label: 'Add 5 or more photos', hint: 'Listings with photos get 4× more bookings', href: '/dashboard/hotel?tab=photos' },
    { done: mine.rooms.length > 0, label: 'Add rooms and prices', hint: 'Guests book a room, not a hotel', href: '/dashboard/rooms' },
    { done: (h.amenities?.length ?? 0) >= 5, label: 'Tick your facilities', hint: 'Wi-Fi, parking, generator…', href: '/dashboard/hotel?tab=amenities' },
    { done: !!(h.phone || h.whatsapp), label: 'Phone and WhatsApp', hint: 'Guests message you about bookings', href: '/dashboard/hotel?tab=contact' },
    { done: h.status === 'approved', label: 'Publish your hotel', hint: 'Go live on PakHotels', href: '/dashboard/hotel' },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const next = checklist.find((c) => !c.done);
  const live = h.status === 'approved';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{live ? 'Live on PakHotels' : 'Getting ready'}</p>
          <h1 className="font-display mt-2 text-[30px] font-bold leading-[1.05] tracking-[-0.025em] text-ink md:text-[40px]">Assalam o Alaikum{h.name ? <span className="block text-neutral-500 md:inline"> · {h.name}</span> : null}</h1>
        </div>
        <div className="flex gap-2">
          {live && <Link href={hotelPath(h.slug, h.citySlug)} target="_blank" className="btn-ghost btn-sm"><Eye className="h-4 w-4" /> My page</Link>}
          <Link href="/dashboard/bookings?new=1" className="btn-ink btn-sm"><Plus className="h-4 w-4" /> Walk-in booking</Link>
        </div>
      </div>

      <BillingNotice bill={bill} live={live} />

      {doneCount < checklist.length && (
        <section className="overflow-hidden rounded-[28px] bg-ink p-5 text-white md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-white/60">Setup · {doneCount} of {checklist.length} done</p>
              <p className="font-display mt-1 text-[24px] font-bold leading-tight md:text-[28px]">{next ? `Next: ${next.label.toLowerCase()}` : 'All set'}</p>
            </div>
            {next && <Link href={next.href} className="btn-yellow btn-sm">Continue <ArrowRight className="h-4 w-4" /></Link>}
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/15"><div className="h-full rounded-full bg-highlight transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((c, i) => (
              <li key={c.label}>
                <Link href={c.href} className={cn('flex items-center gap-3 rounded-[18px] p-3 transition', c.done ? 'bg-white/[0.04] text-white/50' : 'bg-white/[0.08] hover:bg-white/[0.14]')}>
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold', c.done ? 'bg-highlight text-ink' : 'border border-white/30 text-white')}>
                    {c.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-[15px] font-semibold', c.done && 'line-through')}>{c.label}</span>
                    {!c.done && <span className="block truncate text-[13px] text-white/55">{c.hint}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New requests" value={stats?.pending ?? '–'} icon={Clock} tone={stats?.pending ? 'warning' : 'neutral'} href="/dashboard/bookings" loading={!stats} />
        <StatCard label="Arriving today" value={stats?.arrivals ?? '–'} icon={DoorOpen} tone="info" href="/dashboard/bookings" loading={!stats} />
        <StatCard label="Staying now" value={stats?.inhouse ?? '–'} icon={BedDouble} href="/dashboard/bookings" loading={!stats} />
        <StatCard label="Leaving today" value={stats?.departures ?? '–'} icon={LogOut} loading={!stats} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[22px] font-bold text-ink">New requests</h2>
            <Link href="/dashboard/bookings" className="text-[15px] font-semibold text-ink underline underline-offset-4">All bookings</Link>
          </div>
          {pending.length ? (
            <ul className="space-y-2.5">{pending.map((b) => <RequestCard key={b._id} b={b} onDone={load} />)}</ul>
          ) : (
            <p className="rounded-[20px] border border-dashed border-neutral-300 bg-white p-8 text-center text-[15px] text-neutral-500">No requests waiting. New ones show here and on your phone.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-[22px] font-bold text-ink">Arriving today</h2>
          <div className="rounded-[22px] border border-[color:var(--border)] bg-white px-4">
            <RecentList items={arrivals} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[20px] font-bold text-ink">This month</h2>
              <p className="mt-0.5 text-[14px] text-neutral-500">{stats?.month ?? 0} bookings · {stats?.monthRoomNights ?? 0} room-nights · {pkr(stats?.monthRevenue)} booked · {h.views ?? 0} page views</p>
            </div>
            <p className="text-[12.5px] text-neutral-400">Bookings per day, last 30 days</p>
          </div>
          <div className="mt-4">{stats ? <Bars daily={stats.daily} /> : null}</div>
        </section>
        <section className="rounded-[22px] border border-[color:var(--border)] bg-white p-5">
          <p className="flex items-center gap-2 text-[17px] font-bold text-ink"><Wallet className="h-4 w-4" /> {mine.perks.plan} plan</p>
          {u?.monthlyBookings > 0 ? (
            <>
              <p className="mt-2 text-[14px] text-neutral-600">{u.bookingsThisMonth} of {u.monthlyBookings} online bookings used this month.</p>
              <div className="mt-2 h-2 rounded-full bg-neutral-100"><div className={cn('h-full rounded-full', u.bookingsThisMonth >= u.monthlyBookings ? 'bg-rose-500' : 'bg-primary')} style={{ width: `${Math.min(100, (u.bookingsThisMonth / u.monthlyBookings) * 100)}%` }} /></div>
              {u.bookingsThisMonth >= u.monthlyBookings * 0.7 && <p className="mt-2 text-[13px] text-neutral-600">When the limit is reached, online booking pauses until next month.</p>}
            </>
          ) : (
            <p className="mt-2 text-[14px] text-neutral-600">Unlimited online bookings · {mine.perks.commissionPercent ? `${mine.perks.commissionPercent}% on completed stays` : '0% commission'}.</p>
          )}
          {mine.perks.placement < 2 && (
            <Link href="/dashboard/purchase-package" className="btn-yellow btn-sm mt-4 w-full">Upgrade <ArrowRight className="h-4 w-4" /></Link>
          )}
        </section>
      </div>
    </div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState<any>(null);
  const [hotels, setHotels] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [concierge, setConcierge] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([
      bookingsApi.stats(),
      hotelsApi.adminList({ limit: 5 }),
      hotelsApi.claims('pending'),
      bookingsApi.list({ status: 'pending', unclaimed: '1', limit: 8 }),
    ]).then(([s, h, c, b]) => { setStats(s); setHotels(h); setClaims(c); setConcierge(b.items); }).catch(() => undefined);
  }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="PakHotels admin" description="Bookings across every hotel, hotels to approve, claims to call." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bookings waiting" value={stats?.pending ?? '–'} icon={Clock} tone={stats?.pending ? 'warning' : 'neutral'} href="/dashboard/bookings" loading={!stats} />
        <StatCard label="Bookings this month" value={stats?.month ?? '–'} icon={CalendarCheck} href="/dashboard/bookings" loading={!stats} hint={stats ? `${pkr(stats.monthRevenue)} for hotels` : undefined} />
        <StatCard label="Hotels to approve" value={hotels?.counts?.pending ?? 0} icon={Hotel} tone={hotels?.counts?.pending ? 'warning' : 'neutral'} href="/dashboard/hotels" loading={!hotels} />
        <StatCard label="Claims to call" value={claims.length} icon={KeyRound} tone={claims.length ? 'info' : 'neutral'} href="/dashboard/hotel-claims" loading={!hotels} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><p className="font-bold text-slate-900">Concierge: unclaimed-hotel bookings to confirm</p><Link href="/dashboard/bookings" className="text-sm font-semibold text-ink">All</Link></div>
          <p className="text-xs text-slate-500">Call the hotel, then confirm or decline here — the guest sees your answer.</p>
          <RecentList items={concierge} admin />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-bold text-slate-900">Hotels</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(hotels?.counts ?? {}).map(([k, v]) => (
              <li key={k}><Link href="/dashboard/hotels" className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 capitalize"><span>{k}</span><b>{String(v)}</b></Link></li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Last 30 days</div>
          <div className="mt-2">{stats ? <Bars daily={stats.daily} /> : null}</div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  if (!user) return <Loading />;
  return user.role === 'ADMIN' ? <AdminOverview /> : <OwnerOverview />;
}
