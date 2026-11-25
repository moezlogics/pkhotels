import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import HotelsListing from '@/components/hotel/HotelsListing';
import { BadgeCheck, Baby, CalendarCheck, CalendarX, Cigarette, Clock, CreditCard, Globe2, IdCard, Languages, MapPin, MessageCircle, PawPrint, Phone, Plane, ShieldCheck, Star, Users, Zap } from 'lucide-react';
import HotelGallery from '@/components/hotel/HotelGallery';
import HotelCard, { Stars } from '@/components/hotel/HotelCard';
import WishlistButton from '@/components/hotel/WishlistButton';
import { ClaimButton, HotelMapLazy, ShareButton, ViewPing } from '@/components/hotel/HotelExtras';
import { BookingProvider, RoomsSection, SideBookCard, StickyBookBar } from '@/components/hotel/booking/BookingFlow';
import { ReadMore, RecordView, SectionTabs, ShowAll } from '@/components/hotel/HotelPageBits';
import ReviewComposer from '@/components/hotel/HotelReviews';
import { countryName, flag } from '@/lib/countries';
import { AMENITIES, AMENITY_GROUPS, amenity } from '@/lib/hotel-amenities';
import { COUPLE_POLICIES, LANGUAGE_LABELS, cityPath, fmtTime, hotelPath, hotelSeoDescription, hotelSeoTitle, isSegment, SEGMENTS, pkr, ratingWord, readStay, typeLabel, waLink } from '@/lib/hotels';
import { cityInfo, hotelBySlug, hotelReviews, similarHotels } from '@/lib/hotels-server';

type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ city: string; slug: string }>; searchParams: Promise<SP> };

const FILTERS = ['q', 'type', 'stars', 'amenities', 'minPrice', 'maxPrice', 'couples', 'foreigners', 'minRating', 'sort', 'checkIn', 'page'];
function qs(sp: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const revalidate = 300;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk';
const abs = (u: string) => (u?.startsWith('http') ? u : `${SITE}${u || ''}`);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city, slug } = await params;
  if (isSegment(slug)) {
    const info = await cityInfo(city);
    if (!info) return { title: 'Hotels | PakHotels', robots: { index: false } };
    const sp = await searchParams;
    const seg = SEGMENTS[slug]!;
    const title = `${seg.h1(info.name)} — Compare Prices & Book | PakHotels`;
    const description = `${seg.h1(info.name)}: compare real room prices per night, photos and verified guest reviews, and book online in a minute.`;
    return {
      title,
      description,
      alternates: { canonical: `/hotels/${info.slug}/${slug}` },
      openGraph: { title, description, url: `/hotels/${info.slug}/${slug}` },
      ...(FILTERS.some((k) => sp[k]) ? { robots: { index: false, follow: true } } : {}),
    };
  }
  const h = await hotelBySlug(slug);
  if (!h) return { title: 'Hotel not found | PakHotels', robots: { index: false } };
  const title = hotelSeoTitle(h);
  const description = hotelSeoDescription(h);
  return {
    title,
    description,
    alternates: { canonical: hotelPath(h.slug, h.citySlug) },
    openGraph: { type: 'website', siteName: 'PakHotels', locale: 'en_PK', title, description, url: hotelPath(h.slug, h.citySlug), images: h.coverImage ? [{ url: abs(h.coverImage), width: 1200, height: 630, alt: h.name }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: h.coverImage ? [abs(h.coverImage)] : undefined },
  };
}

/* One look for every block on the page: full-width white on phones, a rounded panel on desktop. */
/* Sections sit on one white page, divided by hairlines — no boxes. */
const block = 'border-t border-neutral-200 py-6';

/** "PKR 8,000 – 20,000" from the room prices (schema.org priceRange). */
function priceRange(h: { minPrice: number; rooms: { price: number }[] }) {
  const prices = h.rooms.map((r) => r.price).filter((p) => p > 0);
  const lo = Math.min(...(prices.length ? prices : [h.minPrice || 0]));
  const hi = Math.max(...(prices.length ? prices : [h.minPrice || 0]));
  if (!lo) return undefined;
  const f = (n: number) => n.toLocaleString('en-PK');
  return hi > lo ? `PKR ${f(lo)} – ${f(hi)}` : `PKR ${f(lo)}`;
}
const h2 = 'text-[24px] font-bold text-ink md:text-[28px]';

export default async function HotelOrSegment({ params, searchParams }: Props) {
  const { city, slug } = await params;

  // /hotels/<city>/guest-houses, /hotels/<city>/5-star …
  if (isSegment(slug)) {
    const info = await cityInfo(city);
    if (!info) notFound();
    const sp = await searchParams;
    const seg = SEGMENTS[slug]!;
    return (
      <HotelsListing
        sp={{ ...sp, ...(seg.type ? { type: seg.type } : {}), ...(seg.stars ? { stars: seg.stars } : {}) }}
        page={Math.max(1, Number(sp.page) || 1)}
        citySlug={info.slug}
        cityName={info.name}
        segment={slug}
        basePath={`/hotels/${info.slug}/${slug}`}
        title={seg.h1(info.name)}
        intro={`Real prices per night in ${info.name}. Choose your dates to see free rooms.`}
      />
    );
  }

  // Old /hotels/<hotel>/book/ links.
  if (slug === 'book') {
    const old = await hotelBySlug(city);
    if (!old) notFound();
    const sp = await searchParams;
    redirect(`${hotelPath(old.slug, old.citySlug)}/book${qs(sp)}`);
  }

  const h = await hotelBySlug(slug);
  if (!h) notFound();
  if (h.citySlug && h.citySlug !== city) permanentRedirect(hotelPath(h.slug, h.citySlug) + qs(await searchParams));
  return <HotelPage h={h} searchParams={searchParams} />;
}

async function HotelPage({ h, searchParams }: { h: NonNullable<Awaited<ReturnType<typeof hotelBySlug>>>; searchParams: Promise<SP> }) {
  const [reviews, similar, sp] = await Promise.all([hotelReviews(h._id), similarHotels(h.slug), searchParams]);
  const stay = readStay(sp);
  const images = [h.coverImage, ...h.gallery].filter((x, i, a) => x && a.indexOf(x) === i);
  const has = new Set(h.amenities);
  const groups = (Object.keys(AMENITY_GROUPS) as (keyof typeof AMENITY_GROUPS)[])
    .map((g) => ({ g, items: AMENITIES.filter((a) => a.group === g && has.has(a.key)) }))
    .filter((x) => x.items.length);
  const highlights = h.amenities.map(amenity).filter(Boolean);
  const couple = COUPLE_POLICIES[h.couplePolicy || 'not_stated'];
  const located = typeof h.lat === 'number' && typeof h.lng === 'number';
  const wa = h.contact?.whatsapp;
  const rs = h.reviewStats;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rooms', label: 'Rooms' },
    ...(groups.length ? [{ id: 'facilities', label: 'Facilities' }] : []),
    { id: 'rules', label: 'House rules' },
    ...(located || h.nearby.length || h.airportName ? [{ id: 'location', label: 'Location' }] : []),
    { id: 'reviews', label: 'Reviews' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': h.propertyType === 'guest_house' ? 'BedAndBreakfast' : h.propertyType === 'resort' ? 'Resort' : 'Hotel',
    '@id': `${abs(hotelPath(h.slug, h.citySlug))}#hotel`,
    name: h.name,
    url: abs(hotelPath(h.slug, h.citySlug)),
    description: h.shortDescription || hotelSeoDescription(h),
    image: images.slice(0, 8).map(abs),
    address: { '@type': 'PostalAddress', streetAddress: h.address, addressLocality: h.cityName, addressCountry: 'PK' },
    ...(located ? { geo: { '@type': 'GeoCoordinates', latitude: h.lat, longitude: h.lng }, hasMap: `https://www.google.com/maps?q=${h.lat},${h.lng}` } : {}),
    ...(h.contact?.phone ? { telephone: h.contact.phone } : {}),
    petsAllowed: !!h.petsAllowed,
    ...(h.stars ? { starRating: { '@type': 'Rating', ratingValue: h.stars } } : {}),
    checkinTime: h.checkInTime,
    checkoutTime: h.checkOutTime,
    priceRange: priceRange(h),
    currenciesAccepted: 'PKR',
    amenityFeature: highlights.slice(0, 12).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a!.label, value: true })),
    ...(reviews.items.length ? { review: reviews.items.slice(0, 5).map((r: any) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.guestName }, datePublished: String(r.createdAt).slice(0, 10), reviewBody: r.text || r.title, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 } })) } : {}),
    ...(rs.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rs.avg, reviewCount: rs.count, bestRating: 5 } } : {}),
    makesOffer: h.rooms.slice(0, 10).map((r) => ({
      '@type': 'Offer',
      name: r.name,
      priceCurrency: 'PKR',
      price: r.price,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: r.price, priceCurrency: 'PKR', unitText: 'night' },
      itemOffered: { '@type': 'HotelRoom', name: r.name, occupancy: { '@type': 'QuantitativeValue', maxValue: r.maxAdults + r.maxChildren } },
    })),
  };
  const faqLd = h.faqs.length
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: h.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    : null;

  const rules = [
    { icon: CalendarCheck, k: 'Check-in', v: `From ${fmtTime(h.checkInTime)} (Pakistan time)` },
    { icon: CalendarX, k: 'Check-out', v: `Until ${fmtTime(h.checkOutTime)} (Pakistan time)` },
    ...(h.idRequired ? [{ icon: IdCard, k: 'ID', v: 'Pakistanis: original CNIC or NICOP. Foreign nationals: passport with a valid Pakistan visa.' }] : []),
    {
      icon: Globe2,
      k: 'Foreign guests',
      v: h.acceptsForeigners === 'yes'
        ? `Welcome${h.foreignerRegistration ? ' — the hotel handles your police registration' : ''}`
        : h.acceptsForeigners === 'no'
          ? 'Not able to host foreign passport holders'
          : 'Not stated — please confirm with the hotel before booking',
    },
    ...(h.languages?.length ? [{ icon: Languages, k: 'Staff speak', v: h.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(', ') }] : []),
    ...(couple?.label ? [{ icon: Users, k: 'Couples', v: couple.label }] : []),
    { icon: Baby, k: 'Children', v: h.childrenAllowed ? `Welcome${h.extraBedPrice ? `. Extra mattress ${pkr(h.extraBedPrice)} a night` : ''}` : 'Not suitable for children' },
    { icon: ShieldCheck, k: 'Cancellation', v: 'Cancel online any time before the hotel confirms. After it confirms, changes go through the hotel.' },
    { icon: CreditCard, k: 'Payment', v: `At the hotel${h.advanceMode !== 'none' ? `, or ${h.advancePercent}% advance to the hotel's own account` : ''}${!h.taxIncluded && h.taxPercent ? `. Prices exclude ${h.taxPercent}% tax` : ''}` },
    { icon: PawPrint, k: 'Pets', v: h.petsAllowed ? 'Allowed on request' : 'Not allowed' },
    { icon: Cigarette, k: 'Smoking', v: h.smokingAllowed ? 'In designated areas' : 'Non-smoking property' },
  ];

  return (
    <BookingProvider hotel={h} initial={stay}>
      <main className="bg-white pb-28 lg:pb-10">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
                { '@type': 'ListItem', position: 2, name: 'Hotels', item: abs('/hotels') },
                { '@type': 'ListItem', position: 3, name: `Hotels in ${h.cityName}`, item: abs(cityPath(h.citySlug)) },
                { '@type': 'ListItem', position: 4, name: h.name, item: abs(hotelPath(h.slug, h.citySlug)) },
              ],
            }),
          }}
        />
        <ViewPing id={h._id} />
        <RecordView hotel={{ slug: h.slug, name: h.name, cityName: h.cityName, citySlug: h.citySlug, coverImage: h.coverImage, minPrice: h.minPrice, ratingAvg: h.ratingAvg, ratingCount: h.ratingCount }} />

        <div className="container container-flush mx-auto px-0 md:px-4 md:pt-4">
          <nav aria-label="Breadcrumb" className="mb-3 hidden items-center gap-1.5 text-[14px] text-neutral-500 md:flex">
            <Link href="/" className="hover:text-ink">Home</Link>/<Link href="/hotels" className="hover:text-ink">Hotels</Link>/
            <Link href={cityPath(h.citySlug)} className="hover:text-ink">{h.cityName}</Link>/<span className="truncate text-ink">{h.name}</span>
          </nav>
          <div className="overflow-hidden md:rounded-[20px]">
            <HotelGallery mosaic images={images} title={h.name} videoUrl={h.videoUrl || null} featured={h.featured} badge={h.deal ? `${h.deal.percent}% off` : undefined} />
          </div>
        </div>

        {/* Title — on phones it sits on a sheet pulled up over the photos */}
        <div className="relative z-10 bg-white md:bg-transparent">
          <div className="container mx-auto px-4 pb-4 pt-5 md:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[14px] text-neutral-500">
                  {typeLabel(h.propertyType)} <Stars n={h.stars} />
                  {h.verified && <span className="inline-flex items-center gap-1 font-semibold text-ink"><BadgeCheck className="h-4 w-4" /> Verified</span>}
                </p>
                <h1 className="mt-1 text-[30px] font-bold leading-[1.04] text-ink md:text-[44px]">{h.name}</h1>
                <a href={located ? '#location' : undefined} className="mt-1.5 flex items-start gap-1.5 text-[15px] text-neutral-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="line-clamp-2">{h.address || [h.areaName, h.cityName].filter(Boolean).join(', ')}</span>
                </a>
              </div>
              <div className="hidden shrink-0 gap-2 md:flex">
                <WishlistButton slug={h.slug} label />
                <ShareButton title={h.name} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {rs.count > 0 ? (
                <a href="#reviews" className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-ink tabular">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {rs.avg.toFixed(1)}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{ratingWord(rs.avg)}</span>
                  <span className="text-[14px] text-neutral-500">{rs.count} review{rs.count === 1 ? '' : 's'}</span>
                </a>
              ) : (
                <span className="text-[14px] text-neutral-500">New on PakHotels</span>
              )}
              {h.instantConfirm && <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink"><Zap className="h-4 w-4" /> Instant confirmation</span>}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 md:max-w-xl">
              <div className="rounded-[18px] bg-[#f7f5fc] px-2 py-3 text-center">
                <CreditCard className="mx-auto h-5 w-5 text-ink" strokeWidth={1.6} />
                <p className="mt-1 text-[13.5px] font-semibold leading-tight text-ink">Pay at hotel</p>
              </div>
              {h.acceptsForeigners === 'yes' ? (
                <div className="rounded-[18px] bg-[#f7f5fc] px-2 py-3 text-center">
                  <Globe2 className="mx-auto h-5 w-5 text-primary" strokeWidth={1.6} />
                  <p className="mt-1 text-[13.5px] font-semibold leading-tight text-ink">Welcomes foreign guests</p>
                </div>
              ) : (
                <div className="rounded-[18px] bg-[#f7f5fc] px-2 py-3 text-center">
                  <MessageCircle className="mx-auto h-5 w-5 text-ink" strokeWidth={1.6} />
                  <p className="mt-1 text-[13.5px] font-semibold leading-tight text-ink">WhatsApp the hotel</p>
                </div>
              )}
              <div className="rounded-[18px] bg-[#f7f5fc] px-2 py-3 text-center">
                <Clock className="mx-auto h-5 w-5 text-ink" strokeWidth={1.6} />
                <p className="mt-1 text-[13.5px] font-semibold leading-tight text-ink">{h.instantConfirm ? 'Instant' : `Reply in ${h.responseHours}h`}</p>
              </div>
            </div>
          </div>
        </div>

        <SectionTabs tabs={tabs} />

        <div className="container mx-auto grid gap-0 px-0 md:px-4 lg:grid-cols-[1fr_360px] lg:gap-14">
          <div className="min-w-0">
            <section id="overview" className={`${block} scroll-mt-28`}>
              {highlights.length > 0 && (
                <>
                  <h2 className={h2}>Most popular facilities</h2>
                  <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    {highlights.slice(0, 6).map((a) => {
                      const Icon = a!.icon;
                      return (
                        <li key={a!.key} className="flex items-center gap-2.5 text-[15px] text-neutral-700">
                          <Icon className="h-[18px] w-[18px] shrink-0 text-ink" /> {a!.label}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              {h.description && (
                <div className={highlights.length ? 'mt-6 border-t border-neutral-100 pt-5' : ''}>
                  <h2 className={h2}>About this place</h2>
                  <div className="mt-3">
                    <ReadMore html={h.description} />
                  </div>
                </div>
              )}
            </section>

            <div className={block}>
              <RoomsSection />
            </div>

            {groups.length > 0 && (
              <section id="facilities" className={`${block} scroll-mt-28`}>
                <h2 className={h2}>Facilities</h2>
                <ShowAll
                  count={groups.length > 2 ? highlights.length : 0}
                  initial={
                    <div className="mt-4 grid gap-6 sm:grid-cols-2">
                      {groups.slice(0, 2).map(({ g, items }) => (
                        <div key={g}>
                          <h3 className="text-[16px] font-semibold text-ink">{AMENITY_GROUPS[g]}</h3>
                          <ul className="mt-2 space-y-2">{items.map((a) => <li key={a.key} className="flex items-center gap-2.5 text-[15px] text-neutral-700"><a.icon className="h-4 w-4 text-neutral-500" /> {a.label}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    {groups.map(({ g, items }) => (
                      <div key={g}>
                        <h3 className="text-[16px] font-semibold text-ink">{AMENITY_GROUPS[g]}</h3>
                        <ul className="mt-2 space-y-2">{items.map((a) => <li key={a.key} className="flex items-center gap-2.5 text-[15px] text-neutral-700"><a.icon className="h-4 w-4 text-neutral-500" /> {a.label}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                </ShowAll>
              </section>
            )}

            <section id="rules" className={`${block} scroll-mt-28`}>
              <h2 className={h2}>House rules</h2>
              <dl className="mt-3 divide-y divide-neutral-100">
                {rules.map((r) => (
                  <div key={r.k} className="flex gap-3 py-3">
                    <r.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neutral-500" />
                    <div className="min-w-0 sm:grid sm:flex-1 sm:grid-cols-[130px_1fr] sm:gap-3">
                      <dt className="text-[15px] font-semibold text-ink">{r.k}</dt>
                      <dd className="text-[15px] text-neutral-600">{r.v}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              {h.policies && (
                <details className="mt-2 rounded-2xl bg-surface p-4 text-[15px]">
                  <summary className="cursor-pointer font-semibold text-ink">Full terms from the hotel</summary>
                  <div className="prose prose-sm prose-slate mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: h.policies }} />
                </details>
              )}
            </section>

            {(located || h.nearby.length > 0 || !!h.airportName) && (
              <section id="location" className={`${block} scroll-mt-28`}>
                <h2 className={h2}>Location</h2>
                <p className="mt-1 text-[15px] text-neutral-600">{h.address}</p>
                {(h.airportName || h.airportPickup) && (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-accent p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white"><Plane className="h-5 w-5" /></span>
                    <div className="text-[15px]">
                      <p className="font-semibold text-ink">
                        {h.airportName ? `${h.airportName}${h.airportKm ? ` · ${h.airportKm} km` : ''}` : 'Airport'}
                      </p>
                      <p className="text-neutral-600">
                        {h.airportPickup
                          ? `Airport pickup available${h.airportPickupPrice ? ` — ${pkr(h.airportPickupPrice)} per trip` : ' — free'}. Add your flight in the booking request.`
                          : 'No airport pickup — take a ride-hailing app or a taxi from the airport.'}
                      </p>
                    </div>
                  </div>
                )}
                {located && (
                  <div className="mt-4 overflow-hidden rounded-2xl">
                    <HotelMapLazy latitude={h.lat!} longitude={h.lng!} title={h.name} />
                  </div>
                )}
                {h.nearby.length > 0 && (
                  <ul className="mt-4 divide-y divide-neutral-100">
                    {h.nearby.map((n) => (
                      <li key={n.title} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                        <span className="text-neutral-700">{n.title}</span>
                        <span className="shrink-0 text-neutral-500 tabular">{n.distance}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section id="reviews" className={`${block} scroll-mt-28`}>
              <h2 className={h2}>Guest reviews</h2>
              {rs.count ? (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="font-display grid h-16 w-16 place-items-center rounded-full bg-highlight text-[24px] font-bold text-ink tabular">{rs.avg.toFixed(1)}</span>
                    <div>
                      <p className="text-[18px] font-semibold text-ink">{ratingWord(rs.avg)}</p>
                      <p className="text-[14px] text-neutral-500">From {rs.count} review{rs.count === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                    {(['cleanliness', 'staff', 'location', 'value'] as const).map((k) =>
                      rs[k] ? (
                        <div key={k} className="text-[14px]">
                          <div className="flex justify-between"><span className="capitalize text-neutral-600">{k === 'value' ? 'Value for money' : k}</span><span className="font-semibold tabular">{rs[k].toFixed(1)}</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-primary" style={{ width: `${(rs[k] / 5) * 100}%` }} /></div>
                        </div>
                      ) : null,
                    )}
                  </div>
                  <ul className="no-scrollbar -mx-4 mt-5 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:px-0">
                    {reviews.items.map((r: any) => (
                      <li key={r._id} className="w-[82%] shrink-0 snap-start rounded-2xl border border-neutral-200 p-4 md:w-auto">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-[15px] font-semibold text-ink">{r.guestName?.[0]}</span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
                              {r.guestName}
                              {r.verified && <span className="inline-flex items-center gap-0.5 rounded-full bg-highlight px-2 py-0.5 text-[11.5px] font-semibold text-ink"><BadgeCheck className="h-3 w-3" />Stayed here</span>}
                            </p>
                            <p className="text-[13px] text-neutral-500">{r.country ? `${flag(r.country)} ${countryName(r.country)} · ` : ''}{new Date((r.stayMonth ? r.stayMonth + '-01' : r.createdAt)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}{r.tripType ? ` · ${r.tripType === 'couple' ? 'Couple' : r.tripType.charAt(0).toUpperCase() + r.tripType.slice(1)} trip` : ''}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[15px] font-semibold"><Star className="h-4 w-4 fill-gold text-gold" />{r.rating}</span>
                        </div>
                        {r.title && <p className="mt-3 text-[15px] font-semibold text-ink">{r.title}</p>}
                        {r.text && <p className="mt-1 line-clamp-5 whitespace-pre-line text-[15px] text-neutral-600">{r.text}</p>}
                        {r.reply && <p className="mt-3 rounded-lg bg-surface p-2.5 text-[14px] text-neutral-600"><span className="font-semibold text-ink">Hotel replied: </span>{r.reply}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-[15px] text-neutral-500">No reviews yet — be the first to rate {h.name}.</p>
              )}
              <Suspense fallback={null}>
                <ReviewComposer hotelId={h._id} hotelName={h.name} />
              </Suspense>
            </section>

            {h.faqs.length > 0 && (
              <section className={block}>
                <h2 className={h2}>Questions guests ask</h2>
                <div className="mt-2 divide-y divide-neutral-100">
                  {h.faqs.map((f) => (
                    <details key={f.q} className="group py-3.5">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[16px] font-semibold text-ink">
                        {f.q}
                        <span className="mt-0.5 text-[22px] leading-none text-neutral-400 transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-[15px] text-neutral-600">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {h.contact && (h.contact.phone || wa) && (
              <section className={`${block} lg:hidden`}>
                <h2 className={h2}>Talk to the hotel</h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {h.contact.phone && <a href={`tel:${h.contact.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-full border border-neutral-300 text-[16px] font-semibold text-ink"><Phone className="h-4 w-4" /> Call</a>}
                  {wa && <a href={waLink(wa, `Assalam o Alaikum, I found ${h.name} on PakHotels.pk and want to ask about rooms.`)} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-full border border-ink text-[16px] font-semibold text-ink"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
                </div>
              </section>
            )}

            {!h.claimed && (
              <div className="pb-6">
                <ClaimButton hotelId={h._id} hotelName={h.name} slug={h.slug} />
              </div>
            )}
          </div>

          <aside className="hidden space-y-4 lg:sticky lg:top-[7.5rem] lg:mt-6 lg:block lg:self-start">
            <SideBookCard />
            {h.contact && (h.contact.phone || wa) && (
              <div className="grid grid-cols-2 gap-2">
                {h.contact.phone && <a href={`tel:${h.contact.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white text-sm font-semibold text-ink"><Phone className="h-4 w-4" /> Call</a>}
                {wa && <a href={waLink(wa, `Assalam o Alaikum, I found ${h.name} on PakHotels.pk and want to ask about rooms.`)} target="_blank" rel="noopener" className="flex h-11 items-center justify-center gap-2 rounded-full border border-ink text-sm font-semibold text-ink"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
              </div>
            )}
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="container mx-auto mt-6 px-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className={h2}>More stays in {h.cityName}</h2>
              <Link href={cityPath(h.citySlug)} className="text-[15px] font-semibold text-ink">See all</Link>
            </div>
            <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
              {similar.map((s) => (
                <div key={s._id} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto">
                  <HotelCard hotel={s} />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <StickyBookBar />
    </BookingProvider>
  );
}
