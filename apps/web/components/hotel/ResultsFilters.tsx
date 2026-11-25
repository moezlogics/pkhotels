'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Star, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FILTER_AMENITIES } from '@/lib/hotel-amenities';
import { PROPERTY_TYPES } from '@/lib/hotels';
import { cn } from '@/lib/utils';

const PRICES = [
  { label: 'Under Rs 5,000', min: '', max: '5000' },
  { label: 'Rs 5,000 to 10,000', min: '5000', max: '10000' },
  { label: 'Rs 10,000 to 20,000', min: '10000', max: '20000' },
  { label: 'Rs 20,000 to 40,000', min: '20000', max: '40000' },
  { label: 'Above Rs 40,000', min: '40000', max: '' },
];

const SORTS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'price_asc', label: 'Lowest price' },
  { key: 'price_desc', label: 'Highest price' },
  { key: 'rating', label: 'Best rated' },
  { key: 'newest', label: 'Newest' },
];

const FILTER_KEYS = ['stars', 'amenities', 'type', 'minPrice', 'maxPrice', 'couples', 'foreigners', 'minRating'];

/** Filters live in the address (?stars=4,5&amenities=wifi,generator), so results can be shared. */
function useQuery() {
  const router = useRouter();
  const pathname = usePathname() || '/hotels';
  const sp = useSearchParams();
  const base = pathname.replace(/page\/\d+\/?$/, '');
  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    p.delete('page');
    const qs = p.toString();
    router.push(base + (qs ? `?${qs}` : ''), { scroll: false });
  };
  const list = (k: string) => (sp?.get(k) || '').split(',').filter(Boolean);
  const toggle = (k: string, v: string) => {
    const cur = list(k);
    set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') || null });
  };
  return { sp, set, list, toggle };
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14.5px] font-medium transition',
        on ? 'border-ink bg-ink text-white' : 'border-[color:var(--border)] bg-white text-ink hover:border-ink',
      )}
    >
      {children}
    </button>
  );
}

function FilterBody() {
  const { sp, set, list, toggle } = useQuery();
  const stars = list('stars');
  const am = list('amenities');
  const type = sp?.get('type') || '';
  const min = sp?.get('minPrice') || '';
  const max = sp?.get('maxPrice') || '';
  const any = FILTER_KEYS.some((k) => sp?.get(k));
  const h = 'mb-2.5 text-[16px] font-semibold text-ink';

  return (
    <div className="space-y-6">
      {any && (
        <button type="button" onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))} className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
          <X className="h-4 w-4" /> Clear all filters
        </button>
      )}
      <section>
        <h3 className={h}>Popular</h3>
        <div className="flex flex-wrap gap-2">
          <Chip on={sp?.get('couples') === '1'} onClick={() => set({ couples: sp?.get('couples') === '1' ? null : '1' })}>Couple friendly</Chip>
          <Chip on={sp?.get('foreigners') === '1'} onClick={() => set({ foreigners: sp?.get('foreigners') === '1' ? null : '1' })}>Foreign guests welcome</Chip>
          <Chip on={sp?.get('minRating') === '4'} onClick={() => set({ minRating: sp?.get('minRating') === '4' ? null : '4' })}>Rated 4 and above</Chip>
        </div>
      </section>
      <section>
        <h3 className={h}>Price per night</h3>
        <div className="flex flex-wrap gap-2">
          {PRICES.map((p) => {
            const on = min === p.min && max === p.max;
            return (
              <Chip key={p.label} on={on} onClick={() => set(on ? { minPrice: null, maxPrice: null } : { minPrice: p.min, maxPrice: p.max })}>
                {p.label}
              </Chip>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className={h}>Stars</h3>
        <div className="flex flex-wrap gap-2">
          {['5', '4', '3', '2'].map((s) => (
            <Chip key={s} on={stars.includes(s)} onClick={() => toggle('stars', s)}>
              {s} <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h3 className={h}>Facilities</h3>
        <div className="flex flex-wrap gap-2">
          {FILTER_AMENITIES.map((a) => {
            const Icon = a.icon;
            return (
              <Chip key={a.key} on={am.includes(a.key)} onClick={() => toggle('amenities', a.key)}>
                <Icon className="h-3.5 w-3.5" /> {a.label}
              </Chip>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className={h}>Type of place</h3>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.slice(0, 6).map((t) => (
            <Chip key={t.key} on={type === t.key} onClick={() => set({ type: type === t.key ? null : t.key })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </section>
    </div>
  );
}

export function FiltersSidebar() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--border)]">
        <h2 className="mb-4 text-[22px] font-bold text-ink">Filters</h2>
        <FilterBody />
      </div>
    </aside>
  );
}

export function FiltersToolbar({ total }: { total: number }) {
  const { sp, set } = useQuery();
  const [open, setOpen] = useState(false);
  const count = FILTER_KEYS.reduce((n, k) => n + (sp?.get(k) ? 1 : 0), 0);
  const flip = (k: string, v: string) => set({ [k]: sp?.get(k) === v ? null : v });
  const under10 = sp?.get('maxPrice') === '10000' && !sp?.get('minPrice');

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button type="button" className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14.5px] font-semibold', count ? 'border-primary bg-primary text-white' : 'border-ink bg-ink text-white')}>
              <SlidersHorizontal className="h-4 w-4" /> Filters{count ? ` ${count}` : ''}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-[24px] p-5 pb-28">
            <SheetTitle className="mb-4 text-lg font-semibold">Filters</SheetTitle>
            <FilterBody />
            <div className="fixed inset-x-0 bottom-0 border-t border-neutral-100 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <Button className="btn-yellow h-[52px] w-full rounded-full text-[16px] font-semibold" onClick={() => setOpen(false)}>
                Show {total} {total === 1 ? 'hotel' : 'hotels'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <Chip on={under10} onClick={() => set(under10 ? { maxPrice: null, minPrice: null } : { maxPrice: '10000', minPrice: null })}>Under Rs 10,000</Chip>
        <Chip on={sp?.get('minRating') === '4'} onClick={() => flip('minRating', '4')}>Rated 4+</Chip>
        <Chip on={sp?.get('couples') === '1'} onClick={() => flip('couples', '1')}>Couple friendly</Chip>
        <Chip on={sp?.get('foreigners') === '1'} onClick={() => flip('foreigners', '1')}>Foreign guests welcome</Chip>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-neutral-600">
          <b className="text-ink">{total}</b> {total === 1 ? 'hotel' : 'hotels'}
        </p>
        <label className="flex items-center gap-2 text-[14px] text-neutral-500">
          Sort
          <select
            aria-label="Sort by"
            value={sp?.get('sort') || 'recommended'}
            onChange={(e) => set({ sort: e.target.value === 'recommended' ? null : e.target.value })}
            className="h-10 rounded-full border border-[color:var(--border)] bg-white px-3 text-[14.5px] font-semibold text-ink outline-none focus:border-ink"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
