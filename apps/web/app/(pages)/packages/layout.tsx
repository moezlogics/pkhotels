import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/page-seo";

/* Editable from Static Pages under the slug "packages". */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("packages", {
    title: "Hotel Listing Plans — Free to List, Low Commission | PakHotels",
    description:
      "List your hotel on PakHotels free and pay only on completed stays — far below the 15–20% other sites take. Standard and Premium cut commission to 5% or 0% and add advances, seasonal prices and featured placement.",
    path: "/packages",
    keywords: ["list hotel pakistan", "low commission hotel booking site", "hotel listing plans pakistan", "online hotel bookings for hotels"],
  });
}

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
