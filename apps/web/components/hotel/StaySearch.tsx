'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, CalendarDays, Clock, MapPin, Minus, Plus, Search, Users } from 'lucide-react';
import DatePicker from './DatePicker';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cityPath, fmtDay, stayParams, type StayQuery } from '@/lib/hotels';
import { addRecentSearch, getRecentSearches, type RecentSearch } from '@/lib/hotels-api';
import { cn } from '@/lib/utils';
import { DateRangeField, GuestsField } from './StayFields';

export interface CityOption {
  slug: string;
  name: string;
  count?: number;
}

const guestsLabel = (s: StayQuery) => {
  const g = (s.adults ?? 2) + (s.children ?? 0);
  return `${g} guest${g === 1 ? '' : 's'}${(s.rooms ?? 1) > 1 ? `, ${s.rooms} rooms` : ''}`;
};
const datesLabel = (s: StayQuery) => (s.checkIn && s.checkOut ? `${fmtDay(s.checkIn, { day: 'numeric', month: 'short' })} to ${fmtDay(s.checkOut, { day: 'numeric', month: 'short' })}` : '');

function useGo(cities: CityOption[]) {
  const router = useRouter();
  return (text: string, city: CityOption | undefined, stay: StayQuery) => {
    const typed = text.trim();
    const exact = city ?? cities.find((c) => c.name.toLowerCase() === typed.toLowerCase());
    const qs = stayParams(stay);
    addRecentSearch({ citySlug: exact?.slug, label: exact?.name ?? (typed || 'All hotels'), ...stay });
    if (exact) router.push(cityPath(exact.slug) + qs);
    else if (typed) {
      const p = new URLSearchParams(qs.replace(/^\?/, ''));
      p.set('q', typed);
      router.push(`/hotels?${p.toString()}`);
    } else router.push('/hotels' + qs);
  };
}

function Counter({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-[16px] font-semibold text-ink">{label}</p>
        <p className="text-[13.5px] text-neutral-500">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
        <span className="w-8 text-center text-[18px] font-semibold tabular">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Phones: the whole search in one full-height sheet — where, when, who. */
function SearchSheet({ open, onOpenChange, cities, initial, initialText, focus }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cities: CityOption[];
  initial: StayQuery & { text: string; city?: CityOption };
  initialText?: string;
  focus: 'where' | 'when' | 'who';
}) {
  const go = useGo(cities);
  const [text, setText] = useState(initial.text ?? initialText ?? '');
  const [city, setCity] = useState<CityOption | undefined>(initial.city);
  const [stay, setStay] = useState<StayQuery>(initial);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    if (!open) return;
    setRecent(getRecentSearches());
    setTimeout(() => document.getElementById(`ss-${focus}`)?.scrollIntoView({ block: 'start' }), 250);
  }, [open, focus]);

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (t && !city ? cities.filter((c) => c.name.toLowerCase().includes(t)) : cities).slice(0, 8);
  }, [text, city, cities]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="h-[96dvh] max-h-[96dvh] rounded-t-[24px] p-0">
        <DrawerTitle className="sr-only">Search hotels</DrawerTitle>
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 pb-3 pt-1">
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f7f5fc]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-[17px] font-semibold text-ink">Find a hotel</p>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4">
          <section id="ss-where" className="scroll-mt-2">
            <p className="mb-2 text-[16px] font-semibold text-ink">Where to?</p>
            <label className="flex h-[52px] items-center gap-3 rounded-full border border-neutral-300 px-4 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
              <Search className="h-5 w-5 text-neutral-400" />
              <input
                value={text}
                onChange={(e) => { setText(e.target.value); setCity(undefined); }}
                placeholder="City or hotel name"
                className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-neutral-400"
                enterKeyHint="search"
              />
            </label>
            {recent.length > 0 && !text && (
              <div className="mt-3">
                <p className="mb-1 text-[14px] font-semibold text-neutral-500">Recent searches</p>
                {recent.map((r) => (
                  <button key={r.label + (r.checkIn ?? '')} type="button" onClick={() => go(r.citySlug ? '' : r.label, r.citySlug ? cities.find((c) => c.slug === r.citySlug) : undefined, r)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left hover:bg-neutral-50">
                    <Clock className="h-[18px] w-[18px] text-neutral-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium text-ink">{r.label}</span>
                      {r.checkIn && <span className="block text-[13.5px] text-neutral-500">{datesLabel(r)}, {guestsLabel(r)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {matches.map((c) => (
                <button key={c.slug} type="button" onClick={() => { setCity(c); setText(c.name); }} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[15px] font-medium', city?.slug === c.slug ? 'border-ink bg-ink text-white' : 'border-neutral-200 text-ink')}>
                  <MapPin className="h-4 w-4" /> {c.name}
                </button>
              ))}
              {text.trim() && !city && !cities.some((c) => c.name.toLowerCase() === text.trim().toLowerCase()) && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[15px] text-neutral-600"><Building2 className="h-4 w-4" /> Hotels named “{text.trim()}”</span>
              )}
            </div>
          </section>

          <section id="ss-when" className="scroll-mt-2">
            <p className="mb-3 text-[18px] font-bold text-ink">When are you staying?</p>
            <DatePicker checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(checkIn, checkOut) => setStay({ ...stay, checkIn, checkOut })} />
          </section>

          <section id="ss-who" className="scroll-mt-2 pb-4">
            <p className="mb-1 text-[16px] font-semibold text-ink">Who?</p>
            <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
              <Counter label="Adults" hint="13 years and above" value={stay.adults ?? 2} min={1} max={30} onChange={(n) => setStay({ ...stay, adults: n, rooms: Math.min(stay.rooms ?? 1, n) })} />
              <Counter label="Children" hint="Up to 12 years" value={stay.children ?? 0} min={0} max={20} onChange={(n) => setStay({ ...stay, children: n })} />
              <Counter label="Rooms" hint="How many rooms you need" value={stay.rooms ?? 1} min={1} max={Math.min(10, stay.adults ?? 2)} onChange={(n) => setStay({ ...stay, rooms: n })} />
            </div>
          </section>
        </div>
        <div className="border-t border-neutral-100 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={() => { onOpenChange(false); go(text, city, stay); }} className="btn-yellow h-[54px] w-full text-[17px]">
            <Search className="h-5 w-5" /> Search{city ? ` ${city.name}` : ''}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Where / when / who. On a phone it is a card (hero) or one line (results
 * pages) that opens the full search sheet; on desktop the fields sit inline.
 */
export default function StaySearch({ cities, initial, initialCity, initialText, variant = 'hero', className }: {
  cities: CityOption[];
  initial?: StayQuery;
  initialCity?: string;
  initialText?: string;
  variant?: 'hero' | 'bar';
  className?: string;
}) {
  const go = useGo(cities);
  const startCity = cities.find((c) => c.slug === initialCity);
  const [text, setText] = useState(startCity?.name ?? initialText ?? '');
  const [city, setCity] = useState<CityOption | undefined>(startCity);
  const [focusList, setFocusList] = useState(false);
  const [stay, setStay] = useState<StayQuery>({ adults: 2, children: 0, rooms: 1, ...initial });
  const [sheet, setSheet] = useState<{ open: boolean; focus: 'where' | 'when' | 'who' }>({ open: false, focus: 'where' });

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (t ? cities.filter((c) => c.name.toLowerCase().includes(t)) : cities).slice(0, 8);
  }, [text, cities]);
  const openSheet = (focus: 'where' | 'when' | 'who') => setSheet({ open: true, focus });
  const hero = variant === 'hero';

  return (
    <div className={className}>
      {/* phones */}
      <div className="md:hidden">
        {hero ? (
          <div className="rounded-[28px] bg-white p-2 shadow-[0_24px_50px_-28px_rgba(14,14,16,0.45)] ring-1 ring-[color:var(--border)]">
            <button type="button" onClick={() => openSheet('where')} className="flex w-full items-center gap-3 rounded-[20px] bg-[#f7f5fc] px-3 py-2.5 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-[color:var(--border)]"><MapPin className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Where</span>
                <span className={cn('block truncate text-[17px] font-semibold', text ? 'text-ink' : 'text-neutral-400')}>{text || 'City or hotel name'}</span>
              </span>
            </button>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => openSheet('when')} className="flex min-w-0 items-center gap-2.5 rounded-[20px] bg-[#f7f5fc] px-3 py-2.5 text-left">
                <CalendarDays className="h-5 w-5 shrink-0 text-ink" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold uppercase tracking-[0.1em] text-neutral-500">When</span>
                  <span className={cn('block truncate text-[15.5px] font-semibold', stay.checkIn ? 'text-ink' : 'text-neutral-400')}>{datesLabel(stay) || 'Add dates'}</span>
                </span>
              </button>
              <button type="button" onClick={() => openSheet('who')} className="flex min-w-0 items-center gap-2.5 rounded-[20px] bg-[#f7f5fc] px-3 py-2.5 text-left">
                <Users className="h-5 w-5 shrink-0 text-ink" />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Who</span>
                  <span className="block truncate text-[15.5px] font-semibold text-ink">{guestsLabel(stay)}</span>
                </span>
              </button>
            </div>
            <button type="button" onClick={() => go(text, city, stay)} className="btn-yellow mt-2 h-[54px] w-full text-[17px]">
              <Search className="h-5 w-5" /> Search hotels
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => openSheet('where')} className="flex w-full items-center gap-3 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-left shadow-sm">
            <Search className="h-5 w-5 shrink-0 text-ink" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15.5px] font-semibold text-ink">{text || 'All of Pakistan'}</span>
              <span className="block truncate text-[13.5px] text-neutral-500">{[datesLabel(stay) || 'Any dates', guestsLabel(stay)].join(', ')}</span>
            </span>
            <span className="text-[14px] font-semibold text-ink">Edit</span>
          </button>
        )}
        <SearchSheet
          key={sheet.open ? 'o' : 'c'}
          open={sheet.open}
          onOpenChange={(v) => setSheet((s) => ({ ...s, open: v }))}
          cities={cities}
          initial={{ ...stay, text, city }}
          focus={sheet.focus}
        />
      </div>

      {/* desktop */}
      <form
        onSubmit={(e) => { e.preventDefault(); go(text, city, stay); }}
        className={cn('hidden w-full bg-white md:block', hero ? 'rounded-full border border-[color:var(--border)] p-2 pl-3 shadow-[0_24px_50px_-28px_rgba(14,14,16,0.45)]' : 'rounded-full border border-[color:var(--border)] p-1.5')}
      >
        <div className="grid grid-cols-[1.3fr_1.4fr_1.1fr_auto] gap-1">
          <div className="relative rounded-full px-4 py-2 hover:bg-[#f7f5fc]">
            <label className="flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-ink" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-neutral-500">Where</span>
                <input
                  value={text}
                  onChange={(e) => { setText(e.target.value); setCity(undefined); }}
                  onFocus={() => setFocusList(true)}
                  onBlur={() => setTimeout(() => setFocusList(false), 150)}
                  placeholder="City or hotel name"
                  className="block w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-neutral-400"
                  autoComplete="off"
                />
              </span>
            </label>
            {focusList && matches.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1.5 shadow-xl">
                {matches.map((c) => (
                  <li key={c.slug}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCity(c); setText(c.name); setFocusList(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50">
                      <MapPin className="h-4 w-4 text-neutral-400" />
                      <span className="flex-1 text-[15.5px] font-medium text-ink">{c.name}</span>
                      {c.count ? <span className="text-[13.5px] text-neutral-400">{c.count} hotels</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-full px-4 py-2 hover:bg-[#f7f5fc]">
            <DateRangeField checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(checkIn, checkOut) => setStay((s) => ({ ...s, checkIn, checkOut }))} />
          </div>
          <div className="rounded-full px-4 py-2 hover:bg-[#f7f5fc]">
            <GuestsField adults={stay.adults ?? 2} children={stay.children ?? 0} rooms={stay.rooms ?? 1} onChange={(v) => setStay((s) => ({ ...s, ...v }))} />
          </div>
          <button type="submit" className="btn-yellow h-auto px-7">
            <Search className="h-5 w-5" /> Search
          </button>
        </div>
      </form>
    </div>
  );
}
