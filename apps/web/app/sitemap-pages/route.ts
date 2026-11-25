// /sitemap-pages.xml — the site's own pages, every city (/hotels/<city>) and every
// kind of stay with at least two hotels (/hotels/<segment>, /hotels/<city>/<segment>).

import { sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';
import { hotelCities, hotelSlugs } from '@/lib/hotels-server';
import { SEGMENTS } from '@/lib/hotels';

export const revalidate = 3600;

const STATIC_PAGES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/hotels', priority: '0.9', changefreq: 'daily' },
  { url: '/list-your-hotel', priority: '0.7', changefreq: 'monthly' },
  { url: '/packages', priority: '0.6', changefreq: 'weekly' },
  { url: '/find-booking', priority: '0.4', changefreq: 'yearly' },
  { url: '/blog', priority: '0.7', changefreq: 'daily' },
  { url: '/about', priority: '0.5', changefreq: 'monthly' },
  { url: '/contact', priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { url: '/terms', priority: '0.3', changefreq: 'yearly' },
];

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Parameters<typeof sitemapXml>[0] = STATIC_PAGES.map((p) => ({ loc: `${SITE_URL}${p.url}`, lastmod: today, changefreq: p.changefreq, priority: p.priority }));
  const [cities, hotels] = await Promise.all([hotelCities(), hotelSlugs()]);
  const count = (seg: string, city?: string) => {
    const s = SEGMENTS[seg]!;
    return hotels.filter((h) => (!city || h.citySlug === city) && (!s.type || h.propertyType === s.type) && (!s.stars || String(h.stars) === s.stars)).length;
  };
  for (const seg of Object.keys(SEGMENTS)) {
    if (count(seg) >= 2) rows.push({ loc: `${SITE_URL}/hotels/${seg}`, lastmod: today, changefreq: 'daily', priority: '0.7' });
  }
  for (const c of cities) {
    rows.push({ loc: `${SITE_URL}/hotels/${c.slug}`, lastmod: today, changefreq: 'daily', priority: '0.8' });
    for (const seg of Object.keys(SEGMENTS)) {
      if (count(seg, c.slug) >= 2) rows.push({ loc: `${SITE_URL}/hotels/${c.slug}/${seg}`, lastmod: today, changefreq: 'daily', priority: '0.7' });
    }
  }
  return xmlResponse(sitemapXml(rows));
}
