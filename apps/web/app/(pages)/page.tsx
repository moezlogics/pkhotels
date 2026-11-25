import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Baby, BadgeDollarSign, Briefcase, Car, Check, Coffee, Heart, MessageCircle, Plus, ShieldCheck, Star, Waves, Zap } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import BlogSection from '@/components/BlogSection';
import HotelCard from '@/components/hotel/HotelCard';
import StaySearch from '@/components/hotel/StaySearch';
import { RecentlyViewed } from '@/components/hotel/HomeBits';
import { AdZone } from '@/components/ads/AdSlot';
import { photo } from '@/lib/img';
import { cityPath, type HotelCardData, SEGMENTS, segmentPath } from '@/lib/hotels';
import { featuredHotels, hotelCities, searchHotels } from '@/lib/hotels-server';
import { serverApi } from '@/lib/server-api';
import { transformBlogsToPosts } from '@/lib/utils/blog-utils';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'PakHotels — Book Hotels in Pakistan Online at Real Prices',
  description:
    'Book hotels in Lahore, Islamabad, Karachi, Murree, Multan and across Pakistan. Compare real room prices per night, photos and verified guest reviews, and reserve in a minute.',
  alternates: { canonical: '/' },
  openGraph: { title: 'PakHotels — Book Hotels in Pakistan Online at Real Prices', description: 'Book hotels in Lahore, Islamabad, Karachi, Murree, Multan and across Pakistan. Compare real room prices per night, photos and verified guest reviews, and reserve in a minute.', url: '/' },
};

/** Ways people actually choose a hotel here — each is a saved search. */
const TRIP_TYPES = [
  { label: 'Family stays', href: '/hotels?amenities=family_rooms', icon: Baby },
  { label: 'Couple friendly', href: '/hotels?couples=1', icon: Heart },
  { label: 'Under Rs 6,000', href: '/hotels?maxPrice=6000&sort=price_asc', icon: BadgeDollarSign },
  { label: 'Business trips', href: '/hotels?amenities=wifi', icon: Briefcase },
  { label: 'Breakfast', href: '/hotels?amenities=breakfast', icon: Coffee },
  { label: 'Pool', href: '/hotels?amenities=pool', icon: Waves },
  { label: 'Parking', href: '/hotels?amenities=parking', icon: Car },
  { label: 'Power backup', href: '/hotels?amenities=generator', icon: Zap },
];

const FAQ = [
  { q: 'Do I need a credit card to book?', a: 'No. You pay at the hotel when you check in. A few hotels ask for a small advance, which you send straight to the hotel’s own JazzCash, Easypaisa or bank account. PakHotels never holds your money.' },
  { q: 'Why do I need an account?', a: 'Your booking, the hotel’s reply and your receipt live in your account, so you can find, change or cancel a booking from any phone. It takes a few seconds and you can use Google.' },
  { q: 'How do I know my booking is confirmed?', a: 'You see it in My trips straight away. Some hotels confirm instantly; the rest within a few hours. You can WhatsApp the hotel from your booking too.' },
  { q: 'Can couples stay? What should I bring?', a: 'Each hotel shows its rule: families only, couples with nikah nama, or couple friendly. Every hotel asks for an original CNIC for each adult at check-in, or a passport for foreigners.' },
  { q: 'Can I cancel?', a: 'Yes, from My trips. Each hotel’s cancellation rule is shown on its page and again before you book.' },
  { q: 'Are the reviews real?', a: 'Only guests who booked through PakHotels and stayed can write a review.' },
];

function Rail({ title, eyebrow, href, hotels, first }: { title: ReactNode; eyebrow: string; href: string; hotels: HotelCardData[]; first?: boolean }) {
  if (!hotels.length) return null;
  return (
    <section className="container mx-auto px-4 pt-12 md:pt-16">
      <SectionHeading eyebrow={eyebrow} title={title} href={href} />
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:px-0">
        {hotels.slice(0, 8).map((h, i) => (
          <div key={h._id} className="w-[74%] shrink-0 snap-start sm:w-[42%] lg:w-auto">
            <HotelCard hotel={h} priority={first && i < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}

const BUDGETS = [
  { label: 'Under 5k', note: 'Budget', href: '/hotels?maxPrice=5000&sort=price_asc' },
  { label: '5k – 10k', note: 'Mid-range', href: '/hotels?minPrice=5000&maxPrice=10000' },
  { label: '10k – 20k', note: 'Comfort', href: '/hotels?minPrice=10000&maxPrice=20000' },
  { label: '20k +', note: 'Luxury', href: '/hotels?minPrice=20000&sort=price_desc' },
];

const STEPS = [
  { n: '01', t: 'Pick a room', d: 'Real photos, the price per night and every rule up front: couples, ID, cancellation.' },
  { n: '02', t: 'Reserve in a minute', d: 'Sign in with Google or your mobile number. No card, no advance for most hotels.' },
  { n: '03', t: 'Pay at the hotel', d: 'Show your booking at the front desk and pay there, in cash or however the hotel accepts.' },
];

export default async function Home() {
  const [cities, featured, blogs] = await Promise.all([hotelCities(), featuredHotels(8), serverApi.getPublishedBlogs().catch(() => [])]);
  const top = cities.slice(0, 2);
  const [cityA, cityB, budget] = await Promise.all([
    top[0] ? searchHotels({ city: top[0].slug, limit: 8 }) : null,
    top[1] ? searchHotels({ city: top[1].slug, limit: 8 }) : null,
    searchHotels({ maxPrice: 8000, minPrice: 1500, sort: 'price_desc', limit: 8 }),
  ]);
  const posts = transformBlogsToPosts((blogs as any[]).slice(0, 4));
  const total = cities.reduce((n, c) => n + c.count, 0);
  const shots = featured.map((h) => h.coverImage || h.gallery?.[0]).filter(Boolean).slice(0, 3) as string[];

  return (
    <main className="pb-6">
      {/* ── Hero ── */}
      <section className="container mx-auto px-4 pt-6 md:pt-14">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
          <div className="rise">
            <h1 className="text-[42px] font-bold leading-[0.98] text-ink sm:text-[54px] md:text-[72px]">
              Hotels across Pakistan, <span className="mark">book in a minute.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-neutral-600 md:text-[19px]">
              Real room prices, reviews from real stays and a WhatsApp line to every front desk. No card needed.
            </p>
          </div>

          {shots.length >= 3 && (
            <div className="relative hidden h-[440px] md:block" aria-hidden>
              <div className="absolute left-0 top-0 h-[300px] w-[58%] overflow-hidden rounded-[32px] bg-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(shots[0], 828)} alt="" className="h-full w-full object-cover" fetchPriority="high" />
              </div>
              <div className="absolute right-0 top-10 h-[200px] w-[38%] overflow-hidden rounded-[28px] bg-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(shots[1], 640)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-[6%] h-[210px] w-[52%] overflow-hidden rounded-[28px] bg-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(shots[2], 640)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-10 left-[4%] flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-[0_20px_40px_-20px_rgba(14,14,16,0.45)] ring-1 ring-[color:var(--border)]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary"><Check className="h-5 w-5 text-white" strokeWidth={3} /></span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">Booking confirmed</span>
                  <span className="block text-[13.5px] text-neutral-500">Pay at check-in</span>
                </span>
              </div>
              <div className="absolute right-[2%] top-[230px] rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white">
                <Star className="mr-1 inline h-3.5 w-3.5 -translate-y-px fill-primary text-primary" /> Real reviews
              </div>
            </div>
          )}
        </div>

        <StaySearch className="mt-6 md:mt-10" cities={cities.map((c) => ({ slug: c.slug, name: c.name, count: c.count }))} />

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {shots.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {shots.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={photo(src, 96)} alt="" className="h-10 w-10 rounded-full object-cover ring-[3px] ring-[#f7f5fc]" />
                ))}
              </div>
              <p className="text-[15px] leading-tight text-neutral-600"><b className="font-display text-[18px] font-bold text-ink">{total}+</b> hotels<br />in {cities.length} cities</p>
            </div>
          )}
          <p className="flex items-center gap-2 text-[15px] text-neutral-600"><span className="grid h-8 w-8 place-items-center rounded-full bg-white ring-1 ring-[color:var(--border)]"><ShieldCheck className="h-4 w-4 text-ink" /></span> No card needed</p>
          <p className="hidden items-center gap-2 text-[15px] text-neutral-600 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-white ring-1 ring-[color:var(--border)]"><MessageCircle className="h-4 w-4 text-ink" /></span> WhatsApp the hotel</p>
        </div>
      </section>

      {/* ── Cities: round, joined by a dotted line ── */}
      {cities.length > 0 && (
        <section className="container mx-auto px-4 pt-12 md:pt-16">
          <SectionHeading eyebrow="Destinations" title={<>Where to <span className="mark">next?</span></>} href="/hotels" hrefLabel="All hotels" />
          <ul className="dot-rail no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:justify-start md:gap-10 md:px-0">
            {cities.slice(0, 10).map((c) => (
              <li key={c.slug} className="relative z-[1] shrink-0">
                <Link href={cityPath(c.slug)} className="group flex w-[92px] flex-col items-center text-center md:w-[132px]">
                  <span className="relative rounded-full bg-[#f7f5fc] p-1.5">
                    <span className="block h-[72px] w-[72px] overflow-hidden rounded-full bg-neutral-200 ring-1 ring-[color:var(--border)] transition group-hover:ring-[3px] group-hover:ring-primary md:h-[104px] md:w-[104px]">
                      {c.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo(c.thumbnail, 256)} alt={`Hotels in ${c.name}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      )}
                    </span>
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[11.5px] font-semibold text-white tabular">{c.count}</span>
                  </span>
                  <span className="mt-1.5 text-[15.5px] font-semibold text-ink md:text-[17px]">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Trip types: pills ── */}
      <nav aria-label="Browse by trip" className="container mx-auto px-4 pt-10">
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {TRIP_TYPES.map((t) => (
            <li key={t.label} className="shrink-0">
              <Link href={t.href} className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white py-1.5 pl-1.5 pr-4 text-[15px] font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-white">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white"><t.icon className="h-4 w-4" strokeWidth={2} /></span>
                <span className="whitespace-nowrap">{t.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <RecentlyViewed />
      <Rail eyebrow="Top rated" title={<>Guests&rsquo; <span className="mark">favourites</span></>} href="/hotels" hotels={featured} first />
      <AdZone page="home" at="after-hero" wrap="container mx-auto px-4 pt-6" />
      {top[0] && <Rail eyebrow={`${top[0].count} hotels`} title={<>Stay in <span className="mark">{top[0].name}</span></>} href={cityPath(top[0].slug)} hotels={cityA?.items ?? []} />}

      {/* ── Browse by budget and kind: the dark block ── */}
      <section className="container mx-auto px-4 pt-14 md:pt-20">
        <div className="grain overflow-hidden rounded-[32px] bg-ink p-5 text-white md:rounded-[44px] md:p-12">
          <SectionHeading dark eyebrow="Your budget" title={<>What do you want to <span className="mark-pill">spend?</span></>} description="Rupees per room, per night. You pay at the hotel." />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
            {BUDGETS.map((b) => (
              <Link key={b.label} href={b.href} className="group rounded-[22px] border border-white/10 bg-white/[0.05] p-4 transition hover:border-primary hover:bg-primary hover:text-white md:p-6">
                <p className="text-[13.5px] font-medium text-white/60 group-hover:text-ink/70">{b.note}</p>
                <p className="font-display mt-1 text-[24px] font-bold leading-tight tracking-tight md:text-[32px]">{b.label}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-primary group-hover:text-ink">
                  See hotels <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-8 text-[15px] font-semibold text-white/70">Or by kind of stay</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(SEGMENTS).map(([key, s]) => (
              <Link key={key} href={segmentPath(key)} className="rounded-full border border-white/20 px-4 py-2 text-[15px] font-medium text-white transition hover:border-primary hover:bg-primary hover:text-white">
                {s.h1('Pakistan').replace(' in Pakistan', '')}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Rail eyebrow="Value stays" title={<>Good rooms <span className="mark">under Rs 8,000</span></>} href="/hotels?maxPrice=8000" hotels={budget?.items ?? []} />

      {/* ── How it works ── */}
      <section className="container mx-auto px-4 pt-14 md:pt-20">
        <SectionHeading eyebrow="How it works" title={<>Three steps to your <span className="mark">room</span></>} />
        <ol className="grid gap-3 md:grid-cols-3 md:gap-5">
          {STEPS.map((s) => (
            <li key={s.n} className="card-soft group p-6 transition duration-300 hover:-translate-y-1 hover:border-ink hover:bg-ink hover:text-white md:p-7">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-display text-[17px] font-bold text-white">{s.n}</span>
                <ArrowUpRight className="h-5 w-5 text-neutral-400 transition group-hover:text-primary" />
              </div>
              <p className="font-display mt-6 text-[22px] font-bold tracking-tight">{s.t}</p>
              <p className="mt-1.5 text-[15.5px] leading-relaxed text-neutral-500 transition group-hover:text-white/65">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {top[1] && <Rail eyebrow={`${top[1].count} hotels`} title={<>Stay in <span className="mark">{top[1].name}</span></>} href={cityPath(top[1].slug)} hotels={cityB?.items ?? []} />}

      {/* ── For hotel owners: the violet block ── */}
      <section className="container mx-auto px-4 pt-14 md:pt-20">
        <div className="relative overflow-hidden grain rounded-[32px] bg-primary p-6 text-white md:rounded-[44px] md:p-14">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[28px] border-white/[0.08] md:h-96 md:w-96 md:border-[44px]" />
          <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <p className="eyebrow eyebrow-light">For hotel owners</p>
              <h2 className="mt-3 text-[34px] font-bold leading-[1.02] md:text-[54px]">More guests. <span className="mark-pill">Pay only</span> when they stay.</h2>
              <p className="mt-3 max-w-xl text-[16.5px] text-white/80">List free and pay only when a guest stays — far less than the 15 to 20% other sites keep, and 0% on Premium. Confirm bookings from your phone.</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link href="/list-your-hotel" className="inline-flex h-[52px] items-center gap-2 rounded-full bg-white px-6 text-[16px] font-semibold text-primary transition hover:bg-white/90">List your hotel <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/packages" className="inline-flex h-[52px] items-center rounded-full border border-white/35 px-6 text-[16px] font-semibold text-white hover:bg-white/10">See plans</Link>
            </div>
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <div className="pt-6">
          <BlogSection initialPosts={posts} />
        </div>
      )}

      {/* ── FAQ ── */}
      <section className="container mx-auto px-4 pt-8 md:pt-12">
        <div className="grid gap-2 md:grid-cols-[1fr_1.6fr] md:gap-12">
          <div>
            <SectionHeading eyebrow="Questions" title={<>Good to <span className="mark">know</span></>} description="Still unsure? WhatsApp us and a person replies." className="md:sticky md:top-24" />
          </div>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-[20px] border border-[color:var(--border)] bg-white px-5 open:border-ink">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f7f5fc] transition group-open:rotate-45 group-open:bg-primary group-open:text-white"><Plus className="h-4 w-4" /></span>
                </summary>
                <p className="-mt-1 pb-4 text-[15.5px] leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }}
        />
      </section>
    </main>
  );
}
