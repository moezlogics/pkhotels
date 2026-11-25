'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { resolved } from '@/lib/site-settings';

/**
 * Site-wide JSON-LD: the organisation on every page, and on the home page the
 * WebSite with a sitelinks search box that searches hotels.
 */
export default function StructuredData() {
  const pathname = usePathname();
  const r = resolved(useSiteSettings());
  const GA = r.gaId;
  const phone = r.phone.replace(/[^\d+]/g, '');
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk').replace(/\/$/, '') + '/';
  const description = 'PakHotels is a Pakistani hotel booking site: real room prices, verified guest reviews and online bookings across Lahore, Islamabad, Karachi, Murree, Multan and more.';

  const organization = {
    '@type': 'Organization',
    '@id': `${site}#organization`,
    name: 'PakHotels',
    url: site,
    logo: { '@type': 'ImageObject', url: `${site}icon`, width: 512, height: 512 },
    image: `${site}opengraph-image`,
    description,
    email: r.email,
    telephone: phone,
    areaServed: { '@type': 'Country', name: 'Pakistan' },
    contactPoint: { '@type': 'ContactPoint', telephone: phone, contactType: 'customer service', areaServed: 'PK', availableLanguage: ['en', 'ur'] },
    ...(r.socials.length ? { sameAs: r.socials.map(([, url]) => url) } : {}),
  };

  const graph =
    pathname === '/'
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            organization,
            {
              '@type': 'WebSite',
              '@id': `${site}#website`,
              url: site,
              name: 'PakHotels',
              inLanguage: 'en-PK',
              publisher: { '@id': `${site}#organization` },
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: `${site}hotels?q={search_term_string}` },
                'query-input': 'required name=search_term_string',
              },
            },
          ],
        }
      : { '@context': 'https://schema.org', ...organization };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
      {GA && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="lazyOnload" />
          <Script id="google-analytics" strategy="lazyOnload">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA}');`}
          </Script>
        </>
      )}
    </>
  );
}
