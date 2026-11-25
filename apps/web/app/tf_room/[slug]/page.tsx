import { notFound, permanentRedirect } from 'next/navigation';
import { roomRedirect } from '@/lib/hotels-server';
import { hotelPath } from '@/lib/hotels';

/* Old WordPress room pages (/tf_room/<slug>/) → the hotel they belong to, rooms section. */
type Props = { params: Promise<{ slug: string }> };

export default async function TfRoom({ params }: Props) {
  const { slug } = await params;
  const r = await roomRedirect(slug);
  if (!r?.hotelSlug) notFound();
  permanentRedirect(`${hotelPath(r.hotelSlug, r.citySlug)}#rooms`);
}
