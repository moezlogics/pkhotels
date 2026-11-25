'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, ChevronDown, Loader2, Pencil, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { apiError, hotelsApi } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { COUNTRIES, browserCountry } from '@/lib/countries';

const WORDS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
const PARTS = [
  { k: 'cleanliness', label: 'Cleanliness' },
  { k: 'staff', label: 'Staff' },
  { k: 'location', label: 'Location' },
  { k: 'value', label: 'Value for money' },
] as const;
const TRIPS = [
  { k: 'family', label: 'Family' },
  { k: 'couple', label: 'Couple' },
  { k: 'business', label: 'Business' },
  { k: 'friends', label: 'Friends' },
  { k: 'solo', label: 'Solo' },
];

type Form = { rating: number; cleanliness: number; staff: number; location: number; value: number; tripType: string; title: string; text: string; country: string };
const EMPTY: Form = { rating: 0, cleanliness: 0, staff: 0, location: 0, value: 0, tripType: '', title: '', text: '', country: '' };

function StarRow({ value, onChange, size = 'h-9 w-9', label }: { value: number; onChange: (n: number) => void; size?: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className="rounded-full p-0.5 transition active:scale-90"
        >
          <Star className={cn(size, n <= value ? 'fill-primary text-ink' : 'text-neutral-300')} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}

/**
 * "Write a review" on the hotel page. Any signed-in account can review a
 * hotel once (and edit it later); signing in comes first, and the stars a
 * visitor tapped are kept through the sign-in. Accounts that stayed here
 * through PakHotels get a "Stayed here" badge automatically.
 */
export default function ReviewComposer({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isMobile = useIsMobile();
  const [mine, setMine] = useState<{ review: any; own: boolean; stayed: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMine(await hotelsApi.myReview(hotelId));
    } catch {
      setMine({ review: null, own: false, stayed: false });
    }
  }, [hotelId]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  // Back from sign-in with ?review=4: open the form with those stars.
  useEffect(() => {
    const n = Number(sp.get('review'));
    if (!isAuthenticated || !mine || mine.own || !(n >= 1 && n <= 5)) return;
    start(n);
    const url = new URL(window.location.href);
    url.searchParams.delete('review');
    window.history.replaceState(null, '', url.pathname + url.search + '#reviews');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, mine]);

  function start(rating: number) {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`${pathname}?review=${rating || 5}#reviews`)}`);
      return;
    }
    const r = mine?.review;
    setForm(
      r
        ? { rating: rating || r.rating, cleanliness: r.cleanliness || 0, staff: r.staff || 0, location: r.location || 0, value: r.value || 0, tripType: r.tripType || '', title: r.title || '', text: r.text || '', country: r.country || '' }
        : { ...EMPTY, rating, country: browserCountry() || 'PK' },
    );
    setDetails(!!(r && (r.cleanliness || r.staff || r.location || r.value)));
    setOpen(true);
  }

  async function submit() {
    if (!form.rating) return toast.error('Tap a star to rate your stay.');
    setBusy(true);
    try {
      const res = await hotelsApi.saveReview(hotelId, form);
      setOpen(false);
      await load();
      if (res.status === 'pending') toast.success('Thank you! Your review will appear after a quick check.');
      else toast.success(mine?.review ? 'Your review is updated.' : 'Thank you! Your review is live.');
      router.refresh();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete your review of this hotel?')) return;
    try {
      await hotelsApi.deleteReview(hotelId);
      toast.success('Your review was deleted.');
      await load();
      router.refresh();
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  if (isLoading) return null;
  if (mine?.own) return <p className="mt-4 rounded-2xl bg-surface p-4 text-[14.5px] text-neutral-600">This is your hotel — guests&apos; reviews show here, and you can reply from your dashboard.</p>;

  const r = mine?.review;
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <p className="eyebrow">Your review</p>
          <p className="mt-1 text-[19px] font-bold leading-tight text-ink">{hotelName}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mt-4 flex flex-col items-center rounded-2xl bg-surface px-3 py-4">
          <StarRow value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} size="h-10 w-10" label="Overall rating" />
          <p className="mt-2 h-6 text-[16px] font-semibold text-ink">{form.rating ? WORDS[form.rating] : 'Tap to rate'}</p>
        </div>
        {mine?.stayed && (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-neutral-600">
            <BadgeCheck className="h-4 w-4 text-ink" /> You stayed here — your review shows as “Stayed here”.
          </p>
        )}

        <label className="mt-5 block text-[15px] font-semibold text-ink" htmlFor="rv-country">Where are you from? <span className="font-normal text-neutral-500">(optional)</span></label>
        <select id="rv-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-2 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[16px] text-ink">
          <option value="">Prefer not to say</option>
          {COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
        </select>

        <p className="mt-5 text-[15px] font-semibold text-ink">Who did you travel with? <span className="font-normal text-neutral-500">(optional)</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRIPS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setForm({ ...form, tripType: form.tripType === t.k ? '' : t.k })}
              className={cn('h-10 rounded-full border px-4 text-[14.5px] font-medium', form.tripType === t.k ? 'border-ink bg-ink text-white' : 'border-neutral-200 bg-white text-ink')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-[15px] font-semibold text-ink" htmlFor="rv-text">
          Tell other guests about it <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <Textarea
          id="rv-text"
          className="mt-2 text-[16px]"
          rows={4}
          maxLength={2000}
          placeholder="Rooms, cleanliness, staff, food, location — what was good, what could be better?"
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
        />
        <Input className="mt-2 text-[16px]" maxLength={120} placeholder="A short title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

        <button type="button" onClick={() => setDetails((d) => !d)} className="mt-4 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          Rate the details <span className="font-normal text-neutral-500">(optional)</span>
          <ChevronDown className={cn('h-4 w-4 transition', details && 'rotate-180')} />
        </button>
        {details && (
          <div className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-3">
            {PARTS.map((p) => (
              <div key={p.k} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[15px] text-neutral-700">{p.label}</span>
                <StarRow value={form[p.k]} onChange={(n) => setForm({ ...form, [p.k]: n })} size="h-6 w-6" label={p.label} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[13px] text-neutral-500">Shown with your first name and last initial. Please keep it honest and about your own visit; links and phone numbers are checked before they go live.</p>
      </div>
      <div className="border-t border-neutral-200 bg-white px-5 py-3">
        <button type="button" disabled={busy || !form.rating} onClick={() => void submit()} className="btn-yellow h-12 w-full text-[16px] disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : r ? 'Update review' : 'Post review'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {r ? (
        <div className="mt-5 rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">Your review</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[16px] font-semibold text-ink"><Star className="h-4 w-4 fill-primary text-ink" />{r.rating}</span>
                <span className="text-[14px] text-neutral-500">{WORDS[r.rating]}{r.status === 'pending' ? ' · waiting for a quick check' : r.status === 'hidden' ? ' · hidden by PakHotels' : ''}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => start(0)} className="btn-ghost btn-sm inline-flex items-center gap-1.5"><Pencil className="h-4 w-4" /> Edit</button>
              <button type="button" onClick={() => void remove()} aria-label="Delete review" className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 text-neutral-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          {r.text && <p className="mt-2 line-clamp-3 text-[15px] text-neutral-600">{r.text}</p>}
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[16px] font-semibold text-ink">Been here? Rate it</p>
            <p className="text-[14px] text-neutral-500">{isAuthenticated ? 'Tap the stars — it takes a minute.' : 'Sign in, then tap the stars — it takes a minute.'}</p>
          </div>
          <StarRow value={0} onChange={start} size="h-9 w-9" label="Rate this hotel" />
        </div>
      )}

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[94dvh]">
            <DrawerTitle className="sr-only">Review {hotelName}</DrawerTitle>
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-lg [&>button]:hidden">
            <DialogTitle className="sr-only">Review {hotelName}</DialogTitle>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
