import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MessageCircle, Phone, Youtube } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { getSiteSettings } from '@/lib/site-settings.server';
import { hotelCities } from '@/lib/hotels-server';
import { DEFAULT_SOCIALS, resolved, waDigits } from '@/lib/site-settings';

/*
 * The footer: logo and one line about the site, the links people look for,
 * every city page as one quiet line (internal links for search engines),
 * contact and socials, and the legal line. Contact comes from Settings → General.
 */

const EXPLORE = [
  { name: 'All hotels', href: '/hotels' },
  { name: 'Find my booking', href: '/find-booking' },
  { name: 'My trips', href: '/trips' },
  { name: 'Saved hotels', href: '/saved' },
  { name: 'List your hotel', href: '/list-your-hotel' },
  { name: 'Hotel plans', href: '/packages' },
  { name: 'Blog', href: '/blog' },
  { name: 'About us', href: '/about' },
  { name: 'Contact us', href: '/contact' },
];

function SocialIcon({ name }: { name: string }) {
  const cls = 'h-4 w-4';
  switch (name) {
    case 'Facebook':
      return <Facebook className={cls} />;
    case 'Instagram':
      return <Instagram className={cls} />;
    case 'YouTube':
      return <Youtube className={cls} />;
    case 'LinkedIn':
      return <Linkedin className={cls} />;
    case 'TikTok':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.77.12V9.66a5.73 5.73 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
        </svg>
      );
  }
}

const Footer = async () => {
  const [settings, cities] = await Promise.all([getSiteSettings(), hotelCities()]);
  const r = resolved(settings);
  const footerLogo = settings.footerLogoUrl || settings.logoUrl;
  const socials = r.socials.length ? r.socials : DEFAULT_SOCIALS;
  const year = new Date().getFullYear();

  const quick = EXPLORE;
  const popular = cities.map((c) => ({ name: `Hotels in ${c.name}`, href: `/hotels/${c.slug}` }));

  return (
    <footer className="grain mt-12 overflow-hidden rounded-t-[32px] bg-navy text-white md:rounded-t-[48px]">
      <div className="container container-flush mx-auto px-4 md:px-6">
        {/* The last call to act: search, or list a hotel. */}
        <div className="flex flex-col gap-6 border-b border-white/10 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div className="max-w-2xl">
            <p className="eyebrow eyebrow-light">Pay at the hotel</p>
            <h2 className="mt-3 text-[34px] font-bold leading-[1.02] md:text-[56px]">
              Your next room is <span className="mark-pill">one tap</span> away.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/hotels" className="btn-yellow h-[52px] px-6">Find a hotel</Link>
            <Link href="/list-your-hotel" className="inline-flex h-[52px] items-center justify-center rounded-full border border-white/25 px-6 text-[16px] font-semibold text-white transition hover:bg-white hover:text-ink">List your hotel</Link>
          </div>
        </div>

        <div className="grid gap-8 py-10 md:grid-cols-[1.3fr_1fr_1fr] md:gap-12">
          <div className="max-w-sm">
            <Link href="/" aria-label={`${r.siteName} home`} className="inline-block">
              {footerLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerLogo} alt={r.siteName} className="h-[var(--logo-h)] w-auto max-w-[200px] object-contain" />
              ) : (
                <BrandLogo name={r.siteName} textClassName="text-white" />
              )}
            </Link>
            <p className="mt-3 text-[15px] leading-relaxed text-white/65">{r.footerAbout}</p>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map(([name, href]) => (
                  <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-primary hover:bg-primary hover:text-white">
                    <SocialIcon name={name} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label="Footer">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/45">Explore</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[15px] md:grid-cols-1">
              {quick.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-white/80 transition hover:text-primary">{l.name}</Link></li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/45">Talk to us</p>
            <div className="flex flex-col gap-2.5 text-[15px]">
              <a href={r.phoneHref} className="inline-flex items-center gap-2.5 text-white/80 hover:text-primary">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><Phone className="h-4 w-4" /></span> {r.phone}
              </a>
              <a href={`https://wa.me/${waDigits(r.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 text-white/80 hover:text-primary">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><MessageCircle className="h-4 w-4" /></span> WhatsApp us
              </a>
              <a href={`mailto:${r.email}`} className="inline-flex items-center gap-2.5 break-all text-white/80 hover:text-primary">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"><Mail className="h-4 w-4" /></span> {r.email}
              </a>
            </div>
          </div>
        </div>

        {popular.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-white/10 py-6">
            {popular.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full border border-white/15 px-3.5 py-1.5 text-[14px] text-white/75 transition hover:border-primary hover:text-primary">{l.name}</Link>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-white/10 py-5 text-[14px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>{settings.copyrightText ? settings.copyrightText.replace('{year}', String(year)) : `© ${year} ${r.siteName}. All rights reserved.`}</p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
