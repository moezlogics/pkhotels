 import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Addresses follow propertydealer.pk: no trailing slash, city first —
   * /hotels/lahore, /hotels/lahore/5-star, /hotels/lahore/<hotel>.
   * Every old WordPress address 308s to its new one (redirects() below, plus
   * the /hotels/[city] and /tf_room routes for the ones that need a lookup).
   */
  trailingSlash: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 60,
    // The same widths the API's /img makes (lib/img.ts), so every srcset entry is one cached file.
    deviceSizes: [480, 640, 828, 1080, 1280, 1600],
    imageSizes: [96, 160, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'ptcptourism.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'english.news.cn' },
      { protocol: 'https', hostname: 'pakhotels.pk' },
      { protocol: 'https', hostname: 'www.pakhotels.pk' },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    optimizeCss: true,
    // How long the browser reuses a page it already fetched while you click
    // around. Next's default is 5 minutes, so an edit saved in the dashboard
    // still looked unchanged on the site; 30 seconds is the shortest allowed.
    staleTimes: { dynamic: 0, static: 30 },
  },

  compress: true,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control',   value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'origin-when-cross-origin' },
          /*
           * geolocation=(self), not ().
           *
           * () blocks it outright, including for our own pages — so the "I'm
           * here" button on the map picker threw "Permissions policy
           * violation: Geolocation access has been blocked" and did nothing.
           * (self) keeps it off for embedded third parties and lets our own
           * page ask, which the browser still gates behind the user's own
           * permission prompt.
           */
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      // Production file names carry a content hash; dev ones do not, so caching them forever there serves stale CSS.
      ...(process.env.NODE_ENV === 'production'
        ? [{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }]
        : []),
    ];
  },

  async redirects() {
    // `{/}?` matches the old trailing-slash form too, so each old address is one hop.
    const r = (source: string, destination: string) => ({ source: `${source}{/}?`, destination, permanent: true });
    return [
      // Old WordPress (Tourfic) addresses → the new scheme.
      r('/hotel-location/:city/page/:n(\\d+)', '/hotels/:city?page=:n'),
      r('/hotel-location/:city', '/hotels/:city'),
      r('/hotel-location', '/hotels'),
      r('/hotels/page/:n(\\d+)', '/hotels?page=:n'),
      r('/search', '/hotels'),
      r('/hotel-search', '/hotels'),
      r('/my-account', '/trips'),
      r('/my-account/:path*', '/trips'),
      r('/tf-wishlist', '/saved'),
      r('/tf-qr-code-scanner', '/find-booking'),
      r('/hotel', '/hotels'),
      // WooCommerce leftovers and feeds.
      r('/cart', '/hotels'),
      r('/checkout', '/hotels'),
      r('/feed', '/'),
      r('/hotels/feed', '/hotels'),
      r('/email-verification', '/login'),
      { source: '/dashboard/property/:path*', destination: '/dashboard', permanent: false },
    ];
  },

  async rewrites() {
    // 📡 Determine the correct NestJS API URL.
    // ⚠️ CRITICAL: DO NOT proxy to the web app itself or the public domain (pakhotels.pk) as it causes infinite proxy loops.
    let baseUrl = process.env.INTERNAL_API_URL;
    
    if (!baseUrl) {
      const publicUrl = process.env.NEXT_PUBLIC_API_URL;
      if (publicUrl && !publicUrl.includes('pakhotels.pk') && !publicUrl.includes('localhost:3210')) {
        baseUrl = publicUrl;
      }
    }
    
    if (!baseUrl) {
      // Fallback: PM2 runs the PakHotels API on 3120 in production, dev runs on 3205
      baseUrl = process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3120' : 'http://localhost:3205';
    }

    console.log(`📡 Rewriting /api and /uploads to: ${baseUrl}`);
    return {
      beforeFiles: [
        // ✅ Sitemap XML rewrites
        { source: '/sitemap-pages.xml',  destination: '/sitemap-pages'  },
        { source: '/sitemap-blogs.xml',  destination: '/sitemap-blogs'  },
        { source: '/sitemap-hotels.xml', destination: '/sitemap-hotels' },
        // Yoast's sitemap names, which Search Console already knows.
        { source: '/sitemap_index.xml',          destination: '/sitemap.xml'    },
        { source: '/tf_hotel-sitemap.xml',       destination: '/sitemap-hotels' },
        { source: '/hotel_location-sitemap.xml', destination: '/sitemap-pages'  },
        { source: '/page-sitemap.xml',           destination: '/sitemap-pages'  },
      ],
      afterFiles: [
        { source: '/api/:path*',     destination: `${baseUrl}/api/:path*`     },
        { source: '/uploads/:path*', destination: `${baseUrl}/uploads/:path*` },
        // Resized photos (see lib/img.ts): made once by the API, then cached by Cloudflare.
        { source: '/img/:path*',     destination: `${baseUrl}/img/:path*`     },
        // Photos from the WordPress site keep their indexed addresses (Google Images).
        { source: '/wp-content/uploads/:path*', destination: `${baseUrl}/uploads/wp/:path*` },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;