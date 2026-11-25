import { redirect } from 'next/navigation';

/* Booking happens in the sheet on the hotel page; old links land there with it open. */
type Props = { params: Promise<{ city: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BookPage({ params, searchParams }: Props) {
  const { city, slug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ['checkIn', 'checkOut', 'adults', 'children']) if (typeof sp[k] === 'string') q.set(k, sp[k] as string);
  const room = typeof sp.r === 'string' ? sp.r.split(':')[0] : typeof sp.room === 'string' ? sp.room : '';
  q.set('book', '1');
  if (room) q.set('room', room);
  redirect(`/hotels/${city}/${slug}?${q.toString()}`);
}
