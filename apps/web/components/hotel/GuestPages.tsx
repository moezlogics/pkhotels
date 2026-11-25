'use client';

import PhoneField from '@/components/hotel/PhoneField';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Heart, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { BOOKING_STATUS, fmtDay, pkr, todayPk, type HotelCardData } from '@/lib/hotels';
import { photo } from '@/lib/img';
import { apiError, bookingsApi, deviceBookings, getWishlist } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import HotelCard from './HotelCard';

function BookingRow({ b, t }: { b: any; t: string }) {
  const s = BOOKING_STATUS[b.status] ?? { label: b.status, tone: '' };
  return (
    <Link href={`/booking/${b.ref}?t=${t}`} className="flex items-center gap-3 py-3">
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-neutral-200">
        {b.hotelCover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo(b.hotelCover, 160)} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold text-ink">{b.hotelName}</p>
        <p className="text-[15px] text-neutral-500">{fmtDay(b.checkIn, { day: 'numeric', month: 'short' })} – {fmtDay(b.checkOut, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <p className="text-[14px] text-neutral-500">{s.label}, {pkr(b.total)}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
    </Link>
  );
}

const ACTIVE = ['pending', 'confirmed', 'checked_in'];

/** Trips of the signed-in account (and any made on this phone before accounts were required). */
export function MyBookingsInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const [rows, setRows] = useState<{ b: any; t: string }[] | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (isLoading) return;
    (async () => {
      const out = new Map<string, { b: any; t: string }>();
      if (isAuthenticated) {
        try {
          for (const b of await bookingsApi.my()) out.set(b.ref, { b, t: b.token });
        } catch {
          /* ignore */
        }
      }
      await Promise.all(
        deviceBookings()
          .filter((x) => !out.has(x.ref))
          .map(async (x) => {
            try {
              out.set(x.ref, { b: await bookingsApi.byRef(x.ref, x.t), t: x.t });
            } catch {
              /* gone */
            }
          }),
      );
      setRows([...out.values()]);
    })();
  }, [isAuthenticated, isLoading]);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;

  if (!isAuthenticated && !rows.length) {
    return (
      <div className="mt-6 max-w-md">
        <p className="text-[19px] font-semibold text-ink">Sign in to see your trips</p>
        <p className="mt-1 text-[16px] text-neutral-500">Every booking is saved to your account, with the hotel’s reply and your receipt.</p>
        <div className="mt-5 flex gap-2">
          <Button asChild className="h-12 rounded-full px-6 text-[16px]"><Link href="/login?next=/trips">Sign in</Link></Button>
          <Button asChild variant="outline" className="h-12 rounded-full px-6 text-[16px]"><Link href="/register?next=/trips">Create account</Link></Button>
        </div>
      </div>
    );
  }

  const today = todayPk();
  const upcoming = rows.filter((r) => ACTIVE.includes(r.b.status) && r.b.checkOut >= today).sort((a, b) => (a.b.checkIn > b.b.checkIn ? 1 : -1));
  const past = rows.filter((r) => !upcoming.includes(r)).sort((a, b) => (a.b.checkIn < b.b.checkIn ? 1 : -1));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="mt-4">
      <div className="flex gap-6 border-b border-neutral-200">
        {(['upcoming', 'past'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn('-mb-px border-b-2 pb-2.5 text-[16px] font-medium capitalize', tab === k ? 'border-ink text-ink' : 'border-transparent text-neutral-500')}>
            {k} {k === 'upcoming' && upcoming.length ? `(${upcoming.length})` : ''}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="divide-y divide-neutral-100">{list.map((r) => <BookingRow key={r.b.ref} b={r.b} t={r.t} />)}</div>
      ) : (
        <div className="py-10">
          <p className="text-[19px] font-semibold text-ink">{tab === 'upcoming' ? 'No trips booked yet' : 'No past trips'}</p>
          <p className="mt-1 text-[16px] text-neutral-500">{tab === 'upcoming' ? 'When you book a hotel it shows up here.' : 'Stays you have finished or cancelled show up here.'}</p>
          {tab === 'upcoming' && <Button asChild className="mt-4 h-12 rounded-xl px-6 text-[16px]"><Link href="/hotels">Find a hotel</Link></Button>}
        </div>
      )}
    </div>
  );
}

export function WishlistInner() {
  const [items, setItems] = useState<HotelCardData[] | null>(null);
  useEffect(() => {
    const load = async () => {
      const slugs = getWishlist();
      if (!slugs.length) return setItems([]);
      const res = await Promise.all(
        slugs.map((s) =>
          fetch(`/api/hotels/slug/${s}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      setItems(res.filter(Boolean));
    };
    void load();
    window.addEventListener('ph-wishlist', load);
    return () => window.removeEventListener('ph-wishlist', load);
  }, []);
  if (!items) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;
  if (!items.length)
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
        <Heart className="mx-auto h-9 w-9 text-neutral-300" />
        <p className="mt-3 font-semibold text-neutral-900">No saved hotels yet</p>
        <Button asChild className="mt-4"><Link href="/hotels">Browse hotels</Link></Button>
      </div>
    );
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((h) => <HotelCard key={h._id} hotel={h} />)}
    </div>
  );
}

export function FindBookingInner() {
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Find my booking</h1>
      <p className="mt-1 text-sm text-neutral-500">Hotels can also verify a guest&apos;s booking here.</p>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            const r = await bookingsApi.lookup(ref.trim(), phone);
            router.push(`/booking/${r.ref}?t=${r.token}`);
          } catch (er) {
            setErr(apiError(er, 'No booking matches that reference and mobile number.'));
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-neutral-700">Booking reference</span>
          <Input required className="h-12 uppercase tracking-wider" placeholder="PH-XXXXXX" value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <div className="block">
          <span className="mb-1 block text-sm font-semibold text-neutral-700">Mobile number used for the booking</span>
          <PhoneField value={phone} onChange={setPhone} />
        </div>
        {err && <p className="rounded-lg bg-accent p-2.5 text-sm text-ink">{err}</p>}
        <Button type="submit" className="h-12 w-full gap-2 text-[16px] font-semibold" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find booking
        </Button>
      </form>
    </div>
  );
}

