import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import { OtherPagesAdZone } from "@/components/ads/AdSlot";

export default function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* .site-shell: phones get the edge-to-edge gutter (globals.css). */}
      <div className="site-shell">
      <NavBar />
      <OtherPagesAdZone at="top" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />
      {children}
      <OtherPagesAdZone at="bottom" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />
      <Footer />

      {/*
        Room for the tab bar, so the end of the footer is never stuck
        underneath it. White, like the footer, so it reads as its last strip.
        Phones only — the bar itself is md:hidden.
      */}
      <div aria-hidden className="h-[calc(5.25rem+env(safe-area-inset-bottom))] bg-navy md:hidden" />
      <MobileNav />
      <FloatingWhatsApp />
      </div>
    </>
  );
}
