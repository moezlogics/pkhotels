'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays, CheckCircle2, Clock, Copy, IdCard, Loader2, MapPin, MessageCircle, Navigation, Phone, Share2, Star, Upload, Users, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { photo } from '@/lib/img';
import { BOOKING_STATUS, COUPLE_POLICIES, fmtDay, fmtTime, hotelPath, idRule, pkr, waLink } from '@/lib/hotels';
import { countryName, flag, prettyPhone } from '@/lib/countries';
import { Approx } from '@/components/Currency';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved } from '@/lib/site-settings';
import { apiError, bookingsApi, rememberBooking } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

function Stars({ value, onChange, size = 'h-7 w-7' }: { value: number; onChange: (n: number) => void; size?: string }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} stars`} onClick={() => onChange(n)}>
          <Star className={cn(size, n <= value ? 'fill-gold text-gold' : 'text-neutral-300')} />
        </button>
      ))}
    </div>
  );
}

/**
 * The hotel marked the stay cancelled or a no-show, but the guest was there.
 * One tap tells PakHotels; the team checks with both sides.
 */
function StayedButton({ refCode, t, onDone }: { refCode: string; t: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full rounded-xl border border-neutral-200 p-3 text-left text-sm text-neutral-700 hover:bg-neutral-50">
        <span className="font-semibold text-ink">Did you actually stay at this hotel?</span> Tell us and we will put it right.
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3">
      <p className="text-sm font-semibold text-ink">Tell us what happened</p>
      <Textarea className="mt-2" rows={3} maxLength={500} placeholder="e.g. We checked in on the 12th and stayed two nights in room 204." value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => setOpen(false)}>Back</Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await bookingsApi.stayed(refCode, { t, note });
              toast.success('Thank you — we will check and get back to you.');
              onDone();
            } catch (e) {
              toast.error(apiError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
    </div>
  );
}

/** An .ics file so the stay lands in the phone's calendar. */
function downloadIcs(b: any, h: any) {
  const d = (s: string) => s.replace(/-/g, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PakHotels//Booking//EN', 'BEGIN:VEVENT',
    'UID:' + b.ref + '@pakhotels.pk', 'DTSTART;VALUE=DATE:' + d(b.checkIn), 'DTEND;VALUE=DATE:' + d(b.checkOut),
    'SUMMARY:Stay at ' + (h.name || b.hotelName), 'LOCATION:' + String(h.address || b.cityName || '').replace(/[,;]/g, ' '),
    'DESCRIPTION:Booking ref ' + b.ref + '. Bring your CNIC.', 'END:VEVENT', 'END:VCALENDAR',
  ].join(String.fromCharCode(13, 10));
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = b.ref + '.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BookingView({ refCode }: { refCode: string }) {
  const sp = useSearchParams();
  const t = sp?.get('t') ?? '';
  const isNew = sp?.get('new') === '1';
  const [b, setB] = useState<any>(null);
  const [err, setErr] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ url: string; method: string; note: string }>({ url: '', method: '', note: '' });
  const [review, setReview] = useState({ rating: 0, cleanliness: 0, staff: 0, location: 0, value: 0, title: '', text: '' });
  const site = resolved(useSiteSettings());

  const load = useCallback(async () => {
    try {
      const data = await bookingsApi.byRef(refCode, t);
      setB(data);
      rememberBooking(refCode, t);
    } catch (e) {
      setErr(apiError(e, 'Booking not found. Check the link in your confirmation.'));
    }
  }, [refCode, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-rose-400" />
        <p className="mt-3 font-semibold text-neutral-900">{err}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/find-booking">Find my booking</Link>
        </Button>
      </div>
    );
  }
  if (!b) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-neutral-400" /></div>;

  const h = b.hotel ?? {};
  const status = BOOKING_STATUS[b.status] ?? { label: b.status, tone: 'bg-neutral-100' };
  const dates = `${fmtDay(b.checkIn)} – ${fmtDay(b.checkOut)}`;
  const waText = `Assalam o Alaikum, I booked ${h.name} on PakHotels.pk.\nBooking ref: ${b.ref}\nName: ${b.guestName}\nDates: ${dates} (${b.nights} night${b.nights === 1 ? '' : 's'})\nRooms: ${b.rooms.map((r: any) => `${r.qty}× ${r.name}`).join(', ')}`;
  const manageUrl = typeof window !== 'undefined' ? window.location.origin + `/booking/${b.ref}?t=${t}` : '';
  const couple = COUPLE_POLICIES[h.couplePolicy || 'not_stated'];

  const foreign = !!b.guestForeign;
  const live = ['pending', 'confirmed', 'checked_in'].includes(b.status);
  const tone: 'ok' | 'wait' | 'closed' = ['confirmed', 'checked_in', 'completed'].includes(b.status) ? 'ok' : b.status === 'pending' ? 'wait' : 'closed';
  const heading =
    b.status === 'pending' ? (isNew ? 'Request sent!' : 'Waiting for the hotel')
    : b.status === 'confirmed' ? 'You’re booked!'
    : b.status === 'checked_in' ? 'Enjoy your stay'
    : b.status === 'completed' ? 'Thanks for staying'
    : b.status === 'declined' ? 'The hotel could not accept this booking'
    : b.status === 'expired' ? 'The hotel did not answer in time'
    : b.status === 'no_show' ? 'Marked as a no-show'
    : 'This booking was cancelled';
  const sub =
    b.status === 'pending'
      ? `${h.name || b.hotelName} usually replies within ${h.responseHours ?? 12} hours${b.expiresAt ? ` (by ${new Date(b.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}, Pakistan time)` : ''}. We’ll let you know the moment they confirm.`
      : b.status === 'confirmed'
        ? `Your room at ${h.name || b.hotelName} is held for you. Show reference ${b.ref} and your ${foreign ? 'passport' : 'CNIC'} at check-in.`
        : b.status === 'checked_in' ? 'Need anything? Call or WhatsApp the front desk below.'
        : b.status === 'completed' ? 'We hope you had a good stay.'
        : b.cancelReason ? `Reason: ${b.cancelReason}` : '';
  const contactPhone = h.phone || (!h.claimed ? site.phone : '');
  const contactWa = h.whatsapp || h.phone || (!h.claimed ? site.whatsapp : '');
  const directions = h.lat ? `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name} ${h.address || b.cityName}`)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Status ── */}
      <section
        className={cn(
          'overflow-hidden rounded-[28px] p-5 md:p-7',
          tone === 'ok' ? 'grain bg-primary text-white' : tone === 'wait' ? 'grain bg-ink text-white' : 'bg-white text-ink ring-1 ring-[color:var(--border)]',
        )}
      >
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'grid h-12 w-12 shrink-0 place-items-center rounded-full',
              tone === 'ok' ? 'bg-white text-primary' : tone === 'wait' ? 'bg-highlight text-ink' : 'bg-surface text-neutral-500',
            )}
          >
            {tone === 'ok' ? <CheckCircle2 className="h-6 w-6" /> : tone === 'wait' ? <Clock className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className={cn('text-[12.5px] font-bold uppercase tracking-[0.12em]', tone === 'closed' ? 'text-neutral-500' : 'text-white/75')}>{status.label}</p>
            <h1 className="font-display mt-1 text-[26px] font-bold leading-[1.1] md:text-[32px]">{heading}</h1>
            {sub && <p className={cn('mt-2 text-[15.5px] leading-relaxed', tone === 'closed' ? 'text-neutral-600' : 'text-white/85')}>{sub}</p>}
          </div>
        </div>

        <div className={cn('mt-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3', tone === 'closed' ? 'bg-surface' : 'bg-white/12 ring-1 ring-white/15')}>
          <div className="min-w-0">
            <p className={cn('text-[12.5px]', tone === 'closed' ? 'text-neutral-500' : 'text-white/70')}>Booking reference</p>
            <p className="font-display text-[24px] font-bold tracking-[0.06em] tabular">{b.ref}</p>
          </div>
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(b.ref); toast.success('Reference copied'); }}
            className={cn('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold', tone === 'closed' ? 'bg-ink text-white' : 'bg-white text-ink')}
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>

        {live && (
          <ol className="mt-5 grid grid-cols-3 gap-2">
            {[
              { k: 'sent', l: 'Request sent', done: true },
              { k: 'confirmed', l: 'Hotel confirmed', done: ['confirmed', 'checked_in', 'completed'].includes(b.status) },
              { k: 'stay', l: 'Checked in', done: ['checked_in', 'completed'].includes(b.status) },
            ].map((x) => (
              <li key={x.k}>
                <div className={cn('h-1.5 rounded-full', x.done ? (tone === 'wait' ? 'bg-highlight' : 'bg-white') : 'bg-white/25')} />
                <p className={cn('mt-1.5 text-[13px]', x.done ? 'font-semibold text-white' : 'text-white/60')}>{x.l}</p>
              </li>
            ))}
          </ol>
        )}
        {['declined', 'expired', 'cancelled'].includes(b.status) && (
          <Link href={`/hotels/${h.citySlug || (b.cityName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}?checkIn=${b.checkIn}&checkOut=${b.checkOut}`} className="btn-yellow btn-sm mt-4">
            Find another hotel in {b.cityName}
          </Link>
        )}
      </section>

      {b.status === 'no_show' && b.history?.length > 0 && (
        <p className="rounded-2xl bg-white p-4 text-[14.5px] text-neutral-700 ring-1 ring-[color:var(--border)]">Hotel’s note: {[...b.history].reverse().find((x: any) => x.status === 'no_show')?.note || '—'}</p>
      )}
      {b.stayDispute === 'open' && (
        <p className="rounded-2xl bg-accent p-4 text-[14.5px] text-ink">Thanks — we have your message that you stayed. Our team will check with you and the hotel.</p>
      )}
      {b.canDispute && <StayedButton refCode={refCode} t={t} onDone={load} />}
      {b.hotelNote && <p className="rounded-2xl bg-accent p-4 text-[14.5px] text-ink"><b>Message from the hotel:</b> {b.hotelNote}</p>}

      {/* ── Contact the hotel ── */}
      {b.status !== 'declined' && (contactPhone || contactWa) && (
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--border)]">
          <p className="eyebrow">{h.claimed ? 'Contact the hotel' : 'Contact PakHotels'}</p>
          <div className="mt-3 flex items-center gap-3">
            {h.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo(h.coverImage, 160)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0">
              <Link href={hotelPath(h.slug || b.hotelSlug, h.citySlug)} className="block truncate text-[17px] font-semibold text-ink hover:text-primary">{h.name || b.hotelName}</Link>
              <p className="flex items-start gap-1 text-[14px] text-neutral-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">{h.address || b.cityName}</span></p>
            </div>
          </div>
          {contactPhone && (
            <a href={`tel:${contactPhone}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
              <span>
                <span className="block text-[12.5px] text-neutral-500">{h.claimed ? 'Front desk' : 'PakHotels concierge'}</span>
                <span className="block text-[19px] font-semibold text-ink tabular">{contactPhone}</span>
              </span>
              <Phone className="h-5 w-5 text-primary" />
            </a>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {contactPhone && <a href={`tel:${contactPhone}`} className="btn-yellow btn-sm px-2"><Phone className="h-4 w-4" /> Call</a>}
            {contactWa && <a href={waLink(contactWa, waText)} target="_blank" rel="noopener" className="btn-ink btn-sm px-2"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            <a href={directions} target="_blank" rel="noopener" className="btn-ghost btn-sm px-2"><Navigation className="h-4 w-4" /> Directions</a>
          </div>
          <p className="mt-3 text-[13.5px] text-neutral-500">
            {h.claimed ? `Mention reference ${b.ref} when you call.` : `The PakHotels team is confirming this booking with the hotel for you and will call you on ${b.guestPhone}.`}
          </p>
        </section>
      )}

      {/* ── Your stay ── */}
      <section className="rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--border)]">
        <p className="eyebrow">Your stay</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div><dt className="text-[13px] text-neutral-500">Check-in</dt><dd className="text-[16px] font-semibold text-ink">{fmtDay(b.checkIn)}</dd><dd className="text-[13px] text-neutral-500">from {fmtTime(h.checkInTime)} PKT</dd></div>
          <div><dt className="text-[13px] text-neutral-500">Check-out</dt><dd className="text-[16px] font-semibold text-ink">{fmtDay(b.checkOut)}</dd><dd className="text-[13px] text-neutral-500">until {fmtTime(h.checkOutTime)} PKT</dd></div>
          <div><dt className="text-[13px] text-neutral-500">Guests</dt><dd className="text-[16px] font-semibold text-ink">{b.adults} adult{b.adults === 1 ? '' : 's'}{b.children ? `, ${b.children} child${b.children === 1 ? '' : 'ren'}` : ''}</dd><dd className="text-[13px] text-neutral-500">{b.nights} night{b.nights === 1 ? '' : 's'}</dd></div>
        </dl>
        <div className="mt-4 rounded-2xl bg-surface p-4 text-[14.5px]">
          <p className="text-neutral-500">Checking in</p>
          <p className="font-semibold text-ink">{b.guestName}{foreign && b.guestCountry ? ` · ${flag(b.guestCountry)} ${countryName(b.guestCountry)} passport` : ''}</p>
          <p className="text-neutral-600 tabular">{prettyPhone(b.guestPhone)}{b.guestEmail ? ` · ${b.guestEmail}` : ''}</p>
          {b.bookerName && <p className="mt-1 text-neutral-500">Booked by {b.bookerName}</p>}
        </div>

        <div className="mt-4 space-y-2 text-[15px]">
          {b.rooms.map((r: any) => (
            <div key={String(r.room)} className="flex justify-between gap-3"><span className="text-neutral-700">{r.qty} × {r.name}</span><span className="tabular">{pkr(r.subtotal)}</span></div>
          ))}
          {b.extrasTotal > 0 && <div className="flex justify-between"><span className="text-neutral-700">Extra mattress</span><span className="tabular">{pkr(b.extrasTotal)}</span></div>}
          {b.tax > 0 && <div className="flex justify-between"><span className="text-neutral-700">Tax</span><span className="tabular">{pkr(b.tax)}</span></div>}
          <div className="flex items-end justify-between border-t border-[color:var(--border)] pt-3">
            <span className="text-[16px] font-semibold text-ink">Total</span>
            <span className="text-right">
              <span className="block font-display text-[22px] font-bold text-ink tabular">{pkr(b.total)}</span>
              <Approx pkr={b.total} className="text-[13px] text-neutral-500" />
            </span>
          </div>
          <p className="text-right text-[13px] text-neutral-500">{b.paymentMode === 'advance' ? `Advance ${pkr(b.advanceAmount)} to the hotel, the rest at check-in` : 'Paid at the hotel, in rupees'}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => downloadIcs(b, h)} className="btn-ghost btn-sm"><CalendarDays className="h-4 w-4" /> Add to calendar</button>
          <button
            type="button"
            onClick={async () => {
              const text = `My booking at ${h.name || b.hotelName}, ${dates}. Ref ${b.ref}`;
              if (navigator.share) await navigator.share({ title: 'My hotel booking', text, url: manageUrl }).catch(() => undefined);
              else { await navigator.clipboard.writeText(`${text}\n${manageUrl}`); toast.success('Copied'); }
            }}
            className="btn-ghost btn-sm"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </section>

      {b.paymentMode === 'advance' && ['pending', 'confirmed'].includes(b.status) && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-neutral-900">Send your advance: {pkr(b.advanceAmount)}</h2>
          {b.advanceStatus === 'received' ? (
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink"><CheckCircle2 className="h-4 w-4" /> The hotel has received your advance.</p>
          ) : b.advanceStatus === 'submitted' ? (
            <p className="mt-2 text-sm text-neutral-600">Thanks — your payment proof is with the hotel. They will mark it received after checking their account.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-neutral-600">Send it straight to the hotel&apos;s account below, then upload the screenshot. PakHotels never holds your money.</p>
              {b.advanceStatus === 'rejected' && <p className="mt-2 rounded-lg bg-accent p-2 text-sm text-ink">The hotel could not find your last payment. Please check and upload again, or call the hotel.</p>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(h.paymentAccounts ?? []).map((a: any, i: number) => (
                  <div key={i} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <p className="font-semibold capitalize text-neutral-900">{a.title || a.kind}</p>
                    <p className="text-neutral-600">{a.accountName}</p>
                    <button type="button" onClick={() => { void navigator.clipboard.writeText(a.accountNumber); toast.success('Copied'); }} className="mt-1 flex items-center gap-1.5 font-mono font-semibold text-neutral-900">
                      {a.accountNumber} <Copy className="h-3.5 w-3.5 text-neutral-400" />
                    </button>
                    {a.iban && <p className="font-mono text-xs text-neutral-500">{a.iban}</p>}
                  </div>
                ))}
                {!(h.paymentAccounts ?? []).length && <p className="text-sm text-neutral-500">Ask the hotel on WhatsApp for its account details.</p>}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-600 hover:border-ink sm:col-span-2">
                  {proof.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proof.url} alt="Payment proof" className="h-20 rounded object-contain" />
                  ) : (
                    <><Upload className="h-5 w-5" /> Upload payment screenshot</>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      try {
                        const r = await bookingsApi.upload(b.ref, t, file);
                        setProof((p) => ({ ...p, url: r.url }));
                      } catch (er) {
                        toast.error(apiError(er));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <Input placeholder="Sent from (e.g. JazzCash 0300…)" value={proof.method} onChange={(e) => setProof({ ...proof, method: e.target.value })} />
                <Input placeholder="Transaction ID (optional)" value={proof.note} onChange={(e) => setProof({ ...proof, note: e.target.value })} />
              </div>
              <Button
                className="mt-3"
                disabled={!proof.url || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await bookingsApi.advance(b.ref, { t, proofUrl: proof.url, method: proof.method, note: proof.note });
                    toast.success('Sent to the hotel');
                    await load();
                  } catch (er) {
                    toast.error(apiError(er));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} I have sent the advance
              </Button>
            </>
          )}
        </section>
      )}

      {['pending', 'confirmed'].includes(b.status) && (
        <section className="rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--border)]">
          <p className="eyebrow">At check-in</p>
          <ul className="mt-3 space-y-2.5 text-[15px] text-neutral-700">
            <li className="flex gap-2.5"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> Arrive from {fmtTime(h.checkInTime)} (Pakistan time). Running late? Tell the hotel on WhatsApp.</li>
            {(h.idRequired || foreign) && <li className="flex gap-2.5"><IdCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> {idRule(foreign)}.{foreign ? ' The hotel registers foreign guests with the police.' : ''}</li>}
            {couple?.label && <li className="flex gap-2.5"><Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> {couple.label}.</li>}
          </ul>
          {b.canCancel ? (
            <div className="mt-4 border-t border-[color:var(--border)] pt-4">
              <p className="text-[13.5px] text-neutral-500">{b.cancelNote}</p>
              <button type="button" onClick={() => setCancelOpen(true)} className="btn-ghost btn-sm mt-2">Cancel request</button>
            </div>
          ) : b.status === 'confirmed' ? (
            <p className="mt-4 border-t border-[color:var(--border)] pt-4 text-[13.5px] text-neutral-500">{b.cancelNote || 'Confirmed by the hotel — to change your plans, call or WhatsApp the hotel.'}</p>
          ) : null}
        </section>
      )}

      {b.canReview && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-neutral-900">How was your stay?</h2>
          <p className="text-sm text-neutral-500">Your review helps other travellers — it is published as a verified stay.</p>
          <div className="mt-3"><Stars value={review.rating} onChange={(n) => setReview({ ...review, rating: n })} /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {(['cleanliness', 'staff', 'location', 'value'] as const).map((k) => (
              <div key={k}>
                <p className="capitalize text-neutral-600">{k === 'value' ? 'Value for money' : k}</p>
                <Stars size="h-5 w-5" value={review[k]} onChange={(n) => setReview({ ...review, [k]: n })} />
              </div>
            ))}
          </div>
          <Input className="mt-3" placeholder="Title (optional)" value={review.title} onChange={(e) => setReview({ ...review, title: e.target.value })} />
          <Textarea className="mt-2" rows={4} placeholder="What did you like? What could be better?" value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} />
          <Button
            className="mt-3"
            disabled={!review.rating || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await bookingsApi.review(b.ref, { t, ...review });
                toast.success('Thank you for your review!');
                await load();
              } catch (er) {
                toast.error(apiError(er));
              } finally {
                setBusy(false);
              }
            }}
          >
            Post review
          </Button>
        </section>
      )}

      <section className="border-t border-neutral-200 pt-4 text-[15px] text-neutral-600">
        <p className="font-semibold text-ink">Saved in your account</p>
        <p className="mt-0.5">Open it any time from <Link href="/trips" className="font-semibold text-ink underline">My trips</Link>, on any phone you sign in on.</p>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(manageUrl); toast.success('Link copied'); }} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-ink">
          <Copy className="h-4 w-4" /> Copy link to this booking
        </button>
      </section>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>{b.cancelNote}</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (optional) — helps the hotel" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep booking</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await bookingsApi.cancel(b.ref, t, reason);
                  setCancelOpen(false);
                  toast.success('Booking cancelled');
                  await load();
                } catch (er) {
                  toast.error(apiError(er));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
