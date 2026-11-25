"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, CalendarCheck, CalendarRange, Hotel, LayoutDashboard, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The dashboard's own tab bar, on phones.
 *
 * The sidebar collapses into a sheet below md, so every move an agent makes —
 * list a property, check views, open the media library — cost a tap on the
 * hamburger, a wait for the sheet, then the real tap. These are the five
 * things an agent does, one tap each, always on screen.
 *
 * Admin-only sections are deliberately absent: they stay in the sidebar, which
 * is still there. This bar is the agent's path through the dashboard.
 */

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra prefixes that should light this tab up. */
  also?: string[];
}

const TABS: Tab[] = [
  { key: "home", label: "Today", href: "/dashboard", icon: LayoutDashboard },
  { key: "bookings", label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { key: "calendar", label: "Calendar", href: "/dashboard/calendar", icon: CalendarRange },
  { key: "rooms", label: "Rooms", href: "/dashboard/rooms", icon: BedDouble },
  { key: "hotel", label: "Hotel", href: "/dashboard/hotel", icon: Hotel },
];

export default function DashboardMobileTabs() {
  const pathname = usePathname() || "";

  const active = (() => {
    if (pathname.startsWith("/dashboard/bookings")) return "bookings";
    if (pathname.startsWith("/dashboard/calendar")) return "calendar";
    if (pathname.startsWith("/dashboard/rooms")) return "rooms";
    if (pathname.startsWith("/dashboard/hotel") && !pathname.startsWith("/dashboard/hotel-")) return "hotel";
    if (pathname === "/dashboard") return "home";
    return "";
  })();

  return (
    <nav
      aria-label="Dashboard"
      className="sticky bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 mx-3 mb-2 flex h-16 items-stretch rounded-[24px] bg-ink px-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)] md:hidden"
    >
      {TABS.map((tab) => {
        const on = active === tab.key;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 transition-colors", on ? "text-white" : "text-white/60")}
          >
            <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", on && "bg-highlight text-ink")}>
              <Icon className="h-[19px] w-[19px]" strokeWidth={on ? 2.4 : 1.9} />
            </span>
            <span className={cn("max-w-full truncate text-[11px] leading-none", on ? "font-semibold" : "font-medium")}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
