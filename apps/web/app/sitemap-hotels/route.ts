// /sitemap-hotels.xml — every live hotel page (/hotels/<city>/<hotel>) with its cover photo.

import { sitemapXml, xmlResponse, SITE_URL } from '@/lib/sitemap-data';
import { hotelSlugs } from '@/lib/hotels-server';

export const revalidate = 3600;

export async function GET() {
  const rows = (await hotelSlugs()).map((h) => ({
    loc: `${SITE_URL}/hotels/${h.citySlug}/${h.slug}`,
    lastmod: String(h.updatedAt || '').slice(0, 10) || undefined,
    changefreq: 'daily',
    priority: '0.8',
    ...(h.coverImage ? { image: h.coverImage.startsWith('http') ? h.coverImage : `${SITE_URL}${h.coverImage}`, imageTitle: h.name } : {}),
  }));
  return xmlResponse(sitemapXml(rows));
}
