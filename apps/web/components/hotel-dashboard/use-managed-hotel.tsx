'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Hotel, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { apiError, hotelsApi } from '@/lib/hotels-api';

export interface ManagedHotel {
  hotel: any | null;
  rooms: any[];
  perks: any;
  usage: any;
}

/**
 * The hotel a dashboard screen works on: the owner's own, or — for an admin —
 * the one in ?hotelId= (admins manage unclaimed hotels with the same screens).
 */
export function useManagedHotel() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const hotelId = sp?.get('hotelId') || null;
  const [data, setData] = useState<ManagedHotel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hotelsApi.mine(hotelId));
      setError('');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    if (!user) return;
    void reload();
  }, [user, reload]);

  /** Keeps ?hotelId= on links between the hotel screens for admins. */
  const withScope = (href: string) => (hotelId ? `${href}${href.includes('?') ? '&' : '?'}hotelId=${hotelId}` : href);

  return { data, setData, error, loading, reload, hotelId, isAdmin, withScope };
}

export function Loading() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
}

/** Shown on hotel screens before the account has added its hotel. */
export function NoHotelYet({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Hotel className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-900">Choose a hotel first</p>
        <p className="mt-1 text-sm text-slate-500">Open a hotel from All Hotels and use its Rooms, Calendar or Edit buttons.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/hotels">All hotels</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-ink">
        <Sparkles className="h-7 w-7" />
      </span>
      <p className="mt-4 text-lg font-bold text-slate-900">Add your hotel to start taking bookings</p>
      <p className="mt-1 text-sm text-slate-500">It takes about 10 minutes: name, location, photos and your rooms. Free to list.</p>
      <Button asChild className="mt-5">
        <Link href="/dashboard/hotel">Add my hotel</Link>
      </Button>
      <p className="mt-4 text-xs text-slate-500">
        Is your hotel already on PakHotels? Open its page and press <b>Claim this hotel</b>.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Looking for a room you booked? <Link href="/trips" className="font-semibold text-ink">See my bookings</Link>
      </p>
    </div>
  );
}

export function UpgradeHint({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span>{text}</span>
      <Link href="/dashboard/purchase-package" className="font-bold text-amber-900 underline">
        Upgrade plan
      </Link>
    </div>
  );
}
