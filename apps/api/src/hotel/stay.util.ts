import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

/** Dates are plain YYYY-MM-DD strings in Pakistan time. */
const DAY = 86_400_000;
export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;

/** Today in Pakistan (UTC+5, no DST). */
export function todayPk(): string {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
}

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

export function addDays(d: string, n: number): string {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

/** The nights of a stay: check-in up to (not including) check-out. */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const n = diffDays(checkIn, checkOut);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(checkIn, i));
}

/** Friday and Saturday nights cost the weekend price (Pakistan's weekend is Sat–Sun). */
export function isWeekendNight(d: string): boolean {
  const wd = new Date(d + 'T00:00:00Z').getUTCDay();
  return wd === 5 || wd === 6;
}

/** Validates a stay and returns its nights. Throws a 400 a guest can read. */
export function parseStay(checkIn: unknown, checkOut: unknown): { checkIn: string; checkOut: string; nights: string[] } {
  if (!isDate(checkIn) || !isDate(checkOut)) throw new BadRequestException('Please choose check-in and check-out dates.');
  const today = todayPk();
  if (checkIn < today) throw new BadRequestException('Check-in cannot be in the past.');
  if (diffDays(today, checkIn) > MAX_ADVANCE_DAYS) throw new BadRequestException('Bookings open up to one year ahead.');
  const nights = nightsOf(checkIn, checkOut);
  if (nights.length < 1) throw new BadRequestException('Check-out must be after check-in.');
  if (nights.length > MAX_NIGHTS) throw new BadRequestException(`Online bookings are up to ${MAX_NIGHTS} nights. Contact the hotel for longer stays.`);
  return { checkIn, checkOut, nights };
}

/** Optional stay in a search: returns null when the dates are missing or unusable. */
export function maybeStay(checkIn: unknown, checkOut: unknown) {
  try {
    if (!checkIn || !checkOut) return null;
    return parseStay(checkIn, checkOut);
  } catch {
    return null;
  }
}

/** 03001234567 from "+92 300 1234567", "0300-1234567", "923001234567". Empty when it is not a Pakistani mobile. */
export function normalizePkMobile(raw: unknown): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  if (d.startsWith('92')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  return /^03\d{9}$/.test(d) ? d : '';
}

/**
 * Any mobile number a guest may give: a Pakistani one becomes 03xxxxxxxxx (as
 * before); a foreign one must carry its country code and becomes +<digits>
 * (E.164, 8–15 digits). Returns '' when it is neither.
 */
export function normalizePhone(raw: unknown): string {
  const s = String(raw ?? '').trim();
  const pk = normalizePkMobile(s);
  if (pk) return pk;
  let d = s.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (!d.startsWith('+')) return '';
  d = '+' + d.slice(1).replace(/\D/g, '');
  if (d.startsWith('+92')) return '';
  return /^\+[1-9]\d{7,14}$/.test(d) ? d : '';
}

export const isPkMobile = (p: string) => /^03\d{9}$/.test(p);

const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newBookingRef(): string {
  const b = randomBytes(6);
  return 'PH-' + Array.from(b, (x) => REF_ALPHABET[x % REF_ALPHABET.length]).join('');
}

export function newToken(): string {
  return randomBytes(18).toString('hex');
}

export function slugify(t: string): string {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
