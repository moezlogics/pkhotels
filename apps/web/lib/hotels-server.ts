import type { HotelCardData, HotelDetail } from './hotels';

/* Server-side reads for the public hotel pages (ISR, tagged "hotels"). */

const RAW = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3205';
const BASE = `${RAW.replace(/\/$/, '')}/api`;

async function get<T>(path: string, revalidate = 300, tags: string[] = ['hotels']): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate, tags }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * For pages that 404 when the thing is missing: null only on a real 404.
 * Anything else (API restarting, timeout) throws, so Next keeps serving the
 * last good page instead of caching a "not found" for a hotel that exists.
 */
async function getOr404<T>(path: string, revalidate = 300, tags: string[] = ['hotels']): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate, tags }, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  // Nest sends a null return as an empty 200 body: that is "not found" too.
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** Live (dated) searches must never be cached: availability changes by the minute. */
async function getFresh<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface SearchResult {
  items: HotelCardData[];
  total: number;
  page: number;
  pages: number;
  stay: { checkIn: string; checkOut: string; nights: number; adults: number; children: number; rooms: number } | null;
}

export interface CityStat {
  slug: string;
  name: string;
  count: number;
  minPrice: number;
  thumbnail: string;
}

export function searchHotels(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const qs = p.toString();
  return params.checkIn ? getFresh<SearchResult>(`/hotels?${qs}`) : get<SearchResult>(`/hotels?${qs}`, 300);
}

export const featuredHotels = (limit = 8, city?: string) =>
  get<HotelCardData[]>(`/hotels/featured?limit=${limit}${city ? `&city=${encodeURIComponent(city)}` : ''}`, 600).then((r) => r ?? []);

export const hotelCities = () => get<CityStat[]>('/hotels/cities', 600).then((r) => r ?? []);

export const cityInfo = (slug: string) =>
  getOr404<{ slug: string; name: string; metaTitle: string; metaDescription: string; description: string; thumbnail: string; count: number; minPrice?: number }>(
    `/hotels/city/${encodeURIComponent(slug)}`,
    600,
  );

export const hotelBySlug = (slug: string) => getOr404<HotelDetail>(`/hotels/slug/${encodeURIComponent(slug)}`, 300);

export const similarHotels = (slug: string) => get<HotelCardData[]>(`/hotels/slug/${encodeURIComponent(slug)}/similar`, 600).then((r) => r ?? []);

export const hotelReviews = (id: string) =>
  get<{ items: any[]; total: number }>(`/hotels/${id}/reviews`, 300).then((r) => r ?? { items: [], total: 0 });

export const hotelSlugs = () =>
  get<{ slug: string; updatedAt: string; citySlug: string; coverImage: string; name: string; propertyType?: string; stars?: number }[]>('/hotels/slugs', 600).then((r) => r ?? []);

export const roomRedirect = (wpSlug: string) => getOr404<{ hotelSlug: string; citySlug?: string }>(`/hotels/room-redirect/${encodeURIComponent(wpSlug)}`, 3600);

export const activePlans = () => get<any[]>('/packages', 600, ['packages']).then((r) => r ?? []);
