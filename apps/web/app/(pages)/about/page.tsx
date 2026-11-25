import Link from 'next/link';
import StaticPageView from '@/components/StaticPageView';
import { getSiteName } from '@/lib/site-settings.server';

/*
 * About. The text is edited in Dashboard → Static Pages (slug "about"); the
 * copy below is shown only until that page exists, so /about is never empty.
 */

export default async function AboutPage() {
  const site = await getSiteName();
  return (
    <StaticPageView
      slug="about"
      title={`About ${site}`}
      fallback={
        <>
          <p className="mt-3 text-[18px] leading-relaxed text-neutral-600">
            {site} is a Pakistani hotel booking site. Guests find hotels, guest houses and resorts with real prices per night,
            reserve a room in a minute and pay at the hotel — no card needed. Hotels list for free.
          </p>
          <div className="mt-6 space-y-8 text-[16px] leading-relaxed text-neutral-700">
            <section>
              <h2 className="text-lg font-semibold text-neutral-900">Why we built it</h2>
              <p className="mt-2">
                Booking a hotel in Pakistan usually means WhatsApp messages, “call for rates” and no idea whether a room is free.
                International booking sites need a card and take 15–20% from hotels, which ends up in the price you pay. We show
                rooms that are actually free for your dates, the price for your stay, and the rules that matter here — CNIC,
                couples and family policy, generator and hot water — before you book.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-neutral-900">How booking works</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-neutral-400">
                <li>Choose your dates and room, enter your name and mobile number.</li>
                <li>The hotel confirms (many confirm instantly); you see it on your booking page.</li>
                <li>Pay at the hotel. Some hotels ask for an advance, sent straight to the hotel&apos;s own account.</li>
                <li>Signed-in guests can review any hotel; reviews from guests who booked here show “Stayed here”.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-neutral-900">For hotels</h2>
              <p className="mt-2">
                List your hotel free and pay only a small share of stays that actually happen — or choose a{' '}
                <Link href="/packages" className="font-medium text-ink hover:underline">monthly plan</Link> with less or no
                commission, plus advances, seasonal prices and featured placement.{' '}
                <Link href="/list-your-hotel" className="font-medium text-ink hover:underline">List your hotel</Link>.
              </p>
            </section>
          </div>
        </>
      }
    />
  );
}
