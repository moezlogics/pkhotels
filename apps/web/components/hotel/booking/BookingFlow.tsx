'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BedDouble, Check, ChevronDown, Coffee, Eye, EyeOff, Loader2, Minus, Plus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from '@/components/hotel/DatePicker';
import PhoneField from '@/components/hotel/PhoneField';
import { Approx } from '@/components/Currency';
import { COUNTRIES, isPkMobile, normalizePhone } from '@/lib/countries';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { GoogleButton } from '@/components/auth/google-button';
import { useAuth } from '@/context/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { photo } from '@/lib/img';
import {
  COUPLE_POLICIES, fmtDay, fmtTime, hotelPath, type HotelDetail, idRule, nightsBetween, pkr, type RoomQuote,
  stayParams, type StayQuery,
} from '@/lib/hotels';
import { apiError, bookingsApi, hotelsApi, rememberBooking } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';

/* ───────────────────────── shared state ───────────────────────── */

type Step = 'dates' | 'room' | 'account' | 'review';

interface Ctx {
  hotel: HotelDetail;
  stay: StayQuery;
  setStay: (s: StayQuery) => void;
  quotes: RoomQuote[] | null;
  loadingQuotes: boolean;
  open: (o?: { roomId?: string }) => void;
}

const BookingCtx = createContext<Ctx | null>(null);
export const useBooking = () => {
  const c = useContext(BookingCtx);
  if (!c) throw new Error('useBooking outside BookingProvider');
  return c;
};

const nightsLabel = (n: number) => `${n} night${n === 1 ? '' : 's'}`;
const sleeps = (r: { maxAdults: number; maxChildren: number }) => r.maxAdults + r.maxChildren;
const short = (d: string) => fmtDay(d, { day: 'numeric', month: 'short' });

/**
 * Owns the stay (dates + guests), live prices and the booking sheet for one
 * hotel page. The sticky bar, the side card and each room's "Select" open it.
 */
export function BookingProvider({ hotel, initial, children }: { hotel: HotelDetail; initial: StayQuery; children: ReactNode }) {
  const [stay, setStayState] = useState<StayQuery>({ adults: 2, children: 0, rooms: 1, ...initial });
  const [quotes, setQuotes] = useState<RoomQuote[] | null>(null);
  const [loadingQuotes, setLoading] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; step: Step; roomId?: string }>({ open: false, step: 'dates' });
  const req = useRef(0);
  // Read before the effect below rewrites the address.
  const firstSearch = useRef(typeof window !== 'undefined' ? window.location.search : '');

  const setStay = useCallback((s: StayQuery) => setStayState(s), []);

  useEffect(() => {
    window.history.replaceState(null, '', hotelPath(hotel.slug, hotel.citySlug) + stayParams(stay) + window.location.hash);
    if (!stay.checkIn || !stay.checkOut) {
      setQuotes(null);
      return;
    }
    const id = ++req.current;
    setLoading(true);
    hotelsApi
      .quote(hotel.slug, stay.checkIn, stay.checkOut)
      .then((q) => id === req.current && setQuotes(q.rooms))
      .catch(() => id === req.current && setQuotes(null))
      .finally(() => id === req.current && setLoading(false));
  }, [hotel.slug, stay]);

  // Links from elsewhere (?book=1&room=<id>), and the return from Google sign-in, open the sheet.
  useEffect(() => {
    const q = new URLSearchParams(firstSearch.current);
    if (q.get('book') === '1' && hotel.booking.open) {
      setSheet({ open: true, step: initial.checkIn ? 'room' : 'dates', roomId: q.get('room') || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(
    (o?: { roomId?: string }) => {
      if (!hotel.booking.open) {
        toast.error(hotel.booking.reason || 'This hotel is not taking online bookings right now.');
        return;
      }
      setSheet({ open: true, step: stay.checkIn ? 'room' : 'dates', roomId: o?.roomId });
    },
    [hotel.booking, stay.checkIn],
  );

  return (
    <BookingCtx.Provider value={{ hotel, stay, setStay, quotes, loadingQuotes, open }}>
      {children}
      <BookingSheet state={sheet} setState={setSheet} />
    </BookingCtx.Provider>
  );
}

/* ───────────────────────── the sheet ───────────────────────── */

function BookingSheet({ state, setState }: { state: { open: boolean; step: Step; roomId?: string }; setState: (s: { open: boolean; step: Step; roomId?: string }) => void }) {
  const mobile = useIsMobile();
  const { hotel } = useBooking();
  const close = () => setState({ ...state, open: false });
  const body = <FlowBody key={state.open ? 'open' : 'closed'} startStep={state.step} preselect={state.roomId} onClose={close} />;

  if (mobile) {
    return (
      <Drawer open={state.open} onOpenChange={(v) => (v ? null : close())} repositionInputs={false}>
        <DrawerContent className="max-h-[94dvh] rounded-t-[28px] p-0">
          <DrawerTitle className="sr-only">Book {hotel.name}</DrawerTitle>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={state.open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent showCloseButton={false} className="flex h-[min(780px,92vh)] max-w-[500px] flex-col gap-0 overflow-hidden rounded-[28px] p-0">
        <DialogTitle className="sr-only">Book {hotel.name}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 text-ink transition active:scale-95 disabled:opacity-25">
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-[17px] font-semibold tabular">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300 text-ink transition active:scale-95 disabled:opacity-25">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[14px] font-medium text-neutral-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[13px] text-red-700">{error}</span>}
    </label>
  );
}
const input = 'h-[50px] w-full rounded-2xl border border-neutral-300 bg-white px-3.5 text-[17px] text-ink outline-none transition placeholder:text-neutral-400 focus:border-ink focus:ring-1 focus:ring-ink';

function FlowBody({ startStep, preselect, onClose }: { startStep: Step; preselect?: string; onClose: () => void }) {
  const router = useRouter();
  const mobile = useIsMobile();
  const { user, isAuthenticated, login, registerAndSignIn } = useAuth();
  const { hotel, stay, setStay, quotes, loadingQuotes } = useBooking();
  const [step, setStep] = useState<Step>(startStep);
  const [roomId, setRoomId] = useState<string | undefined>(preselect);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // account
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [acct, setAcct] = useState({ name: '', phone: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [acctErr, setAcctErr] = useState('');

  // review
  const [guest, setGuest] = useState({ guestName: '', guestPhone: '', guestEmail: '' });
  // Who is checking in: a Pakistani (CNIC/NICOP) or a foreign passport holder.
  const [foreign, setForeign] = useState(false);
  const [country, setCountry] = useState('');
  // Booking for someone else (parents, a colleague): the account holder is the booker.
  const [forOther, setForOther] = useState(false);
  const [more, setMore] = useState(false);
  const [notes, setNotes] = useState({ specialRequests: '', arrivalTime: '' });
  const [payAdvance, setPayAdvance] = useState(hotel.advanceMode === 'required');
  const [phoneTouched, setPhoneTouched] = useState(false);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const guests = (stay.adults ?? 2) + (stay.children ?? 0);
  const steps: Step[] = isAuthenticated && step !== 'account' ? ['dates', 'room', 'review'] : ['dates', 'room', 'account', 'review'];
  const at = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step]);

  // The account fills in who is checking in.
  useEffect(() => {
    if (!user) return;
    setGuest((g) => ({
      guestName: g.guestName || user.name || '',
      guestPhone: g.guestPhone || user.phone || acct.phone || '',
      guestEmail: g.guestEmail || user.email || acct.email || '',
    }));
  }, [user, acct.phone]);

  const options = useMemo(() => {
    const byId = new Map((quotes ?? []).map((q) => [q.roomId, q]));
    return hotel.rooms
      .map((r) => ({ room: r, q: byId.get(r._id) }))
      .filter((x) => x.q)
      .sort((a, b) => Number((a.q!.available || 0) === 0) - Number((b.q!.available || 0) === 0) || a.q!.total - b.q!.total);
  }, [quotes, hotel.rooms]);

  // Pick a sensible room: the one asked for, else the cheapest that fits everyone.
  useEffect(() => {
    if (!options.length) return;
    const ok = (x: (typeof options)[number]) => x.q!.available > 0 && !x.q!.closed && x.q!.minNightsOk;
    const current = options.find((x) => x.room._id === roomId && ok(x));
    const pick = current ?? options.find((x) => ok(x) && sleeps(x.room) * Math.min(x.q!.available, Math.max(1, stay.rooms ?? 1)) >= guests) ?? options.find(ok);
    if (!pick) return;
    if (pick.room._id !== roomId) setRoomId(pick.room._id);
    const need = Math.max(stay.rooms ?? 1, Math.ceil(guests / Math.max(1, sleeps(pick.room))));
    setQty(Math.min(pick.q!.available, Math.max(1, need)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const chosen = options.find((x) => x.room._id === roomId);
  const roomsTotal = (chosen?.q?.total ?? 0) * qty;
  const tax = !hotel.taxIncluded && hotel.taxPercent > 0 ? Math.round((roomsTotal * hotel.taxPercent) / 100) : 0;
  const total = roomsTotal + tax;
  const advance = payAdvance ? Math.round((total * (hotel.advancePercent || 25)) / 100) : 0;
  const capacity = chosen ? sleeps(chosen.room) * qty : 0;
  const guestPhone = normalizePhone(guest.guestPhone);
  const phoneOk = !!guestPhone;
  const abroadNumber = phoneOk && !isPkMobile(guestPhone);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.guestEmail.trim());
  const foreignBlocked = foreign && hotel.acceptsForeigners === 'no';
  const couple = COUPLE_POLICIES[hotel.couplePolicy || 'not_stated'];

  const afterRoom = () => setStep(isAuthenticated ? 'review' : 'account');

  const submitAccount = async () => {
    setAcctErr('');
    const email = acct.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setAcctErr('Enter a valid email address.');
    if (acct.password.length < 6) return setAcctErr('Password needs at least 6 characters.');
    if (mode === 'signup') {
      if (acct.name.trim().length < 3) return setAcctErr('Enter your full name.');
      if (!normalizePhone(acct.phone)) return setAcctErr('Enter your mobile number — 0300 1234567 in Pakistan, or pick your country code.');
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await registerAndSignIn({ name: acct.name.trim(), email, password: acct.password, phone: normalizePhone(acct.phone) });
        setGuest({ guestName: acct.name.trim(), guestPhone: normalizePhone(acct.phone), guestEmail: email });
      } else {
        await login({ email, password: acct.password });
      }
      setStep('review');
    } catch (e: any) {
      const msg = apiError(e, mode === 'signup' ? 'Could not create your account.' : 'Email or password is wrong.');
      if (e?.response?.status === 409) {
        setMode('signin');
        setAcctErr('You already have an account with this email. Enter your password to sign in.');
      } else setAcctErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setPhoneTouched(true);
    if (guest.guestName.trim().length < 3) return toast.error('Enter the name of the person checking in.');
    if (!phoneOk) return toast.error('Check the mobile number — 0300 1234567, or pick your country code.');
    if (abroadNumber && !emailOk) return toast.error('Add an email address — with a number from abroad we reach you by email and WhatsApp.');
    if (foreign && !country) return toast.error('Choose the country of the passport.');
    if (foreignBlocked) return toast.error('This hotel cannot host foreign passport holders. Please choose another hotel.');
    if (!chosen || !stay.checkIn || !stay.checkOut) return setStep('room');
    setBusy(true);
    try {
      const res = await bookingsApi.create({
        hotelId: hotel._id,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults ?? 2,
        children: stay.children ?? 0,
        rooms: [{ roomId: chosen.room._id, qty }],
        paymentMode: payAdvance ? 'advance' : 'pay_at_hotel',
        guestName: guest.guestName,
        guestPhone,
        guestEmail: guest.guestEmail.trim(),
        guestForeign: foreign,
        guestCountry: foreign ? country : 'PK',
        ...(forOther && user ? { bookerName: user.name, bookerPhone: user.phone || acct.phone } : {}),
        ...notes,
      });
      rememberBooking(res.ref, res.token);
      router.push(`/booking/${res.ref}?t=${res.token}&new=1`);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setStep('account');
        toast.error('Please sign in again to finish your booking.');
      } else toast.error(apiError(e, 'Could not complete the booking. Please try again.'));
      setBusy(false);
    }
  };

  const titles: Record<Step, string> = { dates: 'Dates and guests', room: 'Choose a room', account: 'Your account', review: 'Review and book' };
  const googleNext = typeof window !== 'undefined' ? `${hotelPath(hotel.slug, hotel.citySlug)}${stayParams(stay) || '?'}${stayParams(stay) ? '&' : ''}book=1${roomId ? `&room=${roomId}` : ''}` : undefined;

  const cta = 'h-[52px] rounded-full bg-primary px-6 text-[17px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:bg-neutral-300';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center gap-1 px-2 pb-2 pt-1 md:pt-3">
        <button type="button" aria-label="Back" onClick={() => at > 0 && setStep(steps[at - 1]!)} className={cn('grid h-11 w-11 place-items-center rounded-full hover:bg-neutral-100', at === 0 && 'invisible')}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="font-display flex-1 text-center text-[19px] font-bold tracking-tight text-ink">{titles[step]}</p>
        <button type="button" aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex gap-1 px-4 pb-3" aria-label={`Step ${at + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < at ? 'bg-ink' : i === at ? 'bg-primary' : 'bg-neutral-200')} />
        ))}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-neutral-100 px-4 py-4">
        {step === 'dates' && (
          <div className="space-y-4">
            <DatePicker checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(checkIn, checkOut) => setStay({ ...stay, checkIn, checkOut })} />
            <div className="divide-y divide-neutral-100 border-t border-neutral-100">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[17px] font-medium text-ink">Adults</p>
                  <p className="text-[14px] text-neutral-500">13 and above</p>
                </div>
                <Stepper label="adults" value={stay.adults ?? 2} min={1} max={30} onChange={(n) => setStay({ ...stay, adults: n })} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[17px] font-medium text-ink">Children</p>
                  <p className="text-[14px] text-neutral-500">{hotel.childrenAllowed ? 'Up to 12' : 'Not accepted here'}</p>
                </div>
                <Stepper label="children" value={stay.children ?? 0} min={0} max={hotel.childrenAllowed ? 20 : 0} onChange={(n) => setStay({ ...stay, children: n })} />
              </div>
            </div>
          </div>
        )}

        {step === 'room' && (
          <div className="space-y-3">
            <button type="button" onClick={() => setStep('dates')} className="flex w-full items-center justify-between rounded-full bg-surface px-4 py-2.5 text-left">
              <span className="text-[15px] text-ink">
                <b className="font-semibold">{short(stay.checkIn!)} – {short(stay.checkOut!)}</b>, {nightsLabel(nights)}, {guests} guest{guests === 1 ? '' : 's'}
              </span>
              <span className="text-[14px] font-semibold underline">Edit</span>
            </button>
            {loadingQuotes && !quotes && [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />)}
            {quotes && options.length === 0 && <p className="rounded-xl bg-surface p-4 text-[15px] text-ink">No rooms are open for online booking yet. Call the hotel.</p>}
            {options.map(({ room, q }) => {
              const free = q!.closed || !q!.minNightsOk ? 0 : q!.available;
              const on = room._id === roomId && free > 0;
              return (
                <div key={room._id} className={cn('rounded-[22px] border transition', on ? 'border-primary bg-accent ring-1 ring-primary' : 'border-neutral-200', free === 0 && 'opacity-50')}>
                  <button
                    type="button"
                    disabled={free === 0}
                    onClick={() => {
                      setRoomId(room._id);
                      setQty(Math.min(free, Math.max(stay.rooms ?? 1, Math.ceil(guests / Math.max(1, sleeps(room))))));
                    }}
                    className="flex w-full gap-3 p-3 text-left"
                  >
                    <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[16px] bg-neutral-100">
                      {(room.images[0] || hotel.coverImage) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo(room.images[0] || hotel.coverImage, 256)} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold leading-snug text-ink">{room.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[14px] text-neutral-500">
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {sleeps(room)}</span>
                        {room.bedType && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {room.bedType}</span>}
                        {room.breakfastIncluded && <span className="inline-flex items-center gap-1"><Coffee className="h-3.5 w-3.5" /> Breakfast</span>}
                      </p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <span className={cn('text-[14px]', free > 0 && free <= 3 ? 'font-semibold text-ink' : 'text-neutral-500')}>
                          {free === 0 ? (q!.minNightsOk ? 'Sold out' : `Min. ${room.minNights} nights`) : free <= 3 ? `${free} left` : 'Pay at hotel'}
                        </span>
                        <span className="text-right">
                          {q!.totalBefore > q!.total && <span className="mr-1.5 text-[14px] text-neutral-400 line-through tabular">{pkr(q!.totalBefore)}</span>}
                          <span className="text-[18px] font-semibold text-ink tabular">{pkr(q!.total)}</span>
                        </span>
                      </div>
                    </div>
                  </button>
                  {on && (
                    <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
                      <p className="text-[15px] text-ink">{capacity < guests ? <span className="text-ink">Sleeps {capacity}. Add a room.</span> : `Rooms, sleeps ${capacity}`}</p>
                      <Stepper label="rooms" value={qty} min={1} max={Math.min(free, 10)} onChange={setQty} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 'account' && (
          <div className="space-y-4">
            <div>
              <p className="font-display text-[24px] font-bold leading-tight tracking-tight text-ink">{mode === 'signup' ? 'Create your account to book' : 'Welcome back'}</p>
              <p className="mt-1 text-[15px] text-neutral-500">Your booking, updates from the hotel and your receipts stay in one place. It takes a few seconds.</p>
            </div>
            <div className="grid grid-cols-2 rounded-full bg-surface p-1">
              {(['signup', 'signin'] as const).map((m) => (
                <button key={m} type="button" onClick={() => { setMode(m); setAcctErr(''); }} className={cn('h-10 rounded-full text-[15px] font-semibold transition', mode === m ? 'bg-ink text-white' : 'text-neutral-500')}>
                  {m === 'signup' ? 'New here' : 'I have an account'}
                </button>
              ))}
            </div>
            <GoogleButton next={googleNext} label="Continue with Google" />
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAccount();
              }}
            >
              {mode === 'signup' && (
                <>
                  <Field label="Full name">
                    <input className={input} value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} autoComplete="name" placeholder="As on your CNIC or passport" />
                  </Field>
                  <Field label="Mobile number (WhatsApp)">
                    <PhoneField value={acct.phone} onChange={(v) => setAcct({ ...acct, phone: v })} />
                  </Field>
                </>
              )}
              <Field label="Email">
                <input className={input} type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} autoComplete="email" placeholder="you@example.com" />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input className={cn(input, 'pr-12')} type={showPw ? 'text' : 'password'} value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 6 characters' : ''} />
                  <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw(!showPw)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-neutral-500">
                    {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </Field>
              {acctErr && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-700">{acctErr}</p>}
              <button type="submit" disabled={busy} className={cn(cta, 'flex w-full items-center justify-center gap-2')}>
                {busy && <Loader2 className="h-5 w-5 animate-spin" />}
                {mode === 'signup' ? 'Create account and continue' : 'Sign in and continue'}
              </button>
              <p className="text-center text-[13px] text-neutral-500">
                By continuing you agree to our <a href="/terms" target="_blank" className="underline">terms</a> and <a href="/privacy-policy" target="_blank" className="underline">privacy policy</a>.
              </p>
            </form>
          </div>
        )}

        {step === 'review' && chosen && (
          <div className="space-y-4">
            <div className="flex gap-3">
              {hotel.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo(hotel.coverImage, 256)} alt="" className="h-[68px] w-[68px] shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-[17px] font-semibold leading-snug text-ink">{hotel.name}</p>
                <p className="text-[14px] text-neutral-500">{hotel.cityName}</p>
              </div>
            </div>
            <dl className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 text-[15px]">
              <div className="flex justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-neutral-500">Dates</dt>
                <dd className="text-right font-medium text-ink">{short(stay.checkIn!)} – {short(stay.checkOut!)}, {nightsLabel(nights)}</dd>
              </div>
              <div className="flex justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-neutral-500">Guests</dt>
                <dd className="font-medium text-ink">{guests}</dd>
              </div>
              <div className="flex justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-neutral-500">Room</dt>
                <dd className="text-right font-medium text-ink">{qty} × {chosen.room.name}</dd>
              </div>
              {tax > 0 && (
                <div className="flex justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-neutral-500">Tax ({hotel.taxPercent}%)</dt>
                  <dd className="font-medium text-ink tabular">{pkr(tax)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 px-3.5 py-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-right">
                  <span className="block text-[19px] font-semibold text-ink tabular">{pkr(total)}</span>
                  <Approx pkr={total} className="text-[13px] font-normal text-neutral-500" />
                </dd>
              </div>
            </dl>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[17px] font-semibold text-ink">Who is checking in?</p>
                {user && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !forOther;
                      setForOther(next);
                      setGuest(next ? { guestName: '', guestPhone: '', guestEmail: '' } : { guestName: user.name || '', guestPhone: user.phone || '', guestEmail: user.email || '' });
                      setPhoneTouched(false);
                    }}
                    className="text-[14px] font-semibold text-primary"
                  >
                    {forOther ? 'I am checking in' : 'Booking for someone else?'}
                  </button>
                )}
              </div>
              {forOther && <p className="rounded-xl bg-accent px-3.5 py-2.5 text-[14px] text-ink">Enter the guest&apos;s details. The booking stays in your account and you both get the updates.</p>}

              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Guest's ID">
                {[
                  { v: false, t: 'Pakistani', d: 'CNIC or NICOP' },
                  { v: true, t: 'Foreign national', d: 'Passport + visa' },
                ].map((o) => (
                  <button
                    key={o.t}
                    type="button"
                    role="radio"
                    aria-checked={foreign === o.v}
                    onClick={() => setForeign(o.v)}
                    className={cn('rounded-xl border p-3 text-left', foreign === o.v ? 'border-primary bg-accent ring-1 ring-primary' : 'border-neutral-200')}
                  >
                    <span className="block text-[15.5px] font-semibold text-ink">{o.t}</span>
                    <span className="block text-[13px] text-neutral-500">{o.d}</span>
                  </button>
                ))}
              </div>
              {foreign && (
                <>
                  <Field label="Passport country">
                    <select className={input} value={country} onChange={(e) => setCountry(e.target.value)}>
                      <option value="">Choose a country</option>
                      {COUNTRIES.filter((c) => c.iso !== 'PK').map((c) => (
                        <option key={c.iso} value={c.iso}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                  {hotel.acceptsForeigners === 'no' ? (
                    <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-700">This hotel is not registered to host foreign passport holders, so it cannot accept this booking. Please pick a hotel marked “Welcomes foreign guests”.</p>
                  ) : hotel.acceptsForeigners === 'yes' ? (
                    <p className="rounded-xl bg-accent px-3.5 py-2.5 text-[14px] text-ink">This hotel welcomes foreign guests. Bring your passport with a valid Pakistan visa{hotel.foreignerRegistration ? ' — the hotel files your police registration' : ''}.</p>
                  ) : (
                    <p className="rounded-xl bg-highlight/50 px-3.5 py-2.5 text-[14px] text-ink">This hotel has not said whether it hosts foreign guests. Send the request — the hotel confirms before anything is final — or WhatsApp them first.</p>
                  )}
                </>
              )}

              <Field label="Full name">
                <input className={input} value={guest.guestName} onChange={(e) => setGuest({ ...guest, guestName: e.target.value })} autoComplete={forOther ? 'off' : 'name'} placeholder={foreign ? 'As in the passport' : 'As on the CNIC'} />
              </Field>
              <Field label="Mobile number (WhatsApp)" error={phoneTouched && !phoneOk ? 'Enter a valid number — 0300 1234567, or pick the country code' : undefined}>
                <PhoneField value={guest.guestPhone} invalid={phoneTouched && !phoneOk} onBlur={() => setPhoneTouched(true)} onChange={(v) => setGuest({ ...guest, guestPhone: v })} />
              </Field>
              {(abroadNumber || foreign || forOther) && (
                <Field label={abroadNumber ? 'Email (required for numbers outside Pakistan)' : 'Email (optional)'} error={abroadNumber && phoneTouched && !emailOk ? 'Enter an email address' : undefined}>
                  <input className={input} type="email" value={guest.guestEmail} onChange={(e) => setGuest({ ...guest, guestEmail: e.target.value })} autoComplete="email" placeholder="you@example.com" />
                </Field>
              )}
            </div>

            {hotel.advanceMode !== 'none' && (
              <div className="space-y-2">
                <p className="text-[17px] font-semibold text-ink">Payment</p>
                {hotel.advanceMode === 'optional' && (
                  <button type="button" onClick={() => setPayAdvance(false)} className={cn('flex w-full items-center justify-between rounded-xl border p-3 text-left', !payAdvance ? 'border-ink bg-accent/40 ring-1 ring-ink' : 'border-neutral-200')}>
                    <span className="text-[16px] text-ink">Pay at the hotel</span>
                    <span className={cn('h-5 w-5 rounded-full border-2', !payAdvance ? 'border-[6px] border-ink' : 'border-neutral-300')} />
                  </button>
                )}
                <button type="button" onClick={() => setPayAdvance(true)} className={cn('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left', payAdvance ? 'border-ink bg-accent/40 ring-1 ring-ink' : 'border-neutral-200')}>
                  <span>
                    <span className="block text-[16px] text-ink">{hotel.advancePercent}% advance to the hotel{hotel.advanceMode === 'required' ? ', required' : ''}</span>
                    <span className="block text-[14px] text-neutral-500">{pkr(Math.round((total * hotel.advancePercent) / 100))} by JazzCash, Easypaisa or bank. Account details after booking.</span>
                  </span>
                  <span className={cn('h-5 w-5 shrink-0 rounded-full border-2', payAdvance ? 'border-[6px] border-ink' : 'border-neutral-300')} />
                </button>
              </div>
            )}

            <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between py-1 text-[16px] font-medium text-ink">
              Arrival time or a request
              <ChevronDown className={cn('h-5 w-5 transition', more && 'rotate-180')} />
            </button>
            {more && (
              <div className="space-y-3">
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {['Morning', 'Afternoon', 'Evening', 'Late night'].map((t) => (
                    <button key={t} type="button" onClick={() => setNotes({ ...notes, arrivalTime: notes.arrivalTime === t ? '' : t })} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-[15px]', notes.arrivalTime === t ? 'border-ink bg-primary text-primary-foreground' : 'border-neutral-300')}>
                      {t}
                    </button>
                  ))}
                </div>
                <textarea rows={3} value={notes.specialRequests} onChange={(e) => setNotes({ ...notes, specialRequests: e.target.value })} placeholder="Early check-in, extra mattress, ground floor…" className="w-full rounded-xl border border-neutral-300 p-3 text-[16px] outline-none focus:border-ink" />
              </div>
            )}

            <ul className="space-y-1.5 border-t border-neutral-100 pt-3 text-[14px] text-neutral-600">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" /> You can cancel until the hotel confirms. After that, changes go through the hotel.</li>
              {hotel.idRequired && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" /> {idRule(foreign)}, check-in from {fmtTime(hotel.checkInTime)} (Pakistan time)</li>}
              {couple?.label && <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" /> {couple.label}</li>}
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" /> {hotel.instantConfirm ? 'Confirmed straight away' : `The hotel replies within ${hotel.responseHours} hours`}{payAdvance && advance ? `, advance ${pkr(advance)}` : ', pay at the hotel'}</li>
            </ul>
          </div>
        )}
      </div>

      {/* footer */}
      {step !== 'account' && (
        <div className={cn('flex items-center gap-3 border-t border-neutral-100 bg-white px-4 pt-3', mobile ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : 'pb-4')}>
          {step === 'dates' && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold text-ink">{nights ? `${short(stay.checkIn!)} – ${short(stay.checkOut!)}` : 'Add your dates'}</p>
                <p className="text-[14px] text-neutral-500">{nights ? `${nightsLabel(nights)}, ${guests} guest${guests === 1 ? '' : 's'}` : 'Check-in, then check-out'}</p>
              </div>
              <button type="button" disabled={!nights} onClick={() => setStep('room')} className={cta}>Next</button>
            </>
          )}
          {step === 'room' && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[19px] font-semibold text-ink tabular">{chosen ? pkr(total) : '—'}</p>
                <p className="text-[14px] text-neutral-500">{chosen ? `${qty} room${qty === 1 ? '' : 's'}, ${nightsLabel(nights)}` : 'Select a room'}</p>
              </div>
              <button type="button" disabled={!chosen || loadingQuotes} onClick={afterRoom} className={cta}>Next</button>
            </>
          )}
          {step === 'review' && (
            <button type="button" onClick={submit} disabled={busy} className={cn(cta, 'flex w-full items-center justify-center gap-2')}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {hotel.instantConfirm ? 'Confirm booking' : 'Request to book'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── page pieces ───────────────────────── */

function useCheapest() {
  const { quotes } = useBooking();
  return useMemo(() => {
    const ok = (quotes ?? []).filter((q) => q.available > 0 && !q.closed && q.minNightsOk);
    return ok.length ? Math.min(...ok.map((q) => q.total)) : null;
  }, [quotes]);
}

/** Phones: always at the bottom of a hotel page. */
export function StickyBookBar() {
  const { hotel, stay, open } = useBooking();
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const cheapest = useCheapest();
  const from = Math.round(hotel.minPrice * (1 - (hotel.deal?.percent ?? 0) / 100));

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-40 rounded-[26px] bg-ink text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)] lg:hidden">
      <div className="flex items-center gap-3 py-2 pl-5 pr-2">
        <button type="button" onClick={() => open()} className="min-w-0 flex-1 text-left">
          {nights && cheapest ? (
            <>
              <p className="font-display text-[20px] font-bold leading-tight text-white tabular">{pkr(cheapest)}</p>
              <p className="text-[13.5px] text-white/65"><span className="underline">{short(stay.checkIn!)} – {short(stay.checkOut!)}</span> <Approx pkr={cheapest} /></p>
            </>
          ) : from > 0 ? (
            <>
              <p className="font-display text-[20px] font-bold leading-tight text-white tabular">{pkr(from)} <span className="font-sans text-[14px] font-normal text-white/60">/ night</span></p>
              <p className="text-[13.5px] text-white/65"><Approx pkr={from} prefix="≈ " className="mr-1" />Pay at the hotel</p>
            </>
          ) : (
            <p className="text-[16px] font-medium text-white">Pay at the hotel</p>
          )}
        </button>
        <button type="button" onClick={() => open()} disabled={!hotel.booking.open} className="h-[52px] shrink-0 rounded-full bg-primary px-7 text-[17px] font-semibold text-white transition active:scale-[0.97] disabled:bg-white/20 disabled:text-white/60">
          {hotel.booking.open ? (nights ? 'Reserve' : 'Check dates') : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}

/** Desktop: the card that follows the page down the right-hand side. */
export function SideBookCard() {
  const { hotel, stay, setStay, open } = useBooking();
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const cheapest = useCheapest();
  const guests = (stay.adults ?? 2) + (stay.children ?? 0);

  return (
    <div className="rounded-[28px] border border-[color:var(--border)] bg-white p-6 shadow-[0_24px_50px_-30px_rgba(14,14,16,0.45)]">
      {nights && cheapest ? (
        <p className="text-[15px] text-neutral-500"><span className="font-display text-[30px] font-bold text-ink tabular">{pkr(cheapest)}</span> for {nightsLabel(nights)} <Approx pkr={cheapest} className="text-[14px]" /></p>
      ) : hotel.minPrice > 0 ? (
        <p className="text-[15px] text-neutral-500"><span className="font-display text-[30px] font-bold text-ink tabular">{pkr(Math.round(hotel.minPrice * (1 - (hotel.deal?.percent ?? 0) / 100)))}</span> night <Approx pkr={Math.round(hotel.minPrice * (1 - (hotel.deal?.percent ?? 0) / 100))} className="text-[14px]" /></p>
      ) : null}
      <div className="mt-4 overflow-hidden rounded-[20px] border border-neutral-300">
        <button type="button" onClick={() => open()} className="grid w-full grid-cols-2 text-left">
          <span className="border-r border-neutral-300 px-3 py-2.5">
            <span className="block text-[13px] font-semibold text-ink">Check-in</span>
            <span className="block text-[15px] text-neutral-600">{stay.checkIn ? fmtDay(stay.checkIn) : 'Add date'}</span>
          </span>
          <span className="px-3 py-2.5">
            <span className="block text-[13px] font-semibold text-ink">Check-out</span>
            <span className="block text-[15px] text-neutral-600">{stay.checkOut ? fmtDay(stay.checkOut) : 'Add date'}</span>
          </span>
        </button>
        <div className="flex items-center justify-between border-t border-neutral-300 px-3 py-2">
          <span className="text-[15px] text-ink">{guests} guest{guests === 1 ? '' : 's'}</span>
          <Stepper label="adults" value={stay.adults ?? 2} min={1} max={30} onChange={(n) => setStay({ ...stay, adults: n })} />
        </div>
      </div>
      <button type="button" onClick={() => open()} disabled={!hotel.booking.open} className="mt-4 h-[50px] w-full rounded-full bg-primary text-[17px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:bg-neutral-300">
        {hotel.booking.open ? (nights ? 'Reserve' : 'Check availability') : 'Not taking online bookings'}
      </button>
      <p className="mt-3 text-center text-[14px] text-neutral-500">No card needed. You pay at the hotel.</p>
    </div>
  );
}

/** The rooms section of the page; Select opens the sheet on that room. */
export function RoomsSection() {
  const { hotel, stay, quotes, open } = useBooking();
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const byId = new Map((quotes ?? []).map((q) => [q.roomId, q]));
  const deal = hotel.deal?.percent ?? 0;

  return (
    <section id="rooms" className="scroll-mt-28">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[24px] font-bold text-ink md:text-[28px]">Rooms</h2>
        <button type="button" onClick={() => open()} className="text-[15px] font-medium text-ink underline">
          {nights ? `${short(stay.checkIn!)} – ${short(stay.checkOut!)}` : 'Add dates for prices'}
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        {hotel.rooms.length === 0 && <p className="py-4 text-[15px] text-neutral-500">Rooms for this hotel are being added.</p>}
        {hotel.rooms.map((r) => {
          const q = byId.get(r._id);
          const free = q ? (q.closed || !q.minNightsOk ? 0 : q.available) : null;
          const img = r.images[0] || hotel.coverImage;
          return (
            <article key={r._id} className="flex gap-3 rounded-[22px] border border-[color:var(--border)] bg-white p-2.5">
              <div className="h-[100px] w-[108px] shrink-0 overflow-hidden rounded-[16px] bg-neutral-100 sm:h-28 sm:w-40">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo(img, 384)} alt={`${r.name}, ${hotel.name}`} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-0.5">
                <h3 className="text-[17px] font-semibold leading-snug text-ink">{r.name}</h3>
                <p className="mt-0.5 text-[14px] text-neutral-500">
                  Sleeps {sleeps(r)}{r.bedType ? `, ${r.bedType}` : ''}{r.size > 0 ? `, ${r.size} sq ft` : ''}
                </p>
                {r.breakfastIncluded && (
                  <p className="mt-0.5 text-[14px] text-ink">Breakfast included</p>
                )}
                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
                  <p className="text-[17px] font-semibold text-ink tabular">
                    {q && nights ? pkr(q.total) : pkr(Math.round(r.price * (1 - deal / 100)))}
                    <span className="ml-1 text-[14px] font-normal text-neutral-500">{q && nights ? nightsLabel(nights) : 'night'}</span>
                    {free !== null && free > 0 && free <= 3 && <span className="ml-2 text-[14px] font-semibold text-ink">{free} left</span>}
                  </p>
                  {free === 0 ? (
                    <span className="text-[14px] font-medium text-neutral-500">Sold out</span>
                  ) : (
                    <button type="button" onClick={() => open({ roomId: r._id })} disabled={!hotel.booking.open} className="h-10 rounded-full bg-ink px-5 text-[15px] font-semibold text-white transition hover:bg-primary hover:text-white disabled:opacity-40">
                      Select
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
