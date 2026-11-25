import {
  Banknote,
  Megaphone,
  BellRing,
  Calculator,
  BarChart3,
  BookOpen,
  Flag,
  Building2,
  CreditCard,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  Layers,
  MapPin,
  Map as MapIcon,
  Package2,
  Palette,
  ShoppingBag,
  Store,
  Tags,
  Settings,
  Users,
  Wallet,
  Star,
  Bell,
  HousePlus,
  Hotel,
  BedDouble,
  CalendarRange,
  CalendarCheck,
  KeyRound,
  Rocket,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavLeaf {
  title: string;
  /** Shown instead of title to non-admins, where the admin wording would mislead. */
  agentTitle?: string;
  href: string;
  /** Match the href exactly. Use for index routes whose children are separate entries. */
  exact?: boolean;
  adminOnly?: boolean;
  /** Hidden from admins — for agent-side screens. */
  agentOnly?: boolean;
  /** Hidden from an agency's own agents — the plan and the team are the agency owner's. */
  notForTeamAgents?: boolean;
  /** Extra words the sidebar filter should match against. */
  keywords?: string[];
}

export interface NavGroup {
  /** Stable id used as the collapsible key. */
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** Path prefixes that belong to this group, used for active and auto-open state. */
  matches: string[];
  items: NavLeaf[];
  adminOnly?: boolean;
}

export interface NavSection {
  /** Section heading, or null for the ungrouped top block. */
  label: string | null;
  entries: (NavGroup | NavLeaf)[];
}

export function isGroup(entry: NavGroup | NavLeaf): entry is NavGroup {
  return "items" in entry;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    entries: [
      { title: "Overview", href: "/dashboard", exact: true, keywords: ["home", "stats", "dashboard", "today"] },
      { title: "Bookings", href: "/dashboard/bookings", keywords: ["reservations", "requests", "guests", "arrivals", "check-in"] },
      { title: "Calendar & Prices", href: "/dashboard/calendar", keywords: ["availability", "rates", "seasonal", "close dates", "inventory"] },
      { title: "My Hotel", href: "/dashboard/hotel", agentOnly: true, keywords: ["hotel", "profile", "photos", "amenities", "policies", "settings"] },
      { title: "Rooms", href: "/dashboard/rooms", keywords: ["room types", "prices", "inventory"] },
      { title: "Guest Reviews", href: "/dashboard/hotel-reviews", keywords: ["reviews", "ratings", "reply"] },
      { title: "Media Library", href: "/dashboard/images-gallery", keywords: ["images", "gallery", "photos", "uploads", "media"] },
    ],
  },
  {
    label: "Hotels",
    entries: [
      { title: "All Hotels", href: "/dashboard/hotels", adminOnly: true, keywords: ["hotels", "approve", "featured", "unclaimed", "owners"] },
      { title: "Hotel Claims", href: "/dashboard/hotel-claims", adminOnly: true, keywords: ["claim", "owner", "verify"] },
      {
        id: "locations",
        title: "Locations",
        icon: MapPin,
        adminOnly: true,
        matches: ["/dashboard/city", "/dashboard/area"],
        items: [
          { title: "Cities", href: "/dashboard/city", exact: true },
          { title: "Add City", href: "/dashboard/city/add-city" },
          { title: "Areas", href: "/dashboard/area", exact: true, keywords: ["sector", "locality"] },
          { title: "Add Area", href: "/dashboard/area/add-area" },
        ],
      },
    ],
  },
  {
    label: "Content",
    entries: [
      {
        id: "blog",
        title: "Blog",
        icon: BookOpen,
        adminOnly: true,
        // Ordered longest-first so /dashboard/blog-category never resolves as
        // a child of /dashboard/blog.
        matches: ["/dashboard/blog-category", "/dashboard/blog"],
        items: [
          {
            title: "All Posts",
            href: "/dashboard/blog",
            exact: true,
            keywords: ["articles"],
          },
          {
            title: "Write New Post",
            href: "/dashboard/blog/add-blog",
            keywords: ["create", "draft"],
          },
          {
            title: "Categories",
            href: "/dashboard/blog-category",
            exact: true,
            keywords: ["taxonomy", "tags"],
          },
          {
            title: "Add Category",
            href: "/dashboard/blog-category/add-category",
          },
        ],
      },
      {
        id: "pages",
        title: "Static Pages",
        icon: FileText,
        adminOnly: true,
        matches: ["/dashboard/pages"],
        items: [
          {
            title: "All Pages",
            href: "/dashboard/pages",
            exact: true,
            keywords: ["seo", "cms", "landing"],
          },
          { title: "Add Page", href: "/dashboard/pages/add-page" },
        ],
      },
    ],
  },
  {
    label: "Billing",
    entries: [
      {
        id: "packages",
        title: "Packages",
        icon: Package2,
        adminOnly: true,
        matches: ["/dashboard/packages"],
        items: [
          {
            title: "All Packages",
            href: "/dashboard/packages",
            exact: true,
            keywords: ["plans", "pricing"],
          },
          { title: "Add Package", href: "/dashboard/packages/add" },
        ],
      },
      {
        title: "Subscriptions",
        href: "/dashboard/subscriptions",
        adminOnly: true,
        keywords: ["billing", "payments", "plans", "invoices", "verify"],
      },
      {
        title: "Payment Methods",
        href: "/dashboard/payment-methods",
        adminOnly: true,
        keywords: ["jazzcash", "easypaisa", "bank", "account", "checkout"],
      },
      {
        title: "Hotel Billing",
        agentTitle: "Billing & invoices",
        href: "/dashboard/billing",
        keywords: ["invoice", "commission", "pay", "billing", "overdue", "verify", "follow up"],
      },
      {
        title: "Boost",
        href: "/dashboard/boost",
        agentOnly: true,
        keywords: ["boost", "featured", "top", "promote", "advertise"],
      },
      {
        title: "My Subscription",
        href: "/dashboard/my-subscription",
        keywords: ["plan", "billing", "upgrade"],
      },
      {
        title: "Notifications",
        href: "/dashboard/push-settings",
        keywords: ["push", "notifications", "alerts", "phone", "devices"],
      },
      {
        /*
         * The one billing entry an agent can see.
         *
         * Packages, Subscriptions and Payment Methods are all adminOnly, so
         * the only way to buy anything was a "View Packages" button on the My
         * Subscription page — one click deeper than anyone looks. An agent
         * who wants to pay should never have to hunt for where.
         */
        title: "Upgrade Plan",
        href: "/dashboard/purchase-package",
        notForTeamAgents: true,
        keywords: ["package", "packages", "upgrade", "subscribe", "checkout", "pay"],
      },
    ],
  },
  {
    label: "Administration",
    entries: [
      {
        title: "Push Notifications",
        href: "/dashboard/push",
        adminOnly: true,
        keywords: ["push", "campaign", "broadcast", "subscribers", "notify", "send notification"],
      },
      {
        title: "Users",
        href: "/dashboard/users",
        exact: true,
        adminOnly: true,
        keywords: ["accounts", "agents", "roles", "permissions"],
      },
      {
        title: "General Settings",
        href: "/dashboard/settings",
        adminOnly: true,
        keywords: ["settings", "contact", "phone", "whatsapp", "email", "social", "footer", "seo", "analytics", "announcement", "homepage"],
      },
      {
        title: "Appearance",
        href: "/dashboard/appearance",
        adminOnly: true,
        keywords: ["theme", "colour", "color", "brand", "logo", "font", "favicon", "design", "hero", "background"],
      },
      {
        title: "Notifications",
        href: "/dashboard/notifications",
        adminOnly: true,
        keywords: ["discord", "alerts", "notify", "daily report", "digest"],
      },
      {
        title: "Ads",
        href: "/dashboard/ads",
        adminOnly: true,
        keywords: ["adsense", "google ads", "advertisement", "monetize", "ad slot", "publisher"],
      },
    ],
  },
];

/** Icons for the flat (non-group) leaves, keyed by href. */
export const LEAF_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/bookings": CalendarCheck,
  "/dashboard/calendar": CalendarRange,
  "/dashboard/hotel": Hotel,
  "/dashboard/rooms": BedDouble,
  "/dashboard/hotel-reviews": Star,
  "/dashboard/hotels": Building2,
  "/dashboard/hotel-claims": KeyRound,
  "/dashboard/push": BellRing,
  "/dashboard/push-settings": Bell,
  "/dashboard/payment-methods": Banknote,
  "/dashboard/images-gallery": ImageIcon,
  "/dashboard/subscriptions": CreditCard,
  "/dashboard/my-subscription": Wallet,
  "/dashboard/billing": CreditCard,
  "/dashboard/boost": Rocket,
  "/dashboard/purchase-package": Package2,
  "/dashboard/users": Users,
  "/dashboard/appearance": Palette,
  "/dashboard/settings": Settings,
  "/dashboard/ads": Megaphone,
  "/dashboard/notifications": BellRing,
};

/**
 * Every dashboard route that requires ADMIN, derived from the nav tree so the
 * layout guard and the sidebar can never disagree about who may see what.
 */
export function collectAdminRoutes(): string[] {
  const routes = new Set<string>();
  for (const section of NAV_SECTIONS) {
    for (const entry of section.entries) {
      if (isGroup(entry)) {
        if (entry.adminOnly) {
          for (const match of entry.matches) routes.add(match);
          for (const item of entry.items) routes.add(item.href);
        } else {
          for (const item of entry.items) {
            if (item.adminOnly) routes.add(item.href);
          }
        }
      } else if (entry.adminOnly) {
        routes.add(entry.href);
      }
    }
  }
  return [...routes];
}

/** Human labels for breadcrumbs, keyed by path segment. */
export const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  bookings: "Bookings",
  calendar: "Calendar & Prices",
  hotel: "My Hotel",
  rooms: "Rooms",
  "hotel-reviews": "Guest Reviews",
  hotels: "All Hotels",
  "hotel-claims": "Hotel Claims",
  city: "Cities",
  "add-city": "Add City",
  area: "Areas",
  "add-area": "Add Area",
  blog: "Blog",
  "add-blog": "New Post",
  "blog-category": "Blog Categories",
  "add-category": "Add Category",
  pages: "Static Pages",
  "add-page": "Add Page",
  "images-gallery": "Media Library",
  packages: "Packages",
  subscriptions: "Subscriptions",
  "payment-methods": "Payment Methods",
  "my-subscription": "My Subscription",
  billing: "Billing",
  boost: "Boost",
  push: "Push Notifications",
  "push-settings": "Notifications",
  compose: "New campaign",
  reviews: "Reviews",
  "purchase-package": "Purchase Package",
  users: "Users",
  appearance: "Appearance",
  settings: "General Settings",
  account: "My Account",
  add: "Add",
  edit: "Edit",
};
