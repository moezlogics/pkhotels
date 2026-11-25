import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';
import { getSiteName } from "@/lib/site-settings.server";

// Text edited in Dashboard → Static Pages shows up within 5 minutes (and after a build made while the API was down).
export const revalidate = 300;

/*
 * /contact — the text is edited in Dashboard → Static Pages (slug "contact"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return pageMetadata('contact', {
    title: `Contact ${site} — Phone, WhatsApp & Email`,
    description: `Get in touch with ${site} by phone, WhatsApp or email — for help with a booking, listing your hotel, plans and boosts, or to report a problem.`,
    path: '/contact',
  });
}

export default function ContactPage() {
  return (
    <StaticPageView
      slug="contact"
      title="Contact us"
      contactFirst
      fallback={<p className="mt-4 text-[16.5px] leading-relaxed text-neutral-700">We are happy to help — with a booking, listing or claiming your hotel, choosing a plan, or advertising on the site. Call, WhatsApp or email us using the details on this page.</p>}
    />
  );
}
