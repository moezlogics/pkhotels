import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';
import { getSiteName } from "@/lib/site-settings.server";

// Text edited in Dashboard → Static Pages shows up within 5 minutes (and after a build made while the API was down).
export const revalidate = 300;

/*
 * /terms — the text is edited in Dashboard → Static Pages (slug "terms"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return pageMetadata('terms', {
    title: `Terms of Service — ${site}`,
    description: `The terms for booking hotels on ${site}, and for hotels that list on it.`,
    path: '/terms',
  });
}

export default function TermsPage() {
  return (
    <StaticPageView
      slug="terms"
      title="Terms of Service"
      fallback={
        <div className="mt-4 space-y-5 text-[16px] leading-relaxed text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">1. What PakHotels is</h2>
            <p className="mt-1">PakHotels is an online platform that connects guests with hotels. The stay is a contract between the guest and the hotel. PakHotels does not take payment for stays, does not hold guests&apos; money and is not a party to that contract.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">2. Bookings</h2>
            <p className="mt-1">A booking request is confirmed when the hotel accepts it (or immediately, for hotels with instant confirmation). Prices are for the room type, dates and guests chosen, in Pakistani rupees, and include taxes unless stated. Please give a mobile number you can be reached on; hotels may decline bookings they cannot verify.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">3. Payment and advances</h2>
            <p className="mt-1">You pay the hotel directly at check-in. Where a hotel asks for an advance, you send it to the hotel&apos;s own account shown on your booking page; refunds of advances are between you and the hotel under its cancellation policy.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">4. Check-in rules</h2>
            <p className="mt-1">Hotels in Pakistan require an original CNIC (or passport) for every adult. Each hotel&apos;s couples and family policy, check-in and check-out times and house rules are shown on its page and apply to your stay. A hotel may refuse check-in if its rules are not met.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">5. Cancellations and no-shows</h2>
            <p className="mt-1">You can cancel from your booking page. Each room shows its cancellation policy before you book. Repeated no-shows may lead to future bookings being declined.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">6. Reviews</h2>
            <p className="mt-1">Only guests with a completed booking can review. Reviews must be honest and about the stay; we may remove reviews that are abusive, off-topic or contain personal information.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-neutral-900">7. Hotels</h2>
            <p className="mt-1">Hotels are responsible for the accuracy of their prices, photos, rooms and policies, and for honouring confirmed bookings. Paid plans are billed in advance and are non-refundable once active. Where a hotel’s plan carries a commission, it applies to bookings made through PakHotels that are completed (not to cancellations or genuine no-shows) and is invoiced at the start of each month, payable by the due date shown on the invoice; online booking may be paused while an invoice is long overdue. Boosts start when their payment is verified and run for the days bought.</p>
          </section>
          <p>Questions? See our <a href="/contact" className="text-ink hover:underline">contact page</a>.</p>
        </div>
      }
    />
  );
}
