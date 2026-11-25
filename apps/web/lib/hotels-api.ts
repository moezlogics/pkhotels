import api from './api';
import type { RoomQuote } from './hotels';

/* Browser-side calls for booking and the hotel dashboard. */

/** ?hotelId= for an admin managing someone else's (or an unclaimed) hotel. */
const scope = (hotelId?: string | null) => (hotelId ? { params: { hotelId } } : {});

export function apiError(e: any, fallback = 'Something went wrong. Please try again.'): string {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(' ');
  return typeof m === 'string' && m ? m : fallback;
}

export const hotelsApi = {
  quote: (slug: string, checkIn: string, checkOut: string) =>
    api.get<{ checkIn: string; checkOut: string; nights: number; rooms: RoomQuote[] }>(`/hotels/slug/${slug}/quote`, { params: { checkIn, checkOut } }).then((r) => r.data),
  cities: () => api.get<{ slug: string; name: string; count: number; minPrice: number }[]>('/hotels/cities').then((r) => r.data),
  search: (params: Record<string, any>) => api.get('/hotels', { params }).then((r) => r.data),
  view: (id: string) => api.post(`/hotels/${id}/view`).catch(() => undefined),
  claim: (id: string, body: any) => api.post(`/hotels/${id}/claim`, body).then((r) => r.data),
  myReview: (id: string) => api.get(`/hotels/${id}/reviews/mine`).then((r) => r.data),
  saveReview: (id: string, body: any) => api.put(`/hotels/${id}/reviews/mine`, body).then((r) => r.data),
  deleteReview: (id: string) => api.delete(`/hotels/${id}/reviews/mine`).then((r) => r.data),

  mine: (hotelId?: string | null) => api.get('/hotels/mine', scope(hotelId)).then((r) => r.data),
  create: (body: any) => api.post('/hotels/mine', body).then((r) => r.data),
  update: (body: any, hotelId?: string | null) => api.put('/hotels/mine', body, scope(hotelId)).then((r) => r.data),
  submit: (hotelId?: string | null) => api.post('/hotels/mine/submit', {}, scope(hotelId)).then((r) => r.data),
  addRoom: (body: any, hotelId?: string | null) => api.post('/hotels/mine/rooms', body, scope(hotelId)).then((r) => r.data),
  updateRoom: (id: string, body: any, hotelId?: string | null) => api.put(`/hotels/mine/rooms/${id}`, body, scope(hotelId)).then((r) => r.data),
  deleteRoom: (id: string, hotelId?: string | null) => api.delete(`/hotels/mine/rooms/${id}`, scope(hotelId)).then((r) => r.data),
  calendar: (from: string, days: number, hotelId?: string | null) =>
    api.get('/hotels/mine/calendar', { params: { from, days, ...(hotelId ? { hotelId } : {}) } }).then((r) => r.data),
  setRates: (body: any, hotelId?: string | null) => api.put('/hotels/mine/calendar', body, scope(hotelId)).then((r) => r.data),

  adminList: (params: Record<string, any>) => api.get('/hotels/admin/list', { params }).then((r) => r.data),
  adminCreate: (body: any) => api.post('/hotels/admin', body).then((r) => r.data),
  adminSet: (id: string, body: any) => api.patch(`/hotels/admin/${id}`, body).then((r) => r.data),
  adminDelete: (id: string) => api.delete(`/hotels/admin/${id}`).then((r) => r.data),
  claims: (status = 'pending') => api.get('/hotels/admin/claims', { params: { status } }).then((r) => r.data),
  decideClaim: (id: string, body: any) => api.patch(`/hotels/admin/claims/${id}`, body).then((r) => r.data),
};

export const bookingsApi = {
  create: (body: any) => api.post<{ ref: string; token: string; status: string; total: number; advanceAmount: number; paymentMode: string }>('/bookings', body).then((r) => r.data),
  byRef: (ref: string, t: string) => api.get(`/bookings/ref/${ref}`, { params: { t } }).then((r) => r.data),
  lookup: (ref: string, phone: string) => api.get<{ ref: string; token: string }>('/bookings/lookup', { params: { ref, phone } }).then((r) => r.data),
  cancel: (ref: string, t: string, reason: string) => api.post(`/bookings/ref/${ref}/cancel`, { t, reason }).then((r) => r.data),
  advance: (ref: string, body: any) => api.post(`/bookings/ref/${ref}/advance`, body).then((r) => r.data),
  upload: (ref: string, t: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ url: string }>(`/bookings/ref/${ref}/upload`, fd, { params: { t }, headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  review: (ref: string, body: any) => api.post(`/bookings/ref/${ref}/review`, body).then((r) => r.data),
  stayed: (ref: string, body: { t: string; note?: string }) => api.post(`/bookings/ref/${ref}/stayed`, body).then((r) => r.data),
  my: () => api.get('/bookings/my').then((r) => r.data),

  list: (params: Record<string, any>) => api.get('/bookings/hotel', { params }).then((r) => r.data),
  stats: (hotelId?: string | null) => api.get('/bookings/hotel/stats', scope(hotelId)).then((r) => r.data),
  manual: (body: any, hotelId?: string | null) => api.post('/bookings/hotel', body, scope(hotelId)).then((r) => r.data),
  setStatus: (id: string, body: any) => api.patch(`/bookings/${id}/status`, body).then((r) => r.data),
  setAdvance: (id: string, advanceStatus: string) => api.patch(`/bookings/${id}/advance`, { advanceStatus }).then((r) => r.data),
  setNote: (id: string, body: any) => api.patch(`/bookings/${id}/note`, body).then((r) => r.data),
  reviews: (hotelId?: string | null) => api.get('/bookings/hotel/reviews', scope(hotelId)).then((r) => r.data),
  reply: (id: string, reply: string) => api.patch(`/bookings/reviews/${id}/reply`, { reply }).then((r) => r.data),
  moderate: (id: string, status: string) => api.patch(`/bookings/reviews/${id}/status`, { status }).then((r) => r.data),
};

/* Wishlist: saved hotels live on this device only (the old /tf-wishlist/ page). */
const WL = 'ph-wishlist';
export function getWishlist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WL) || '[]');
  } catch {
    return [];
  }
}
export function toggleWishlist(slug: string): boolean {
  const list = getWishlist();
  const on = !list.includes(slug);
  const next = on ? [slug, ...list].slice(0, 100) : list.filter((s) => s !== slug);
  try {
    localStorage.setItem(WL, JSON.stringify(next));
    window.dispatchEvent(new Event('ph-wishlist'));
  } catch {
    /* private mode */
  }
  return on;
}

/* The guest's own bookings on this device (so "My bookings" works without an account). */
const MB = 'ph-bookings';
export function rememberBooking(ref: string, token: string) {
  try {
    const list: { ref: string; t: string }[] = JSON.parse(localStorage.getItem(MB) || '[]');
    localStorage.setItem(MB, JSON.stringify([{ ref, t: token }, ...list.filter((x) => x.ref !== ref)].slice(0, 30)));
  } catch {
    /* ignore */
  }
}
export function deviceBookings(): { ref: string; t: string }[] {
  try {
    return JSON.parse(localStorage.getItem(MB) || '[]');
  } catch {
    return [];
  }
}

/* ── Things this phone remembers, so the next booking is two taps ── */

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

export interface GuestDetails {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
}
export const getGuest = (): GuestDetails | null => readLS<GuestDetails | null>('ph-guest', null);
export const rememberGuest = (g: GuestDetails) => writeLS('ph-guest', g);

export interface RecentHotel {
  slug: string;
  name: string;
  cityName: string;
  citySlug?: string;
  coverImage: string;
  minPrice: number;
  ratingAvg: number;
  ratingCount: number;
}
export const getRecentHotels = (): RecentHotel[] => readLS<RecentHotel[]>('ph-recent', []);
export function addRecentHotel(h: RecentHotel) {
  writeLS('ph-recent', [h, ...getRecentHotels().filter((x) => x.slug !== h.slug)].slice(0, 10));
}

export interface RecentSearch {
  citySlug?: string;
  label: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  rooms?: number;
}
export const getRecentSearches = (): RecentSearch[] => readLS<RecentSearch[]>('ph-searches', []);
export function addRecentSearch(s: RecentSearch) {
  writeLS('ph-searches', [s, ...getRecentSearches().filter((x) => x.label !== s.label)].slice(0, 5));
}

/* ── Billing: boosts and commission invoices ── */
export const billingApi = {
  mine: (hotelId?: string | null) => api.get('/billing/mine', scope(hotelId)).then((r) => r.data),
  buyBoost: (planId: string, hotelId?: string | null) => api.post(`/billing/boosts/${planId}/buy`, {}, scope(hotelId)).then((r) => r.data),
  invoice: (id: string) => api.get(`/billing/invoices/${id}`).then((r) => r.data),
  pay: (id: string, body: { proofUrl: string; method?: string; note?: string }) => api.post(`/billing/invoices/${id}/payment`, body).then((r) => r.data),
  summary: () => api.get('/billing/admin/summary').then((r) => r.data),
  list: (params: Record<string, any>) => api.get('/billing/admin/invoices', { params }).then((r) => r.data),
  followUps: () => api.get('/billing/admin/follow-ups').then((r) => r.data),
  approve: (id: string) => api.post(`/billing/admin/invoices/${id}/approve`).then((r) => r.data),
  reject: (id: string, reason: string) => api.post(`/billing/admin/invoices/${id}/reject`, { reason }).then((r) => r.data),
  void: (id: string, note: string) => api.post(`/billing/admin/invoices/${id}/void`, { note }).then((r) => r.data),
  note: (id: string, body: { reminded?: boolean; adminNote?: string }) => api.patch(`/billing/admin/invoices/${id}`, body).then((r) => r.data),
  generate: (period: string) => api.post('/billing/admin/generate', { period }).then((r) => r.data),
  boosts: () => api.get('/billing/admin/boosts').then((r) => r.data),
  saveBoost: (id: string | null, body: any) => (id ? api.put(`/billing/admin/boosts/${id}`, body) : api.post('/billing/admin/boosts', body)).then((r) => r.data),
  deleteBoost: (id: string) => api.delete(`/billing/admin/boosts/${id}`).then((r) => r.data),
  dispute: (bookingId: string, decision: 'upheld' | 'rejected') => api.post(`/billing/admin/disputes/${bookingId}`, { decision }).then((r) => r.data),
};
