'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard';
import { hotelPath, waLink } from '@/lib/hotels';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

/** "This is my hotel" requests: call the person, then approve to hand the listing over. */
export default function HotelClaims() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<any[] | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(await hotelsApi.claims(status));
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [status]);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, s: 'approved' | 'rejected') => {
    const adminNote = s === 'rejected' ? window.prompt('Reason (shown to the team only)') ?? '' : '';
    try {
      await hotelsApi.decideClaim(id, { status: s, adminNote });
      toast.success(s === 'approved' ? 'Approved — the hotel is now in their account' : 'Rejected');
      await load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Hotel claims" description="Call the person to confirm they run the hotel before approving." />
      <div className="mb-4 flex gap-1">
        {['pending', 'approved', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium capitalize', status === s ? 'bg-primary text-primary-foreground' : 'bg-white ring-1 ring-slate-200')}>{s}</button>
        ))}
      </div>
      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{c.hotel ? <Link href={hotelPath(c.hotel.slug, c.hotel.citySlug)} target="_blank" className="hover:text-ink">{c.hotel.name}</Link> : 'Deleted hotel'} <span className="text-sm font-normal text-slate-500">· {c.hotel?.cityName}</span></p>
                  <p className="mt-1 text-sm text-slate-700">{c.name} · {c.role} · account {c.user?.email}</p>
                  {c.message && <p className="mt-1 text-sm text-slate-600">“{c.message}”</p>}
                  <p className="mt-1 text-xs text-slate-400">{new Date(c.createdAt).toLocaleString('en-PK')} · {c.status}{c.adminNote ? ` · ${c.adminNote}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${c.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm"><Phone className="h-4 w-4" /> {c.phone}</a>
                  <a href={waLink(c.phone, `Assalam o Alaikum ${c.name}, this is PakHotels about your request to manage ${c.hotel?.name}.`)} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                  {c.status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => decide(c._id, 'rejected')}>Reject</Button>
                      <Button size="sm" onClick={() => decide(c._id, 'approved')}>Approve</Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
