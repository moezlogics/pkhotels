import type { Metadata } from 'next';
import StaticPageView from '@/components/StaticPageView';
import { pageMetadata } from '@/lib/seo/page-seo';
import { getSiteName } from "@/lib/site-settings.server";

// Text edited in Dashboard → Static Pages shows up within 5 minutes (and after a build made while the API was down).
export const revalidate = 300;

/*
 * /privacy-policy — the text is edited in Dashboard → Static Pages (slug "privacy-policy"), as
 * are its Meta Title and Meta Description; the values here are the fallback.
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return pageMetadata('privacy-policy', {
    title: `Privacy Policy — ${site}`,
    description: `How ${site} collects, uses and protects your information when you search hotels, make a booking, create an account or list a hotel.`,
    path: '/privacy-policy',
  });
}

export default function PrivacyPolicyPage() {
  return (
    <StaticPageView
      slug="privacy-policy"
      title="Privacy Policy"
      fallback={<p className="mt-4 text-[16.5px] leading-relaxed text-neutral-700">This page is being updated. For any question, please see our <a href="/contact" className="text-ink hover:underline">contact page</a>.</p>}
    />
  );
}
