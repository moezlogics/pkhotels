import { amenity } from './hotel-amenities';

const amenityLabel = (k: string) => amenity(k)?.label;
/* Types and small helpers shared by the hotel pages, the booking flow and the dashboard. */

export interface HotelCardData {
  _id: string;
  name: string;
  slug: string;
  propertyType: string;
  stars: number;
  shortDescription?: string;
  citySlug: string;
  cityName: string;
  areaName?: string;
  address?: string;
  coverImage: string;
  gallery: string[];
  amenities: string[];
  minPrice: number;
  ratingAvg: number;
  ratingCount: number;
  featured: boolean;
  verified: boolean;
  deal: { text: string; percent: number } | null;
  couplePolicy?: string;
  /** 'yes' | 'no' | '' — may host foreign passport holders. */
  acceptsForeigners?: string;
  airportPickup?: boolean;
  freeCancellation?: boolean;
  lat?: number;
  lng?: number;
  quote?: { perNight: number; total: number; totalBefore: number; roomsLeft: number; nights: number };
}

export interface RoomData {
  _id: string;
  name: string;
  description: string;
  bedType: string;
  beds: number;
  maxAdults: number;
  maxChildren: number;
  size: number;
  price: number;
  weekendPrice: number;
  originalPrice: number;
  breakfastIncluded: boolean;
  refundable: boolean;
  amenities: string[];
  images: string[];
  minNights: number;
  quantity: number;
}

export interface HotelDetail extends HotelCardData {
  foreignerRegistration?: boolean;
  languages?: string[];
  airportName?: string;
  airportKm?: number;
  airportPickupPrice?: number;
  description: string;
  nearby: { title: string; distance: string }[];
  videoUrl: string;
  checkInTime: string;
  checkOutTime: string;
  idRequired: boolean;
  childrenAllowed: boolean;
  petsAllowed: boolean;
  smokingAllowed: boolean;
  cancellationPolicy: string;
  freeCancelHours: number;
  policies: string;
  taxIncluded: boolean;
  taxPercent: number;
  extraBedPrice: number;
  faqs: { q: string; a: string }[];
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
  claimed: boolean;
  contact: { phone: string; whatsapp: string; email: string; website: string } | null;
  advanceMode: 'none' | 'optional' | 'required';
  advancePercent: number;
  instantConfirm: boolean;
  responseHours: number;
  booking: { open: boolean; reason?: string };
  reviewStats: { count: number; avg: number; cleanliness: number; staff: number; location: number; value: number };
  rooms: RoomData[];
}

export interface RoomQuote {
  roomId: string;
  name: string;
  available: number;
  nightly: number[];
  nightlyBefore: number[];
  total: number;
  totalBefore: number;
  perNight: number;
  closed: boolean;
  minNightsOk: boolean;
}

export interface StayQuery {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  rooms?: number;
}

export const PROPERTY_TYPES: { key: string; label: string }[] = [
  { key: 'hotel', label: 'Hotel' },
  { key: 'guest_house', label: 'Guest house' },
  { key: 'resort', label: 'Resort' },
  { key: 'apartment', label: 'Serviced apartment' },
  { key: 'motel', label: 'Motel' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'hut', label: 'Hut / cottage' },
  { key: 'camp', label: 'Camping / glamping' },
];
export const typeLabel = (k: string) => PROPERTY_TYPES.find((t) => t.key === k)?.label ?? 'Hotel';

export const COUPLE_POLICIES: Record<string, { label: string; short: string }> = {
  family_only: { label: 'Families only — unmarried couples are not accepted', short: 'Families only' },
  couples_with_nikah: { label: 'Married couples welcome — nikah nama or marriage certificate at check-in', short: 'Married couples' },
  couples_allowed: { label: 'Couples welcome — CNIC or passport at check-in', short: 'Couple friendly' },
  not_stated: { label: 'Ask the hotel about its couples policy', short: '' },
};

export const CANCELLATION: Record<string, string> = {
  free: 'Cancel until a set time before check-in',
  flexible: 'Cancellation by arrangement with the hotel',
  non_refundable: 'Non-refundable',
};

export const BOOKING_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Waiting for hotel', tone: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', tone: 'bg-emerald-100 text-emerald-800' },
  checked_in: { label: 'Checked in', tone: 'bg-sky-100 text-sky-800' },
  completed: { label: 'Completed', tone: 'bg-slate-100 text-slate-700' },
  declined: { label: 'Declined', tone: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-50 text-rose-700' },
  no_show: { label: 'No-show', tone: 'bg-rose-100 text-rose-800' },
  expired: { label: 'Expired', tone: 'bg-slate-100 text-slate-500' },
};

export const PURPOSES = [
  { key: 'family', label: 'Family trip' },
  { key: 'business', label: 'Business' },
  { key: 'couple', label: 'Couple' },
  { key: 'friends', label: 'Friends' },
  { key: 'solo', label: 'Solo' },
];

/** Rs 12,500 */
export function pkr(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return `Rs ${v.toLocaleString('en-PK')}`;
}

/* ── dates (YYYY-MM-DD, Pakistan time) ── */

export function todayPk(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}
export function addDays(d: string, n: number): string {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
export function nightsBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000));
}
export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
export function fmtDay(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!isDate(d)) return '';
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}
export function toDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, day ?? 1);
}
export function fromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m) return t || '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Reads a stay out of search params, dropping anything unusable or in the past. */
export function readStay(sp: Record<string, string | string[] | undefined>): StayQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const checkIn = one('checkIn');
  const checkOut = one('checkOut');
  const ok = isDate(checkIn) && isDate(checkOut) && checkIn >= todayPk() && checkOut > checkIn && nightsBetween(checkIn, checkOut) <= 30;
  const n = (k: string, min: number, max: number, d: number) => {
    const v = Number(one(k));
    return Number.isFinite(v) && v >= min ? Math.min(max, Math.floor(v)) : d;
  };
  return {
    ...(ok ? { checkIn, checkOut } : {}),
    adults: n('adults', 1, 30, 2),
    children: n('children', 0, 20, 0),
    rooms: n('rooms', 1, 10, 1),
  };
}

export function stayParams(s: StayQuery): string {
  const p = new URLSearchParams();
  if (s.checkIn && s.checkOut) {
    p.set('checkIn', s.checkIn);
    p.set('checkOut', s.checkOut);
  }
  if (s.adults && s.adults !== 2) p.set('adults', String(s.adults));
  if (s.children) p.set('children', String(s.children));
  if (s.rooms && s.rooms !== 1) p.set('rooms', String(s.rooms));
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** wa.me link with a prefilled message. Pakistani numbers are turned into 92xxxxxxxxxx. */
export function waLink(phone: string, text: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '92' + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function normalizeMobile(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  if (d.startsWith('92')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return /^03\d{9}$/.test(d) ? d : '';
}

/*
 * The address scheme, city first (like propertydealer.pk):
 *
 *   /hotels                          every hotel
 *   /hotels/<city>                   a city             /hotels/lahore
 *   /hotels/<segment>                a kind, nationwide /hotels/guest-houses
 *   /hotels/<city>/<segment>         a kind in a city   /hotels/lahore/5-star
 *   /hotels/<city>/<hotel>           one hotel          /hotels/lahore/pearl-continental
 *
 * Only what deserves its own landing page sits in the path; dates, guests,
 * price and the other filters go in the query string.
 */
export const SEGMENTS: Record<string, { label: string; type?: string; stars?: string; h1: (where: string) => string }> = {
  'guest-houses': { label: 'Guest houses', type: 'guest_house', h1: (w) => `Guest houses in ${w}` },
  apartments: { label: 'Apartments', type: 'apartment', h1: (w) => `Serviced apartments in ${w}` },
  '5-star': { label: '5 star', stars: '5', h1: (w) => `5 star hotels in ${w}` },
  '4-star': { label: '4 star', stars: '4', h1: (w) => `4 star hotels in ${w}` },
  '3-star': { label: '3 star', stars: '3', h1: (w) => `3 star hotels in ${w}` },
};
export const isSegment = (s: string) => Object.prototype.hasOwnProperty.call(SEGMENTS, s);

/** A hotel's page. Without the city (old data) it goes to /hotels/<slug>, which redirects. */
export const hotelPath = (slug: string, citySlug?: string) => (citySlug ? `/hotels/${citySlug}/${slug}` : `/hotels/${slug}`);
export const cityPath = (slug: string) => `/hotels/${slug}`;
export const segmentPath = (segment: string, citySlug?: string) => (citySlug ? `/hotels/${citySlug}/${segment}` : `/hotels/${segment}`);

export function ratingWord(r: number): string {
  if (r >= 4.6) return 'Exceptional';
  if (r >= 4.2) return 'Excellent';
  if (r >= 3.8) return 'Very good';
  if (r >= 3.4) return 'Good';
  if (r > 0) return 'Okay';
  return '';
}

/* ── SEO: one title and description pattern for every hotel page ── */

type SeoHotel = {
  name: string;
  cityName?: string;
  areaName?: string;
  stars?: number;
  propertyType?: string;
  minPrice?: number;
  ratingAvg?: number;
  ratingCount?: number;
  amenities?: string[];
  metaTitle?: string;
  metaDescription?: string;
};

/** Cut at a word, never mid-word, with an ellipsis only when something was dropped. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,.;:—–-]+$/, '') + '…';
}

/**
 * "Legend Hotel Islamabad — Rooms from Rs 13,999 | PakHotels".
 * Name first (what people search), city when the name lacks it, the price
 * that wins the click, and the brand when it still fits in ~60 characters.
 * An owner's own SEO title wins when it fits.
 */
export function hotelSeoTitle(h: SeoHotel): string {
  const own = (h.metaTitle || '').trim();
  if (own && own.length <= 60) return own;
  const city = h.cityName && !h.name.toLowerCase().includes(h.cityName.toLowerCase()) ? `, ${h.cityName}` : '';
  const base = `${h.name}${city}`;
  const price = h.minPrice ? ` — Rooms from ${pkr(h.minPrice)}` : '';
  for (const t of [`${base}${price} | PakHotels`, `${base}${price}`, `${base} — Book Online | PakHotels`, `${base} | PakHotels`]) {
    if (t.length <= 62) return t;
  }
  return clip(base, 62);
}

/**
 * "Book Legend Hotel Islamabad, a 4-star hotel in F-7. Rooms from Rs 13,999 a
 * night, rated 4.5/5 by 12 guests. Free WiFi, Free parking and Restaurant.
 * See photos, room prices and reviews." — ≤ 158 characters, built from live
 * data so the price and rating in the snippet are never stale.
 */
export function hotelSeoDescription(h: SeoHotel): string {
  const own = (h.metaDescription || '').trim();
  if (own.length >= 70 && own.length <= 160) return own;
  const inName = (x?: string) => !!x && h.name.toLowerCase().includes(x.toLowerCase());
  const place = [h.areaName && !inName(h.areaName) ? h.areaName : '', h.cityName && !inName(h.cityName) ? h.cityName : ''].filter(Boolean).join(', ');
  const kind = typeLabel(h.propertyType || 'hotel').toLowerCase();
  const lead = h.stars
    ? `Book ${h.name}, a ${h.stars}-star ${kind}${place ? ` in ${place}` : ''}.`
    : `Book ${h.name}${place ? ` in ${place}` : ''}.`;
  const facts = [
    h.minPrice ? `Rooms from ${pkr(h.minPrice)} a night` : '',
    h.ratingCount ? `rated ${Number(h.ratingAvg || 0).toFixed(1)}/5 by ${h.ratingCount} guest${h.ratingCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(', ');
  const labels = (h.amenities ?? []).map((k) => amenityLabel(k)).filter(Boolean).slice(0, 3) as string[];
  const perks = labels.length ? `${labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0]}.` : '';
  const tail = 'See photos, room prices and reviews.';
  const parts = [lead, facts ? `${facts}.` : '', perks, tail].filter(Boolean);
  // Drop the least useful parts first until it fits.
  let out = parts.join(' ');
  if (out.length > 158) out = [lead, facts ? `${facts}.` : '', perks].filter(Boolean).join(' ');
  if (out.length > 158) out = [lead, facts ? `${facts}.` : '', tail].filter(Boolean).join(' ');
  return clip(out, 158);
}

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ur: 'Urdu', pa: 'Punjabi', ps: 'Pashto', sd: 'Sindhi', bal: 'Balochi', ar: 'Arabic', zh: 'Chinese', fa: 'Persian', tr: 'Turkish',
};

/** What to bring at check-in, by who is checking in. */
export function idRule(foreign?: boolean): string {
  return foreign ? 'Passport with a valid Pakistan visa for every adult' : 'Original CNIC (or NICOP) for every adult';
}
