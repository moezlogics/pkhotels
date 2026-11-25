'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/dashboard';
import { useAuth } from '@/context/auth-context';
import { apiError, bookingsApi } from '@/lib/hotels-api';

function Reviews() {
  const sp = useSearchParams();
  const hotelId = sp?.get('hotelId') || null;
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const [rows, setRows] = useState<any[] | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRows(await bookingsApi.reviews(hotelId));
    } catch (e) {
      toast.error(apiError(e));
      setRows([]);
    }
  }, [hotelId]);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Guest reviews" description="Every review is from a guest who booked and stayed. A short, polite reply shows future guests you care." />
      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No reviews yet. Guests can review after their stay.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{r.guestName} <span className="text-xs font-normal text-slate-500">· {r.stayMonth} {r.status !== 'approved' && `· ${r.status}`}</span></p>
                <span className="inline-flex items-center gap-1 font-bold"><Star className="h-4 w-4 fill-gold text-gold" /> {r.rating}</span>
              </div>
              {r.title && <p className="mt-1 font-semibold text-slate-800">{r.title}</p>}
              {r.text && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.text}</p>}
              {r.reply ? (
                <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700"><b>Your reply:</b> {r.reply}</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Textarea rows={2} placeholder="Write a reply…" value={reply[r._id] ?? ''} onChange={(e) => setReply({ ...reply, [r._id]: e.target.value })} />
                  <Button size="sm" disabled={!reply[r._id]?.trim()} onClick={async () => { try { await bookingsApi.reply(r._id, reply[r._id]!); toast.success('Reply posted'); await load(); } catch (e) { toast.error(apiError(e)); } }}>Reply</Button>
                </div>
              )}
              {admin && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { await bookingsApi.moderate(r._id, r.status === 'hidden' ? 'approved' : 'hidden'); await load(); }}>{r.status === 'hidden' ? 'Show' : 'Hide'}</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HotelReviewsPage() {
  return (
    <Suspense>
      <Reviews />
    </Suspense>
  );
}
