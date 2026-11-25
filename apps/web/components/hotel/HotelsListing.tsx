import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import ExpandableHtml from '@/components/ExpandableHtml';
import { hotelCities, searchHotels, type CityStat } from '@/lib/hotels-server';
import { cityPath, fmtDay, readStay, SEGMENTS, segmentPath, stayParams } from '@/lib/hotels';
import HotelCard from './HotelCard';
import StaySearch from './StaySearch';
import { FiltersSidebar, FiltersToolbar } from './ResultsFilters';

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
const FILTER_KEYS = ['q', 'type', 'stars', 'amenities', 'minPrice', 'maxPrice', 'couples', 'foreigners', 'minRating', 'sort'];

/**
 * The results page behind /hotels, /hotels/<city>, /hotels/<segment> and
 * /hotels/<city>/<segment>. Pages 2+ are ?page=N on the same address.
 */
export default async function HotelsListing({ sp, page, citySlug, cityName, segment, title, intro, description, basePath }: {
  sp: SP;
  page: number;
  citySlug?: string;
  cityName?: string;
  /** A SEGMENTS key when the page is /hotels/[city/]<segment>. */
  segment?: string;
  title: string;
  intro?: string;
  description?: string;
  /** The page's own address; page 2, 3… add ?page=N. */
  basePath: string;
}) {
  const stay = readStay(sp);
  const params: Record<string, string | number | undefined> = { page, limit: 18, city: citySlug, ...stay };
  for (const k of FILTER_KEYS) params[k] = one(sp, k);
  const [res, cities] = await Promise.all([searchHotels(params), hotelCities()]);
  const items = res?.items ?? [];
  const total = res?.total ?? 0;
  const pages = res?.pages ?? 1;
  const dated = Boolean(stay.checkIn);
  // The segment's own filter (type/stars) is part of the address, not the query.
  const fixed: string[] = segment ? Object.keys(SEGMENTS[segment] ?? {}).filter((k) => k === 'type' || k === 'stars') : [];
  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v && k !== 'page' && !fixed.includes(k)) p.set(k, v);
    if (n > 1) p.set('page', String(n));
    const q = p.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Hotels', url: '/hotels' },
    ...(cityName ? [{ name: `Hotels in ${cityName}`, url: cityPath(citySlug!) }] : []),
    ...(segment ? [{ name: SEGMENTS[segment]!.label, url: basePath }] : []),
  ];
  const segLinks = [
    { key: '', label: citySlug ? `All in ${cityName}` : 'All hotels', href: citySlug ? cityPath(citySlug) : '/hotels' },
    ...Object.entries(SEGMENTS).map(([key, v]) => ({ key, label: v.label, href: segmentPath(key, citySlug) })),
  ];

  const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk').replace(/\/$/, '');
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: total,
    itemListElement: items.map((h, i) => ({ '@type': 'ListItem', position: (page - 1) * 18 + i + 1, url: `${SITE}/hotels/${h.citySlug}/${h.slug}`, name: h.name })),
  };

  return (
    <main className="pb-10">
      {items.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />}
      <div>
        <div className="container mx-auto px-4 pb-2 pt-4 md:pt-6">
          <div className="hidden md:block">
            <Breadcrumbs items={crumbs} />
          </div>
          <p className="eyebrow mt-1 md:mt-3">{total} {total === 1 ? 'hotel' : 'hotels'}{dated && res?.stay ? ` · ${res.stay.nights} night${res.stay.nights === 1 ? '' : 's'}` : ''}</p>
          <h1 className="mt-2 text-[32px] font-bold leading-[1.02] text-ink md:text-[48px]">{title}</h1>
          {intro && <p className="mt-1 hidden max-w-3xl text-[16px] text-neutral-600 md:block">{intro}</p>}
          <StaySearch
            variant="bar"
            className="mt-4 md:mt-5"
            cities={cities.map((c: CityStat) => ({ slug: c.slug, name: c.name, count: c.count }))}
            initial={stay}
            initialCity={citySlug}
            initialText={one(sp, 'q')}
          />
          <nav aria-label="Browse" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            {segLinks.map((l) => (
              <Link
                key={l.key || 'all'}
                href={l.href}
                aria-current={(segment ?? '') === l.key ? 'page' : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-[14.5px] font-medium transition ${(segment ?? '') === l.key ? 'border-ink bg-ink text-white' : 'border-[color:var(--border)] bg-white text-ink hover:border-ink'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="container mx-auto grid gap-6 px-4 pt-3 md:pt-5 lg:grid-cols-[290px_1fr]">
        <Suspense>
          <FiltersSidebar />
        </Suspense>
        <section aria-label="Hotels" className="min-w-0">
          <div>
            <Suspense>
              <FiltersToolbar total={total} />
            </Suspense>
            {dated && res?.stay && (
              <p className="mt-2 text-[14px] text-neutral-500">
                Prices are for {res.stay.nights} night{res.stay.nights === 1 ? '' : 's'}, {fmtDay(res.stay.checkIn)} to {fmtDay(res.stay.checkOut)}. Only hotels with free rooms are shown.
              </p>
            )}
          </div>

          {items.length ? (
            <div className="mt-3 space-y-3">
              {items.map((h, i) => (
                <HotelCard key={h._id} hotel={h} stay={dated ? stay : undefined} layout="row" priority={i < 2} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] bg-white p-8 text-center ring-1 ring-[color:var(--border)]">
              <SearchX className="mx-auto h-10 w-10 text-neutral-300" />
              <h2 className="mt-3 text-lg font-semibold text-ink">{dated ? 'No free rooms for these dates' : 'No hotels match these filters'}</h2>
              <p className="mt-1 text-sm text-neutral-500">{dated ? 'Try other dates, fewer rooms or a nearby city.' : 'Remove a filter or try another city.'}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {cities.slice(0, 6).map((c) => (
                  <Link key={c.slug} href={cityPath(c.slug) + stayParams(stay)} className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-ink hover:border-ink">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-1.5 px-4">
              {page > 1 && (
                <Link href={pageHref(page - 1)} rel="prev" aria-label="Previous page" className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 bg-white">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center gap-1.5">
                    {i > 0 && n - arr[i - 1]! > 1 && <span className="px-1 text-neutral-400">…</span>}
                    <Link href={pageHref(n)} aria-current={n === page ? 'page' : undefined} className={`grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold tabular ${n === page ? 'bg-ink text-white' : 'border border-neutral-300 bg-white text-ink'}`}>
                      {n}
                    </Link>
                  </span>
                ))}
              {page < pages && (
                <Link href={pageHref(page + 1)} rel="next" aria-label="Next page" className="grid h-10 w-10 place-items-center rounded-full border border-neutral-300 bg-white">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </nav>
          )}

          {description && page === 1 && (
            <div className="mt-7 rounded-[24px] bg-white p-6 ring-1 ring-[color:var(--border)]">
              <ExpandableHtml html={description} />
            </div>
          )}

          {!citySlug && cities.length > 0 && (
            <div className="mt-7">
              <h2 className="text-[22px] font-bold text-ink">Hotels by city</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {cities.map((c) => (
                  <Link key={c.slug} href={cityPath(c.slug)} className="rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 text-sm text-ink hover:border-ink">
                    Hotels in {c.name} <span className="text-neutral-400">{c.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
