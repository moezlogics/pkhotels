/*
 * Countries for guests from abroad: phone codes, passports, and the
 * reviewer's "from". Pakistan first, then where most visitors and overseas
 * Pakistanis come from, then the rest A–Z.
 */

export interface Country {
  iso: string;
  name: string;
  dial: string;
}

const TOP: Country[] = [
  { iso: 'PK', name: 'Pakistan', dial: '92' },
  { iso: 'GB', name: 'United Kingdom', dial: '44' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso: 'US', name: 'United States', dial: '1' },
  { iso: 'CA', name: 'Canada', dial: '1' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'QA', name: 'Qatar', dial: '974' },
  { iso: 'OM', name: 'Oman', dial: '968' },
  { iso: 'KW', name: 'Kuwait', dial: '965' },
  { iso: 'BH', name: 'Bahrain', dial: '973' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'DE', name: 'Germany', dial: '49' },
];

const REST: Country[] = [
  { iso: 'AF', name: 'Afghanistan', dial: '93' },
  { iso: 'AT', name: 'Austria', dial: '43' },
  { iso: 'AZ', name: 'Azerbaijan', dial: '994' },
  { iso: 'BD', name: 'Bangladesh', dial: '880' },
  { iso: 'BE', name: 'Belgium', dial: '32' },
  { iso: 'BR', name: 'Brazil', dial: '55' },
  { iso: 'DK', name: 'Denmark', dial: '45' },
  { iso: 'EG', name: 'Egypt', dial: '20' },
  { iso: 'FI', name: 'Finland', dial: '358' },
  { iso: 'FR', name: 'France', dial: '33' },
  { iso: 'GR', name: 'Greece', dial: '30' },
  { iso: 'HK', name: 'Hong Kong', dial: '852' },
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'ID', name: 'Indonesia', dial: '62' },
  { iso: 'IR', name: 'Iran', dial: '98' },
  { iso: 'IQ', name: 'Iraq', dial: '964' },
  { iso: 'IE', name: 'Ireland', dial: '353' },
  { iso: 'IT', name: 'Italy', dial: '39' },
  { iso: 'JP', name: 'Japan', dial: '81' },
  { iso: 'JO', name: 'Jordan', dial: '962' },
  { iso: 'KZ', name: 'Kazakhstan', dial: '7' },
  { iso: 'KE', name: 'Kenya', dial: '254' },
  { iso: 'KR', name: 'South Korea', dial: '82' },
  { iso: 'KG', name: 'Kyrgyzstan', dial: '996' },
  { iso: 'LB', name: 'Lebanon', dial: '961' },
  { iso: 'MY', name: 'Malaysia', dial: '60' },
  { iso: 'MV', name: 'Maldives', dial: '960' },
  { iso: 'MA', name: 'Morocco', dial: '212' },
  { iso: 'NP', name: 'Nepal', dial: '977' },
  { iso: 'NL', name: 'Netherlands', dial: '31' },
  { iso: 'NZ', name: 'New Zealand', dial: '64' },
  { iso: 'NG', name: 'Nigeria', dial: '234' },
  { iso: 'NO', name: 'Norway', dial: '47' },
  { iso: 'PH', name: 'Philippines', dial: '63' },
  { iso: 'PL', name: 'Poland', dial: '48' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'RU', name: 'Russia', dial: '7' },
  { iso: 'SG', name: 'Singapore', dial: '65' },
  { iso: 'ZA', name: 'South Africa', dial: '27' },
  { iso: 'ES', name: 'Spain', dial: '34' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso: 'SE', name: 'Sweden', dial: '46' },
  { iso: 'CH', name: 'Switzerland', dial: '41' },
  { iso: 'TJ', name: 'Tajikistan', dial: '992' },
  { iso: 'TH', name: 'Thailand', dial: '66' },
  { iso: 'TR', name: 'Türkiye', dial: '90' },
  { iso: 'TM', name: 'Turkmenistan', dial: '993' },
  { iso: 'UZ', name: 'Uzbekistan', dial: '998' },
];

export const COUNTRIES: Country[] = [...TOP, ...REST];
export const TOP_COUNT = TOP.length;

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const countryOf = (iso?: string) => (iso ? BY_ISO.get(iso.toUpperCase()) : undefined);
export const countryName = (iso?: string) => countryOf(iso)?.name ?? '';

/** 🇬🇧 from "GB". */
export function flag(iso?: string): string {
  if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return '';
  return String.fromCodePoint(...iso.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const TZ_COUNTRY: Record<string, string> = {
  'Asia/Karachi': 'PK', 'Europe/London': 'GB', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Muscat': 'OM',
  'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Shanghai': 'CN', 'Asia/Urumqi': 'CN', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE', 'Europe/Oslo': 'NO', 'Europe/Stockholm': 'SE',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'Asia/Kolkata': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Kabul': 'AF', 'Asia/Tehran': 'IR', 'Europe/Istanbul': 'TR', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Singapore': 'SG', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Pacific/Auckland': 'NZ',
};

/**
 * The visitor's own country, or ''. The time zone first — a phone in
 * Pakistan says Asia/Karachi whatever language it is set to (most are set to
 * English, "en-GB"/"en-US") — and the browser language only as a last resort.
 */
export function browserCountry(): string {
  if (typeof navigator === 'undefined') return '';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz]!;
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz.startsWith('America/')) return 'US';
    if (tz) return ''; // a zone we don't map: don't guess from the language
  } catch {
    /* old browsers */
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const m = /-([A-Z]{2})$/i.exec(l || '');
    if (m && BY_ISO.has(m[1]!.toUpperCase())) return m[1]!.toUpperCase();
  }
  return '';
}

/**
 * The same rule as the API: a Pakistani mobile becomes 03xxxxxxxxx, anything
 * else needs its country code and becomes +<digits>. '' when neither.
 */
export function normalizePhone(raw: string): string {
  const s = String(raw || '').trim();
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  else if (d.startsWith('92') && (s.startsWith('+') || s.startsWith('00') || d.length === 12)) d = d.slice(2);
  if (d.length === 10 && d.startsWith('3')) d = '0' + d;
  if (/^03\d{9}$/.test(d)) return d;
  let e = s.replace(/[^\d+]/g, '');
  if (e.startsWith('00')) e = '+' + e.slice(2);
  if (!e.startsWith('+')) return '';
  e = '+' + e.slice(1).replace(/\D/g, '');
  if (e.startsWith('+92')) return '';
  return /^\+[1-9]\d{7,14}$/.test(e) ? e : '';
}

export const isPkMobile = (p: string) => /^03\d{9}$/.test(p);

/** "+447911123456" → "+44 7911 123456"-ish, "03001234567" → "0300 1234567". */
export function prettyPhone(p: string): string {
  if (isPkMobile(p)) return `${p.slice(0, 4)} ${p.slice(4)}`;
  const c = COUNTRIES.filter((x) => p.startsWith('+' + x.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  return c ? `+${c.dial} ${p.slice(c.dial.length + 1)}` : p;
}
