'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarDays, Check, Clock, Image as ImageIcon, Loader2, MessageCircle, Phone, Plus, Search, StickyNote, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/dashboard';
import { useAuth } from '@/context/auth-context';
import { BOOKING_STATUS, addDays, fmtDay, pkr, todayPk, waLink } from '@/lib/hotels';
import { apiError, bookingsApi, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { countryName, flag } from '@/lib/countries';

const VIEWS = [
  { key: 'pending', label: 'Requests', q: { status: 'pending' } },
  { key: 'arrivals', label: 'Arriving today', q: { view: 'arrivals' } },
  { key: 'inhouse', label: 'In-house', q: { view: 'inhouse' } },
  { key: 'upcoming', label: 'Upcoming', q: { view: 'upcoming' } },
  { key: 'all', label: 'All', q: {} },
] as const;

function msgFor(b: any, kind: 'confirm' | 'ask' | 'decline') {
  const dates = `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`;
  if (kind === 'confirm') return `Assalam o Alaikum ${b.guestName}, your booking ${b.ref} at ${b.hotelName} for ${dates} is confirmed. Total ${pkr(b.total)}. Please bring your ${b.guestForeign ? 'passport and visa' : 'CNIC'} at check-in. Thank you!`;
  if (kind === 'decline') return `Assalam o Alaikum ${b.guestName}, sorry — we cannot accept booking ${b.ref} (${dates}) at ${b.hotelName}.`;
  return `Assalam o Alaikum ${b.guestName}, this is ${b.hotelName} about your booking ${b.ref} (${dates}).`;
}

function BookingCard({ b, admin, onChanged }: { b: any; admin: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState('');
  const [reasonFor, setReasonFor] = useState<'declined' | 'cancelled' | 'no_show' | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(b.internalNote || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const s = BOOKING_STATUS[b.status] ?? { label: b.status, tone: 'bg-slate-100' };
  const today = todayPk();

  const act = async (status: string, extra: any = {}) => {
    setBusy(status);
    try {
      await bookingsApi.setStatus(b._id, { status, ...extra });
      toast.success(`Booking ${BOOKING_STATUS[status]?.label.toLowerCase() ?? status}`);
      if (status === 'confirmed' && (b.guestPhone?.startsWith('03') || b.guestPhone?.startsWith('+'))) {
        toast('Let the guest know on WhatsApp?', { action: { label: 'Send', onClick: () => window.open(waLink(b.guestPhone, msgFor(b, 'confirm')), '_blank') } });
      }
      onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  const adv = async (st: string) => {
    setBusy('adv');
    try {
      await bookingsApi.setAdvance(b._id, st);
      toast.success(st === 'received' ? 'Advance marked received' : 'Marked not received');
      onChanged();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <article className={cn('rounded-2xl border bg-white p-4', b.status === 'pending' ? 'border-amber-300' : 'border-slate-200')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[16px] font-bold text-slate-900">{b.guestName}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', s.tone)}>{s.label}</span>
            {b.source === 'dashboard' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Walk-in / phone</span>}
            {b.guestForeign && <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-ink">{flag(b.guestCountry)} Foreign guest · {countryName(b.guestCountry) || b.guestCountry}</span>}
          </div>
          {b.guestForeign && <p className="mt-1 text-xs font-medium text-ink">Check the passport and visa at check-in and file the police registration.</p>}
          {b.bookerName && <p className="mt-1 text-xs text-slate-600">Booked by {b.bookerName}{b.bookerPhone ? ` · ${b.bookerPhone}` : ''}</p>}
          {b.guestEmail && <p className="mt-0.5 text-xs text-slate-500">{b.guestEmail}</p>}
          <p className="mt-0.5 text-xs text-slate-500">
            {b.ref} · booked {new Date(b.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            {admin && <> · <b className="text-slate-700">{b.hotelName}</b>{!b.owner && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">unclaimed</span>}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-slate-900">{pkr(b.total)}</p>
          <p className="text-xs text-slate-500">{b.paymentMode === 'advance' ? `Advance ${pkr(b.advanceAmount)}` : 'Pay at hotel'}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" /><span><b>{fmtDay(b.checkIn)}</b> → {fmtDay(b.checkOut)}<span className="block text-xs text-slate-500">{b.nights} night{b.nights === 1 ? '' : 's'}{b.checkIn === today ? ' · arriving today' : ''}</span></span></p>
        <p className="text-slate-700">{b.rooms.map((r: any) => `${r.qty}× ${r.name}`).join(', ')}<span className="block text-xs text-slate-500">{b.adults} adult{b.adults === 1 ? '' : 's'}{b.children ? `, ${b.children} children` : ''}{b.extraBeds ? `, ${b.extraBeds} extra mattress` : ''}</span></p>
        <p className="text-slate-700">{b.arrivalTime ? <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {b.arrivalTime}</span> : <span className="text-slate-400">Arrival time not given</span>}{b.purpose && <span className="block text-xs capitalize text-slate-500">{b.purpose} trip</span>}</p>
      </div>
      {b.specialRequests && <p className="mt-2 rounded-lg bg-sky-50 p-2.5 text-sm text-sky-900"><b>Request:</b> {b.specialRequests}</p>}
      {b.status === 'pending' && b.expiresAt && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Reply by {new Date(b.expiresAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} or it expires.</p>
      )}

      {b.paymentMode === 'advance' && b.advanceStatus !== 'none' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
          <ImageIcon className="h-4 w-4 text-slate-400" />
          <span>Advance {b.advanceStatus === 'submitted' ? 'proof uploaded' : b.advanceStatus}{b.advanceMethod ? ` · ${b.advanceMethod}` : ''}{b.advanceNote ? ` · ${b.advanceNote}` : ''}</span>
          {b.advanceProofUrl && <a href={b.advanceProofUrl} target="_blank" rel="noopener" className="font-semibold text-ink">View screenshot</a>}
          {b.advanceStatus === 'submitted' && (
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => adv('rejected')}>Not received</Button>
              <Button size="sm" disabled={!!busy} onClick={() => adv('received')}>Received</Button>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.guestPhone?.length > 5 && (
          <>
            <a href={`tel:${b.guestPhone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium"><Phone className="h-4 w-4" /> {b.guestPhone}</a>
            <a href={waLink(b.guestPhone, msgFor(b, b.status === 'confirmed' ? 'confirm' : 'ask'))} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </>
        )}
        <button type="button" onClick={() => setNoteOpen((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100"><StickyNote className="h-4 w-4" /> Note</button>
        <span className="ml-auto flex flex-wrap gap-2">
          {b.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setReasonFor('declined')} className="gap-1"><X className="h-4 w-4" /> Decline</Button>
              <Button size="sm" disabled={!!busy} onClick={() => act('confirmed')} className="gap-1">{busy === 'confirmed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm</Button>
            </>
          )}
          {b.status === 'expired' && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('confirmed')}>Confirm anyway</Button>}
          {b.status === 'confirmed' && (
            <>
              {/* After the check-in date a web booking can't be cancelled — the guest either came (check in) or didn't (no-show). */}
              {(admin || b.source !== 'web' || b.checkIn >= today) && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { setReason(''); setReasonFor('cancelled'); }}>Cancel</Button>}
              {b.checkIn <= today && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setReason(''); setReasonFor('no_show'); }}>No-show</Button>}
              <Button size="sm" disabled={!!busy || b.checkIn > today} title={b.checkIn > today ? `Check-in is on ${fmtDay(b.checkIn)}` : ''} onClick={() => act('checked_in')}>Check in</Button>
            </>
          )}
          {b.status === 'checked_in' && <Button size="sm" disabled={!!busy} onClick={() => act('completed')}>Check out</Button>}
        </span>
      </div>
      {noteOpen && (
        <div className="mt-2 flex gap-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private note (only you see this)" />
          <Button size="sm" onClick={async () => { await bookingsApi.setNote(b._id, { internalNote: note }).catch(() => undefined); toast.success('Saved'); setNoteOpen(false); }}>Save</Button>
        </div>
      )}

      <Dialog open={!!reasonFor} onOpenChange={(v) => !v && setReasonFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonFor === 'declined' ? 'Decline this booking?' : reasonFor === 'no_show' ? 'The guest did not come?' : 'Cancel this booking?'}</DialogTitle>
            <DialogDescription>
              {reasonFor === 'no_show'
                ? 'The guest sees this and can tell us if they did stay — we check both sides before anything changes.'
                : 'The guest sees this on their booking page.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(reasonFor === 'no_show'
              ? ['Guest did not arrive', 'Guest stopped answering the phone', 'Guest cancelled by phone on the day']
              : ['Fully booked for these dates', 'Could not reach the guest', 'Guest asked to cancel', 'Rooms under maintenance']
            ).map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1 text-sm', reason === r ? 'border-ink bg-accent' : 'border-slate-200')}>{r}</button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReasonFor(null)}>Back</Button>
            <Button variant="destructive" disabled={reasonFor === 'no_show' && reason.trim().length < 3} onClick={async () => { const st = reasonFor!; setReasonFor(null); await act(st, { note: reason }); }}>
              {reasonFor === 'declined' ? 'Decline' : reasonFor === 'no_show' ? 'Mark no-show' : 'Cancel booking'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function ManualBooking({ open, onOpenChange, onDone, hotelId }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void; hotelId: string | null }) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [f, setF] = useState({ checkIn: todayPk(), checkOut: addDays(todayPk(), 1), roomId: '', qty: 1, price: '', guestName: '', guestPhone: '', adults: 2, status: 'confirmed', internalNote: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    hotelsApi.mine(hotelId).then((d) => { setRooms(d.rooms ?? []); setF((x) => ({ ...x, roomId: x.roomId || d.rooms?.[0]?._id || '' })); }).catch(() => undefined);
  }, [open, hotelId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a walk-in or phone booking</DialogTitle>
          <DialogDescription>Keeps your rooms right so online guests can&apos;t book a room that&apos;s taken.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label><span className="mb-1 block font-semibold">Check-in</span><Input type="date" value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} /></label>
          <label><span className="mb-1 block font-semibold">Check-out</span><Input type="date" value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} /></label>
          <label className="col-span-2"><span className="mb-1 block font-semibold">Room</span>
            <select className="h-10 w-full rounded-md border border-input bg-white px-3" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
              {rooms.map((r) => <option key={r._id} value={r._id}>{r.name} — {pkr(r.price)}</option>)}
            </select>
          </label>
          <label><span className="mb-1 block font-semibold">Rooms</span><Input type="number" min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></label>
          <label><span className="mb-1 block font-semibold">Price / night (optional)</span><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Room price" /></label>
          <label><span className="mb-1 block font-semibold">Guest name</span><Input value={f.guestName} onChange={(e) => setF({ ...f, guestName: e.target.value })} /></label>
          <label><span className="mb-1 block font-semibold">Mobile</span><Input value={f.guestPhone} onChange={(e) => setF({ ...f, guestPhone: e.target.value })} /></label>
          <label><span className="mb-1 block font-semibold">Adults</span><Input type="number" min={1} value={f.adults} onChange={(e) => setF({ ...f, adults: Number(e.target.value) })} /></label>
          <label><span className="mb-1 block font-semibold">Status</span>
            <select className="h-10 w-full rounded-md border border-input bg-white px-3" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="confirmed">Confirmed</option><option value="checked_in">Checked in now</option>
            </select>
          </label>
          <label className="col-span-2"><span className="mb-1 block font-semibold">Note</span><Input value={f.internalNote} onChange={(e) => setF({ ...f, internalNote: e.target.value })} /></label>
        </div>
        <Button
          disabled={busy || !f.roomId}
          onClick={async () => {
            setBusy(true);
            try {
              await bookingsApi.manual({ ...f, rooms: [{ roomId: f.roomId, qty: f.qty, price: f.price ? Number(f.price) : undefined }] }, hotelId);
              toast.success('Booking added');
              onOpenChange(false);
              onDone();
            } catch (e) {
              toast.error(apiError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add booking
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Bookings() {
  const sp = useSearchParams();
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const hotelId = sp?.get('hotelId') || null;
  const [view, setView] = useState<string>(sp?.get('ref') ? 'all' : 'pending');
  const [q, setQ] = useState(sp?.get('ref') ?? '');
  const [unclaimed, setUnclaimed] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<{ items: any[]; total: number; pages: number } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [manual, setManual] = useState(sp?.get('new') === '1');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const v = VIEWS.find((x) => x.key === view)!;
    try {
      const [r, s] = await Promise.all([
        bookingsApi.list({ ...v.q, q: q || undefined, page, hotelId: hotelId || undefined, unclaimed: unclaimed ? '1' : undefined }),
        bookingsApi.stats(hotelId),
      ]);
      setRes(r);
      setStats(s);
      setErr('');
    } catch (e) {
      setErr(apiError(e));
    }
  }, [view, q, page, hotelId, unclaimed]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, user, q]);

  // New requests arrive while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const counts: Record<string, number | undefined> = { pending: stats?.pending, arrivals: stats?.arrivals, inhouse: stats?.inhouse, upcoming: stats?.upcoming };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Bookings"
        description={admin && !hotelId ? 'Every booking on PakHotels. Unclaimed hotels are yours to confirm by phone.' : 'Confirm requests quickly — guests book elsewhere if they wait.'}
        actions={(!admin || hotelId) ? <Button onClick={() => setManual(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Walk-in booking</Button> : undefined}
      />
      {err && err.includes('not added your hotel') ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Add your hotel first — then bookings appear here.</p>
      ) : (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" onClick={() => { setView(v.key); setPage(1); }} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium', view === v.key ? 'bg-primary text-primary-foreground' : 'bg-white text-slate-700 ring-1 ring-slate-200')}>
                {v.label}
                {counts[v.key] ? <span className={cn('rounded-full px-1.5 text-xs', view === v.key ? 'bg-white/20' : 'bg-amber-100 text-amber-800')}>{counts[v.key]}</span> : null}
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name, mobile or reference" className="pl-9" />
            </div>
            {admin && !hotelId && (
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <input type="checkbox" checked={unclaimed} onChange={(e) => setUnclaimed(e.target.checked)} /> Unclaimed hotels only
              </label>
            )}
          </div>
          {!res ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : res.items.length ? (
            <div className="space-y-3">
              {res.items.map((b) => <BookingCard key={b._id} b={b} admin={admin} onChanged={load} />)}
              {res.pages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="px-2 py-1.5 text-sm text-slate-500">Page {page} of {res.pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= res.pages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {view === 'pending' ? 'No requests waiting. New bookings appear here with a notification.' : 'No bookings here.'}
            </div>
          )}
        </>
      )}
      <ManualBooking open={manual} onOpenChange={setManual} onDone={load} hotelId={hotelId} />
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <Bookings />
    </Suspense>
  );
}
