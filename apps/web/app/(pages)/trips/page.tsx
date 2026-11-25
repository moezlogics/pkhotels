import type { Metadata } from 'next';
import MyBookings from '@/components/hotel/MyBookings';

/* A guest's bookings. (Old address /my-account/ redirects here.) */
export const metadata: Metadata = {
  title: 'My trips | PakHotels',
  description: 'See and manage your hotel bookings on PakHotels.',
  alternates: { canonical: '/trips' },
  robots: { index: false, follow: true },
};

export default function TripsPage() {
  return (
    <main className="min-h-screen px-4 pb-10 pt-6 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Your bookings</p>
        <h1 className="mt-2 text-[34px] font-bold leading-tight text-ink md:text-[44px]">My trips</h1>
        <MyBookings />
      </div>
    </main>
  );
}
