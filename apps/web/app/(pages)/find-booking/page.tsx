import type { Metadata } from 'next';
import FindBooking from '@/components/hotel/FindBooking';

/* Open or verify a booking. (Old address /tf-qr-code-scanner/ redirects here.) */
export const metadata: Metadata = {
  title: 'Find my booking | PakHotels',
  description: 'Open your PakHotels booking with its reference and your mobile number.',
  alternates: { canonical: '/find-booking' },
  // A lookup form, not a page anyone searches for.
  robots: { index: false, follow: true },
};

export default function FindBookingPage() {
  return (
    <main className="min-h-[70vh] px-4 py-8 md:py-14">
      <FindBooking />
    </main>
  );
}
