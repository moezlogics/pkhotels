import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";
import { getSiteName } from "@/lib/site-settings.server";

/*
 * The page's metadata lives here (it was a client component when this was
 * written). Without it the route inherited the root layout's, which is the
 * home page's title and description word for word.
 *
 * Editable from Static Pages: create a page with the slug "about" and its
 * Meta Title / Meta Description win over the fallback below.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteName();
  return pageMetadata("about", {
    title: `About ${site} — Pakistan's Hotel Booking Site`,
    description: "Who we are: a Pakistani hotel booking site with real room prices, verified guest reviews and bookings confirmed by the hotel itself.",
    path: "/about",
    keywords: ["about pakhotels", "hotel booking pakistan", "online hotel booking pakistan"],
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
