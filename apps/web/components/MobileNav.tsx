"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, CalendarCheck, Heart, User, type LucideIcon } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { isPropertyDetail } from "@/lib/routes";

/**
 * The tab bar on phones — the pattern every Pakistani property app
 * uses (Zameen, OLX, Graana): Home, Search, a raised "+" to post, a section
 * tab, and Account.
 *
 * Most of this site's traffic arrives on a phone from search, and the only way
 * to get anywhere was the hamburger in the top bar — two taps and a sheet for
 * every move. This is one tap, always on screen.
 */

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** The dealers directory, and every city's dealers page. */


export default function MobileNav() {
  const pathname = usePathname() || "/";
  const { isAuthenticated, user } = useAuth();

  /*
   * A listing page has its own sticky "Call / WhatsApp" bar pinned to the
   * bottom on mobile (PropertyDetail), and two stacked bars is one too many —
   * the contact buttons are what matter on that screen.
   */
  if (isPropertyDetail(pathname)) return null;

  const tabs: Tab[] = [
    { key: "home", label: "Home", href: "/", icon: Home },
    { key: "search", label: "Hotels", href: "/hotels", icon: Search },
    { key: "bookings", label: "Trips", href: "/trips", icon: CalendarCheck },
    { key: "saved", label: "Saved", href: "/saved", icon: Heart },
    { key: "account", label: isAuthenticated ? "Profile" : "Sign in", href: isAuthenticated ? (user?.role && user.role !== "USER" ? "/dashboard" : "/dashboard/account") : "/login", icon: User },
  ];

  const active = (() => {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/trips") || pathname.startsWith("/booking") || pathname.startsWith("/find-booking")) return "bookings";
    if (pathname.startsWith("/saved")) return "saved";
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/login") || pathname.startsWith("/register")) return "account";
    if (pathname.startsWith("/hotels")) return "search";
    return "";
  })();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-40 flex h-16 items-stretch rounded-[26px] bg-ink/95 px-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)] ring-1 ring-white/10 backdrop-blur-xl md:hidden"
    >
      {tabs.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 transition-colors",
              on ? "text-white" : "text-white/60",
            )}
          >
            <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", on && "bg-highlight text-ink")}>
              <Icon className="h-[19px] w-[19px]" strokeWidth={on ? 2.4 : 1.9} />
            </span>
            <span className={cn("max-w-full truncate text-[11px] leading-none", on ? "font-semibold" : "font-medium")}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
