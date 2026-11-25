import type { Metadata } from 'next';
import Wishlist from '@/components/hotel/Wishlist';

/* Hotels saved on this device. (Old address /tf-wishlist/ redirects here.) */
export const metadata: Metadata = {
  title: 'Saved hotels | PakHotels',
  alternates: { canonical: '/saved' },
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <main className="min-h-screen px-4 pb-10 pt-6 md:pt-10">
      <div className="container mx-auto">
        <p className="eyebrow">Wishlist</p>
        <h1 className="mt-2 text-[34px] font-bold leading-tight text-ink md:text-[44px]">Saved hotels</h1>
        <p className="mt-1 text-[16px] text-neutral-500">Tap the heart on any hotel to keep it here.</p>
        <Wishlist />
      </div>
    </main>
  );
}
