 import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { AuthProvider } from "@/context/auth-context";
import StructuredData from "@/components/StructuredData";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import ScrollRestorer from "@/components/ScrollRestorer";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { CurrencyProvider } from "@/components/Currency";
import PushPrompt from "@/components/push/PushPrompt";
import { getSiteSettings } from "@/lib/site-settings.server";
import { isHex, themeStyle } from "@/lib/site-settings";

// PakHotels's type: Manrope for reading (through the --font-geist-sans
// variable the stylesheet already reads), Bricolage Grotesque for headings.
const geistSans = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // Variable font: every weight from one file.
  display: "swap",
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

/*
 * The other fonts the admin can pick in Settings → Appearance. Declaring them
 * costs nothing until one is chosen: preload is off, and a browser only
 * downloads a font file when some text is actually set in it.
 */
// next/font needs literal options here, so each one is spelled out.

const metadataBase: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk'),
  title: {
    default: "PakHotels — Book Hotels in Pakistan Online at Real Prices",
    // Pages write their own full titles.
    template: "%s"
  },
  description: "Book hotels in Lahore, Islamabad, Karachi, Murree, Multan and across Pakistan. Compare real room prices per night, photos and verified guest reviews, and reserve in a minute.",
  keywords: ["pakhotels", "hotels in pakistan", "hotel booking pakistan", "hotels in lahore", "hotels in islamabad", "hotels in karachi", "hotels in multan", "book hotel online pakistan", "guest house booking pakistan", "hotels in murree"],
  authors: [{ name: "PakHotels Team" }],
  creator: "PakHotels",
  publisher: "PakHotels",
  formatDetection: {
    email: false,
    address: true,
    telephone: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_PK',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://pakhotels.pk',
    siteName: 'PakHotels',
    title: 'PakHotels — Book Hotels in Pakistan Online at Real Prices',
    description: "Book hotels in Lahore, Islamabad, Karachi, Murree, Multan and across Pakistan. Compare real room prices per night, photos and verified guest reviews, and reserve in a minute.",
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'PakHotels — hotels across Pakistan' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PakHotels — Hotels across Pakistan',
    description: 'Compare hotel room prices across Pakistan and book online in a minute.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  applicationName: 'PakHotels',
  category: 'travel',
};

/*
 * The defaults above, with whatever the admin has set in Settings → General
 * (default title and description, share image, Search Console verification)
 * and Settings → Appearance (favicon). Empty settings leave the built-in
 * values alone — these pages are ranked, so nothing changes unless someone
 * changes it on purpose.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const meta: Metadata = { ...metadataBase };
  if (s.seoTitle) {
    meta.title = { default: s.seoTitle, template: "%s" };
    meta.openGraph = { ...meta.openGraph, title: s.seoTitle };
  }
  if (s.seoDescription) {
    meta.description = s.seoDescription;
    meta.openGraph = { ...meta.openGraph, description: s.seoDescription };
  }
  if (s.ogImageUrl) {
    meta.openGraph = { ...meta.openGraph, images: [{ url: s.ogImageUrl, width: 1200, height: 630 }] };
    meta.twitter = { ...meta.twitter, images: [s.ogImageUrl] };
  }
  if (s.siteName) {
    meta.openGraph = { ...meta.openGraph, siteName: s.siteName };
    meta.authors = [{ name: `${s.siteName} Team` }];
    meta.creator = s.siteName;
    meta.publisher = s.siteName;
  }
  if (s.googleVerification) meta.verification = { google: s.googleVerification };
  /*
   * The favicon from Settings → Appearance, and only that one: the built-in
   * favicon.ico now lives in public/ (still served at /favicon.ico) instead
   * of app/, where Next added it to every page ahead of the admin's — so
   * browsers kept showing the old one. A PNG made from the same picture
   * (/api/push/icon.png) is listed too, for browsers and iPhones that don't
   * take .webp or .svg icons.
   */
  if (s.faviconUrl) {
    const v = encodeURIComponent((s.faviconUrl.split('/').pop() || '1').slice(0, 60));
    const png = `/api/push/icon.png?v=${v}`;
    meta.icons = {
      icon: [{ url: png, type: 'image/png', sizes: '192x192' }, { url: s.faviconUrl }],
      shortcut: png,
      apple: [{ url: png, sizes: '192x192' }],
    };
  } else {
    // app/icon.tsx and app/apple-icon.tsx: the PakHotels mark.
    meta.icons = { icon: '/icon', shortcut: '/icon', apple: '/apple-icon' };
  }
  return meta;
}

/*
 * The address-bar colour phone browsers (Chrome on Android, Safari on iPhone)
 * paint around the page — Settings → Appearance. White matches the header.
 */
export async function generateViewport(): Promise<Viewport> {
  const s = await getSiteSettings();
  return { themeColor: isHex(s.browserBarColor) ? s.browserBarColor : "#ffffff" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  const fontVariables = `${geistSans.variable} ${display.variable}`;

  return (
    // Colours, radius and font from Settings → Appearance, as CSS variables:
    // every component reads them through the Tailwind tokens.
    <html lang="en" className={fontVariables} style={themeStyle(settings)}>
      <body className="antialiased">
        {/* First, and outside the providers: a stale document that cannot load
            its chunks must still be able to rescue itself. */}
        <ChunkReloadGuard />
        <ScrollRestorer />
        <Providers>
          <AuthProvider>
            <TooltipProvider>
              <SiteSettingsProvider value={settings}>
                <StructuredData />
                <CurrencyProvider>{children}</CurrencyProvider>
              </SiteSettingsProvider>
              <PushPrompt />
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}