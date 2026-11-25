import type { Metadata } from 'next';
import { Suspense } from 'react';
import BookingView from '@/components/hotel/BookingView';

type Props = { params: Promise<{ ref: string }> };

export const metadata: Metadata = { title: 'Your booking | PakHotels', robots: { index: false, follow: false } };

export default async function BookingPage({ params }: Props) {
  const { ref } = await params;
  return (
    <main className="min-h-screen bg-neutral-50/70 px-4 py-6 pb-10">
      <Suspense>
        <BookingView refCode={ref.toUpperCase()} />
      </Suspense>
    </main>
  );
}
