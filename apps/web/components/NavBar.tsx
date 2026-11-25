'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, CalendarCheck, ChevronDown, Heart, LayoutDashboard, LogOut, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DialogTitle } from '@/components/ui/dialog';
import { BrandLogo } from '@/components/BrandLogo';
import { CurrencyPicker } from '@/components/Currency';
import { useSiteSettings } from '@/components/SiteSettingsProvider';
import { useAuth } from '@/context/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { resolved } from '@/lib/site-settings';
import { isPropertyDetail } from '@/lib/routes';

/*
 * The header: logo, Hotels, a Destinations menu, and on the right "My
 * bookings", sign in and the one button hotels need — "List your hotel".
 * On a hotel page on phones it steps aside so the photos run to the top.
 */

const NAV_LINKS = [
  { name: 'Hotels', path: '/hotels' },
  { name: 'Find my booking', path: '/find-booking' },
  { name: 'For hotels', path: '/list-your-hotel' },
];

/** Destinations menu: /hotels/<city>. */
const TYPE_LINKS = [
  { name: 'Hotels in Lahore', path: '/hotels/lahore' },
  { name: 'Hotels in Islamabad', path: '/hotels/islamabad' },
  { name: 'Hotels in Karachi', path: '/hotels/karachi' },
  { name: 'Hotels in Multan', path: '/hotels/multan' },
  { name: 'All hotels', path: '/hotels' },
];

const MORE_LINKS = [
  { name: 'My trips', path: '/trips' },
  { name: 'Saved hotels', path: '/saved' },
  { name: 'Hotel plans', path: '/packages' },
  { name: 'Blog', path: '/blog' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

const ADD_PROPERTY = '/dashboard/hotel';

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The admin's logo if one is set (Settings → Appearance), else the built-in
 * mark. Its height follows the two logo-size settings — one for phones, one
 * for desktop — through the --logo-h / --logo-h-lg variables on <html>.
 */
export function SiteLogo() {
  const settings = useSiteSettings();
  const { siteName } = resolved(settings);
  if (settings.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={settings.logoUrl}
        alt={siteName}
        className="h-[var(--logo-h)] w-auto max-w-[220px] object-contain md:h-[var(--logo-h-lg)]"
      />
    );
  }
  return (
    <BrandLogo
      name={siteName}
      markClassName="h-[var(--logo-h)] w-[var(--logo-h)] md:h-[var(--logo-h-lg)] md:w-[var(--logo-h-lg)]"
      textClassName="text-[calc(var(--logo-h)*0.64)] md:text-[calc(var(--logo-h-lg)*0.6)]"
    />
  );
}

const linkClass = (active: boolean) =>
  cn(
    'rounded-full px-4 py-2 text-[15px] font-medium transition-colors',
    active ? 'bg-ink text-white' : 'text-neutral-700 hover:bg-white hover:text-ink',
  );

const Navbar = () => {
  const rateLinks = TYPE_LINKS;
  const pathname = usePathname() || '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  // Auth state only exists in the browser; rendering the signed-in controls
  // on the server would flash the wrong ones before hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const addPropertyHref = isAuthenticated ? ADD_PROPERTY : `/register?next=${ADD_PROPERTY}`;
  const ratesActive = /^\/hotels\/[^/]+/.test(pathname);
  const initial = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const immersive = isPropertyDetail(pathname);
  const settings = useSiteSettings();
  const showAnnouncement = settings.announcementEnabled && settings.announcementText;

  return (
    <>
      {/* Settings → General → Announcement bar. Scrolls away with the page. */}
      {showAnnouncement && (
        <div className={cn('bg-navy text-white', immersive && 'max-md:hidden')}>
          <div className="container mx-auto flex min-h-9 items-center justify-center gap-2 px-4 py-1.5 text-center text-[14px]">
            {settings.announcementLink ? (
              <Link href={settings.announcementLink} className="inline-flex items-center gap-1.5 hover:underline">
                {settings.announcementText}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span>{settings.announcementText}</span>
            )}
          </div>
        </div>
      )}

    {/*
      Solid white, 56px on phones / 64px on desktop — the sticky
      bars below it line up on that height (top-14 / md:top-16). On desktop
      the links sit in one white pill in the middle.
    */}
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-[color:var(--border)] bg-white',
        immersive && 'max-md:hidden',
      )}
    >
      <div className="container container-flush mx-auto flex h-14 items-center gap-3 px-4 md:h-16">
        <Link href="/" aria-label="Home" className="shrink-0">
          <SiteLogo />
        </Link>

        {/* Desktop links */}
        <nav className="mx-auto hidden items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-[#f7f5fc] p-1 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.path} href={link.path} className={linkClass(link.path === '/hotels' ? pathname === '/hotels' : isActive(pathname, link.path))}>
              {link.name}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(linkClass(ratesActive), 'inline-flex items-center gap-1 outline-none')}>
              Destinations
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56 rounded-2xl p-1.5">
              {rateLinks.map((rate) => (
                <DropdownMenuItem key={rate.path} asChild className="rounded-xl px-3 py-2 text-[15px]">
                  <Link href={rate.path} className="cursor-pointer">
                    {rate.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Desktop actions */}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <CurrencyPicker className="h-10 border border-[color:var(--border)] bg-white" />
          <Link href="/saved" aria-label="Saved hotels" className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--border)] bg-white text-ink transition hover:border-ink">
            <Heart className="h-[18px] w-[18px]" />
          </Link>
          {mounted &&
            (isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[15px] font-semibold text-white outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  {initial}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60 rounded-2xl p-1.5" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-[15px] font-semibold">{user?.name || 'Your account'}</p>
                    <p className="truncate text-[13px] text-muted-foreground">{user?.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl py-2 text-[15px]">
                    <Link href="/trips" className="cursor-pointer">
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      My trips
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl py-2 text-[15px]">
                    <Link href="/saved" className="cursor-pointer">
                      <Heart className="mr-2 h-4 w-4" />
                      Saved hotels
                    </Link>
                  </DropdownMenuItem>
                  {user?.role && user.role !== 'USER' && (
                    <DropdownMenuItem asChild className="rounded-xl py-2 text-[15px]">
                      <Link href="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {user.role === 'ADMIN' ? 'Admin dashboard' : 'My hotel dashboard'}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-xl py-2 text-[15px]">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
            ))}
          <Link href={addPropertyHref} className="btn-yellow btn-sm pr-1.5">
            List your hotel
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        {/* Mobile: the menu. */}
        <div className="ml-auto flex items-center gap-0.5 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              className="grid h-11 w-11 place-items-center rounded-full bg-ink text-white transition active:scale-95"
            >
              {/* Two lines, the lower one shorter — the modern app menu mark. */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                <path d="M5 9h14" />
                <path d="M5 15h9" />
              </svg>
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col gap-0 border-l-0 bg-[#f7f5fc] p-0">
            <DialogTitle className="sr-only">Menu</DialogTitle>

            <div className="flex h-14 items-center px-4">
              <SiteLogo />
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-4" aria-label="Mobile">
              <ul className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-white">
                {[...NAV_LINKS, ...MORE_LINKS].map((link) => (
                  <li key={link.path} className="border-b border-[color:var(--border)] last:border-0">
                    <Link
                      href={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-4 py-3.5 text-[17px] font-medium',
                        isActive(pathname, link.path) ? 'text-ink' : 'text-neutral-800',
                      )}
                    >
                      {link.name}
                      <ArrowRight className={cn('h-4 w-4', isActive(pathname, link.path) ? 'text-ink' : 'text-neutral-400')} />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3">
                <span className="text-[15px] font-medium text-neutral-800">Show prices in</span>
                <CurrencyPicker />
              </div>

              <p className="eyebrow mt-6">Destinations</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {rateLinks.map((rate) => (
                  <Link
                    key={rate.path}
                    href={rate.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-[15px] font-medium',
                      pathname === rate.path ? 'border-ink bg-ink text-white' : 'border-[color:var(--border)] bg-white text-ink',
                    )}
                  >
                    {rate.name.replace('Hotels in ', '')}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="space-y-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Link href={addPropertyHref} onClick={() => setMobileOpen(false)} className="btn-yellow h-[52px] w-full">
                <Plus className="h-4 w-4" />
                List your hotel
              </Link>
              {mounted &&
                (isAuthenticated ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={user?.role && user.role !== 'USER' ? '/dashboard' : '/trips'} onClick={() => setMobileOpen(false)} className="btn-ghost h-[52px]">
                      {user?.role && user.role !== 'USER' ? 'Dashboard' : 'My trips'}
                    </Link>
                    <button type="button" onClick={logout} className="btn-ghost h-[52px]">
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-ink h-[52px] w-full">
                    Sign in
                  </Link>
                ))}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
    </>
  );
};

export default Navbar;
