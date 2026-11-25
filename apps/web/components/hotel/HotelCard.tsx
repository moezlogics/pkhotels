import Link from 'next/link';
import { Approx } from '@/components/Currency';
import { ArrowUpRight, BadgeCheck, MapPin, Star } from 'lucide-react';
import { photo, photoSrcSet } from '@/lib/img';
import { COUPLE_POLICIES, type HotelCardData, hotelPath, pkr, ratingWord, stayParams, type StayQuery, typeLabel } from '@/lib/hotels';
import { amenity } from '@/lib/hotel-amenities';
import { cn } from '@/lib/utils';
import WishlistButton from './WishlistButton';

export function Stars({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn('inline-flex items-center gap-px', className)} aria-label={`${n} star hotel`}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="h-3 w-3 fill-gold text-gold" />
      ))}
    </span>
  );
}

/** "4.6 Excellent (38)" — the rating as guests read it. */
export function RatingPill({ avg, count, className, compact }: { avg: number; count: number; className?: string; compact?: boolean }) {
  if (!count) return <span className={cn('text-[13.5px] text-neutral-500', className)}>New</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[14px]', className)}>
      <span className="inline-flex items-center gap-0.5 font-semibold text-ink tabular">
        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
        {avg.toFixed(1)}
      </span>
      {!compact && <span className="font-medium text-ink">{ratingWord(avg)}</span>}
      <span className="text-neutral-500">({count})</span>
    </span>
  );
}

function Photo({ hotel, className, sizes, priority }: { hotel: HotelCardData; className: string; sizes: string; priority?: boolean }) {
  const img = hotel.coverImage || hotel.gallery[0];
  return (
    <div className={cn('relative overflow-hidden bg-neutral-200', className)}>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo(img, 640)}
          srcSet={photoSrcSet(img, [384, 640, 828])}
          sizes={sizes}
          alt={hotel.name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          className="h-full w-full object-cover"
        />
      )}
      {(hotel.deal || hotel.featured) && (
        <span className={cn('absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[12px] font-semibold', hotel.deal ? 'bg-primary text-primary-foreground' : 'bg-highlight text-ink shadow-sm')}>
          {hotel.deal ? `${hotel.deal.percent}% off` : 'Featured'}
        </span>
      )}
      <WishlistButton slug={hotel.slug} className="absolute right-2.5 top-2.5 h-8 w-8" />
    </div>
  );
}

function PriceBlock({ hotel, align = 'left' }: { hotel: HotelCardData; align?: 'left' | 'right' }) {
  const q = hotel.quote;
  const deal = hotel.deal?.percent ?? 0;
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      {q ? (
        <>
          {q.totalBefore > q.total && <p className="text-[13px] text-neutral-400 line-through tabular">{pkr(q.totalBefore)}</p>}
          <p className="text-[18px] font-semibold leading-tight text-ink tabular">{pkr(q.total)}</p>
          <p className="text-[13px] text-neutral-500">for {q.nights} night{q.nights === 1 ? '' : 's'} <Approx pkr={q.total} className="text-neutral-500" /></p>
        </>
      ) : hotel.minPrice > 0 ? (
        <p className="text-[14px] text-neutral-500">
          <span className="text-[18px] font-semibold text-ink tabular">{pkr(Math.round(hotel.minPrice * (1 - deal / 100)))}</span> /night
          <Approx pkr={Math.round(hotel.minPrice * (1 - deal / 100))} className="block text-[12.5px] text-neutral-500" />
        </p>
      ) : (
        <p className="text-[14px] font-semibold text-ink">See rooms</p>
      )}
    </div>
  );
}

/**
 * Two shapes: "grid" for carousels and grids (photo on top, no box around it),
 * "row" for result lists (photo left, details right — the most hotels per
 * screen on a phone).
 */
export default function HotelCard({ hotel, stay, layout = 'grid', priority = false }: { hotel: HotelCardData; stay?: StayQuery; layout?: 'grid' | 'row'; priority?: boolean }) {
  const href = hotelPath(hotel.slug, hotel.citySlug) + (stay ? stayParams(stay) : '');
  const place = [hotel.areaName, hotel.cityName].filter(Boolean).join(', ');

  if (layout === 'row') {
    const q = hotel.quote;
    const perks = (hotel.amenities ?? []).map(amenity).filter(Boolean).slice(0, 3);
    const couple = COUPLE_POLICIES[hotel.couplePolicy || '']?.short;
    return (
      <Link href={href} className="group flex flex-col overflow-hidden rounded-[26px] bg-white p-2 ring-1 ring-[color:var(--border)] transition duration-300 hover:shadow-[0_24px_40px_-28px_rgba(14,14,16,0.5)] hover:ring-ink/30 sm:flex-row sm:gap-1 md:p-2.5">
        <Photo hotel={hotel} priority={priority} sizes="(min-width: 768px) 300px, 94vw" className="aspect-[16/10] w-full shrink-0 rounded-[20px] sm:aspect-auto sm:h-auto sm:min-h-[210px] sm:w-[260px] md:w-[300px]" />
        <div className="flex min-w-0 flex-1 flex-col px-2 pb-1.5 pt-3 sm:px-4 sm:py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-500">
                <span>{typeLabel(hotel.propertyType)}</span>
                <Stars n={hotel.stars} />
              </div>
              <h3 className="font-display mt-0.5 line-clamp-2 text-[19px] font-bold leading-snug tracking-tight text-ink md:text-[21px]">
                {hotel.name}
                {hotel.verified && <BadgeCheck className="ml-1 inline h-[18px] w-[18px] -translate-y-0.5 text-ink" aria-label="Verified" />}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-[14px] text-neutral-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{place}</span>
              </p>
            </div>
            {hotel.ratingCount > 0 ? (
              <div className="shrink-0 text-right">
                <span className="font-display inline-grid h-10 min-w-10 place-items-center rounded-full bg-highlight px-2 text-[16px] font-bold text-ink tabular">{hotel.ratingAvg.toFixed(1)}</span>
                <p className="mt-0.5 text-[12.5px] text-neutral-500">{hotel.ratingCount} review{hotel.ratingCount === 1 ? '' : 's'}</p>
              </div>
            ) : (
              <span className="shrink-0 rounded-full bg-[#f7f5fc] px-2.5 py-1 text-[12.5px] font-semibold text-ink">New</span>
            )}
          </div>

          {(perks.length > 0 || couple) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {couple && <span className="rounded-full bg-ink px-2.5 py-1 text-[12.5px] font-medium text-white">{couple}</span>}
              {hotel.acceptsForeigners === 'yes' && <span className="rounded-full bg-accent px-2.5 py-1 text-[12.5px] font-medium text-ink">Foreign guests welcome</span>}
              {hotel.airportPickup && <span className="rounded-full bg-accent px-2.5 py-1 text-[12.5px] font-medium text-ink">Airport pickup</span>}
              {perks.map((a) => {
                const Icon = a!.icon;
                return (
                  <span key={a!.key} className="inline-flex items-center gap-1 rounded-full bg-[#f7f5fc] px-2.5 py-1 text-[12.5px] font-medium text-neutral-700">
                    <Icon className="h-3.5 w-3.5" /> {a!.label}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-[color:var(--border)] pt-3 sm:mt-4">
            <div className="min-w-0">
              <PriceBlock hotel={hotel} />
              {q && q.roomsLeft <= 3 && <p className="text-[13px] font-semibold text-ink">Only {q.roomsLeft} room{q.roomsLeft === 1 ? '' : 's'} left</p>}
              {!q && <p className="text-[13px] text-neutral-500">Pay at the hotel</p>}
            </div>
            <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 text-[15px] font-semibold text-white transition group-hover:bg-primary group-hover:text-white">
              View rooms <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block rounded-[24px] bg-white p-2 ring-1 ring-[color:var(--border)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-28px_rgba(14,14,16,0.5)] hover:ring-ink/30">
      <Photo hotel={hotel} priority={priority} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 78vw" className="aspect-[4/3] rounded-[18px]" />
      <div className="px-2 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[16.5px] font-semibold text-ink">{hotel.name}</h3>
          <RatingPill avg={hotel.ratingAvg} count={hotel.ratingCount} compact className="shrink-0" />
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[14px] text-neutral-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{place}</p>
        <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-dashed border-[color:var(--border)] pt-2.5">
          <PriceBlock hotel={hotel} />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f7f5fc] text-ink transition group-hover:bg-primary group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
