import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk';
  // Private per-guest links and the dashboard. Sign-in and account pages are
  // left crawlable on purpose: they carry noindex, which Google can only read
  // if it may fetch them (blocking them is how "Indexed, though blocked by
  // robots.txt" happens).
  const disallow = ['/dashboard', '/booking/', '/api/', '/_next/data/'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: 'Googlebot', allow: '/', disallow },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
