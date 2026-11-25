import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import HotelsListing from '@/components/hotel/HotelsListing';
import { cityInfo, hotelBySlug } from '@/lib/hotels-server';
import { hotelPath, isSegment, SEGMENTS } from '@/lib/hotels';

/*
 * /hotels/<one segment> is one of three things:
 *   a city            /hotels/lahore
 *   a kind, nationwide /hotels/guest-houses, /hotels/5-star
 *   an old hotel link /hotels/<hotel-slug>/ → 308 to /hotels/<city>/<hotel-slug>
 */
type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ city: string }>; searchParams: Promise<SP> };

export const revalidate = 300;

const FILTERS = ['q', 'type', 'stars', 'amenities', 'minPrice', 'maxPrice', 'couples', 'foreigners', 'minRating', 'sort', 'checkIn', 'page'];
const filtered = (sp: SP) => FILTERS.some((k) => sp[k]);

function qs(sp: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city } = await params;
  const sp = await searchParams;
  const noindex = filtered(sp) ? { robots: { index: false, follow: true } } : {};
  if (isSegment(city)) {
    const seg = SEGMENTS[city]!;
    const title = `${seg.h1('Pakistan')} — Compare Prices & Book | PakHotels`;
    const description = `${seg.h1('Pakistan')}: compare real room prices per night, photos and verified guest reviews in every city, and book online in a minute.`;
    return { title, description, alternates: { canonical: `/hotels/${city}` }, openGraph: { title, description, url: `/hotels/${city}` }, ...noindex };
  }
  const info = await cityInfo(city);
  if (!info) return { title: 'Hotels | PakHotels', robots: { index: false } };
  const from = info.minPrice ? ` from Rs ${info.minPrice.toLocaleString('en-PK')}` : '';
  const title = info.metaTitle || `Hotels in ${info.name} — ${info.count > 1 ? `${info.count} Hotels` : 'Book Online'}${from} | PakHotels`;
  const description =
    info.metaDescription ||
    `Compare ${info.count > 1 ? `${info.count} hotels` : 'hotels'} in ${info.name} with real room prices${from ? `${from} a night` : ' per night'}, photos and verified guest reviews. Family, couple-friendly and budget stays — book online in a minute.`;
  return {
    title,
    description,
    alternates: { canonical: `/hotels/${info.slug}` },
    openGraph: { title, description, url: `/hotels/${info.slug}`, ...(info.thumbnail ? { images: [info.thumbnail] } : {}) },
    ...noindex,
  };
}

export default async function CityOrSegment({ params, searchParams }: Props) {
  const { city } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  if (isSegment(city)) {
    const seg = SEGMENTS[city]!;
    return (
      <HotelsListing
        sp={{ ...sp, ...(seg.type ? { type: seg.type } : {}), ...(seg.stars ? { stars: seg.stars } : {}) }}
        page={page}
        segment={city}
        basePath={`/hotels/${city}`}
        title={seg.h1('Pakistan')}
        intro="Real prices per night, rooms you can reserve now, and you pay at the hotel."
      />
    );
  }

  const info = await cityInfo(city);
  if (info) {
    return (
      <HotelsListing
        sp={sp}
        page={page}
        citySlug={info.slug}
        cityName={info.name}
        basePath={`/hotels/${info.slug}`}
        title={`Hotels in ${info.name}`}
        intro={`${info.count} ${info.count === 1 ? 'place' : 'places'} to stay in ${info.name}. Choose your dates to see free rooms and the price for your stay.`}
        description={info.description}
      />
    );
  }

  // An old single-segment hotel address.
  const h = await hotelBySlug(city);
  if (h) permanentRedirect(hotelPath(h.slug, h.citySlug) + qs(sp));
  notFound();
}
