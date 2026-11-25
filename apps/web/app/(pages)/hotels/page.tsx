import type { Metadata } from 'next';
import HotelsListing from '@/components/hotel/HotelsListing';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FILTERS = ['q', 'type', 'stars', 'amenities', 'minPrice', 'maxPrice', 'couples', 'foreigners', 'minRating', 'sort', 'checkIn', 'page'];

/* Filtered and dated versions of /hotels/ are for people, not for the index: one canonical page. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = FILTERS.some((k) => sp[k]);
  return {
    title: 'Hotels in Pakistan — Compare Room Prices & Book Online | PakHotels',
    description: 'Compare hotels in Lahore, Islamabad, Karachi, Murree and across Pakistan: real room prices per night, photos and verified guest reviews. Book online in a minute.',
    alternates: { canonical: '/hotels' },
    openGraph: { title: 'Hotels in Pakistan — Compare Room Prices & Book Online', url: '/hotels' },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function HotelsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  return (
    <HotelsListing
      sp={sp}
      page={page}
      basePath="/hotels"
      title={typeof sp.q === 'string' && sp.q ? `Hotels matching “${sp.q}”` : 'Hotels in Pakistan'}
      intro="Real prices per night, rooms you can reserve now, and you pay at the hotel."
    />
  );
}
