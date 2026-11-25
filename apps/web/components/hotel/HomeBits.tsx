'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { photo } from '@/lib/img';
import { hotelPath, pkr } from '@/lib/hotels';
import { getRecentHotels, type RecentHotel } from '@/lib/hotels-api';

/** "Recently viewed" — only on this phone, only when there is something. */
export function RecentlyViewed() {
  const [items, setItems] = useState<RecentHotel[]>([]);
  useEffect(() => setItems(getRecentHotels()), []);
  if (!items.length) return null;
  return (
    <section className="container mx-auto px-4 pt-12">
      <p className="eyebrow">Recently viewed</p>
      <h2 className="mt-2 text-[24px] font-bold text-ink md:text-[30px]">Pick up where you left off</h2>
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {items.map((h) => (
          <Link key={h.slug} href={hotelPath(h.slug, h.citySlug)} className="flex w-[260px] shrink-0 snap-start items-center gap-3 rounded-[22px] bg-white p-2.5 ring-1 ring-[color:var(--border)] transition hover:ring-ink">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
              {h.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo(h.coverImage, 160)} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{h.name}</p>
              <p className="truncate text-[13.5px] text-neutral-500">{h.cityName}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[13.5px]">
                {h.minPrice > 0 && <span className="font-semibold text-ink tabular">{pkr(h.minPrice)}</span>}
                {h.ratingCount > 0 && <span className="inline-flex items-center gap-0.5 text-neutral-600"><Star className="h-3 w-3 fill-gold text-gold" />{h.ratingAvg.toFixed(1)}</span>}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
