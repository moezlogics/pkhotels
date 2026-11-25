/*
 * Hotel plans (one hotel per account; plans add benefits, never more hotels) — one shape for every place they appear: the homepage, the
 * /packages page, the dashboard's "Buy a Plan", and the admin's package form.
 * The numbers and switches are what the API enforces; `features` is the
 * admin's wording for the card.
 */

export interface Plan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  propertyLimit: number;
  featuredListings: number;
  photosPerProperty?: number;
  features: string[];
  isActive?: boolean;
  verifiedBadge?: boolean;
  teamMembers?: number;
  socialLinks?: boolean;
  brandedProfile?: boolean;
  autoPublish?: boolean;
  spotlight?: boolean;
  highlight?: boolean;
  /** A public profile page with a share link (older packages: on). */
  profilePage?: boolean;
  /* PakHotels */
  maxRoomTypes?: number;
  monthlyBookings?: number;
  showContact?: boolean;
  advancePayments?: boolean;
  rateCalendar?: boolean;
  instantConfirm?: boolean;
  featuredHotel?: boolean;
  deals?: boolean;
  videoTour?: boolean;
  insights?: string;
  placement?: number;
  prioritySupport?: boolean;
  /** % of completed PakHotels bookings billed monthly (0 = none). */
  commissionPercent?: number;
}

/** "Rs 5,000 / month", "Free". */
export function planPrice(p: Pick<Plan, 'price' | 'duration'>): { amount: string; per: string } {
  if (!p.price) return { amount: 'Free', per: '' };
  const per = p.duration === 30 || p.duration === 31 ? 'month' : p.duration === 365 ? 'year' : `${p.duration} days`;
  return { amount: `Rs ${p.price.toLocaleString('en-PK')}`, per };
}

/** The switches a plan turns on, as short labels for badges. */
export const PERK_LABELS: { key: keyof Plan; label: string; hint: string }[] = [
  { key: 'verifiedBadge', label: 'Verified badge', hint: 'On your hotel page and in search results' },
  { key: 'showContact', label: 'Your phone & WhatsApp', hint: 'Guests can call or WhatsApp you from your hotel page' },
  { key: 'instantConfirm', label: 'Instant confirmation', hint: 'Bookings confirm themselves' },
  { key: 'featuredHotel', label: 'Featured', hint: 'Top of your city and on the homepage' },
  { key: 'deals', label: 'Deals badge', hint: '"Hot deal" with your discount' },
];

/** "1 month", "1 year", "45 days" — the free plan's is per listing (renewed for free). */
export function planDuration(p: Pick<Plan, 'price' | 'duration'>): string {
  if (!p.price) return 'Always free';
  if (p.duration === 30 || p.duration === 31) return '1 month';
  if (p.duration === 365) return '1 year';
  return `${p.duration} days`;
}

export interface PlanBenefit {
  /** Stable id, for comparison rows and React keys. */
  key: string;
  on: boolean;
  label: string;
  hint: string;
  /** Row title in the comparison table. */
  row: string;
  /** A number/word for the comparison table instead of a tick. */
  value?: string;
}

/**
 * What a plan gives, worked out from the same fields the API enforces
 * (HotelPlanService / BookingService), so a card never promises what the
 * plan does not do. Every place that shows a plan uses this list.
 */
export function planBenefits(p: Plan): PlanBenefit[] {
  const rooms = p.maxRoomTypes ?? 3;
  const bookings = p.monthlyBookings ?? 15;
  const placement = p.placement ?? 0;
  const insights = p.insights || 'none';
  const commission = Math.max(0, Number(p.commissionPercent) || 0);
  return [
    { key: 'commission', row: 'Commission on completed stays', on: true, value: `${commission}%`, label: commission ? `${commission}% only on completed stays` : '0% commission — every booking is yours', hint: commission ? 'Billed once a month. Nothing on cancellations or no-shows' : 'No cut of your room price' },
    { key: 'bookings', row: 'Online booking requests', on: true, value: bookings && !commission ? `${bookings} / month` : 'Unlimited', label: bookings && !commission ? `${bookings} online bookings a month` : 'Unlimited online bookings', hint: 'With the guest’s name, phone and WhatsApp' },
    { key: 'rooms', row: 'Room types', on: true, value: rooms ? String(rooms) : 'Unlimited', label: rooms ? `Up to ${rooms} room types` : 'Unlimited room types', hint: 'Each with its own price, photos and number of rooms' },
    { key: 'photos', row: 'Photos', on: true, value: String(p.photosPerProperty || 10), label: `${p.photosPerProperty || 10} photos${p.videoTour ? ' + video tour' : ''}`, hint: 'Hotel and room photos' },
    { key: 'contact', row: 'Your phone & WhatsApp on the listing', on: !!p.showContact, label: 'Your phone & WhatsApp on your page', hint: 'Guests can also call you directly' },
    { key: 'advance', row: 'Advance to your own account', on: !!p.advancePayments, label: 'Take advances to your bank / JazzCash', hint: 'Cut no-shows: guests send an advance straight to you' },
    { key: 'calendar', row: 'Seasonal prices & calendar', on: !!p.rateCalendar, label: 'Seasonal prices & availability calendar', hint: 'Eid, summer and weekend rates; close dates when full' },
    { key: 'instant', row: 'Instant confirmation', on: !!p.instantConfirm, label: 'Instant confirmation', hint: 'Bookings confirm themselves — guests book more' },
    { key: 'verified', row: 'Verified badge', on: !!p.verifiedBadge, label: 'Verified badge', hint: 'On your page and in search results' },
    { key: 'placement', row: 'Placement in search', on: placement > 0, value: placement >= 2 ? 'Top' : placement === 1 ? 'Above Free' : 'Standard', label: placement >= 2 ? 'Top of your city & search pages' : placement === 1 ? 'Listed above Free hotels' : 'Standard placement', hint: 'Where your hotel appears in its city' },
    { key: 'featured', row: 'Featured on homepage', on: !!p.featuredHotel, label: 'Featured on the homepage', hint: 'With a Featured tag across the site' },
    { key: 'deals', row: 'Deals badge', on: !!p.deals, label: '"Hot deal" discount badge', hint: 'Show your discount on every card' },
    { key: 'insights', row: 'Insights', on: insights !== 'none', value: insights === 'full' ? 'Full' : insights === 'basic' ? 'Basic' : undefined, label: insights === 'full' ? 'Full booking & views insights' : insights === 'basic' ? 'Booking insights' : 'Insights', hint: 'Views, bookings and revenue' },
    { key: 'support', row: 'Priority support', on: !!p.prioritySupport, label: 'Priority support', hint: 'A person to call when you need help' },
  ];
}

/** What every plan has, Free included — shown once instead of on every card. */
export function sharedBenefits(): string[] {
  return [
    'Free to list — no setup fee',
    'Your hotel page with rooms, photos and reviews',
    'Booking requests on your phone — confirm in one tap',
    'Guest name, phone and WhatsApp with every booking',
    'Verified reviews from guests who stayed',
    'Add walk-in and phone bookings to keep rooms right',
  ];
}

export function perksOf(p: Plan): string[] {
  return PERK_LABELS.filter(({ key }) => (key === 'teamMembers' ? (p.teamMembers ?? 0) > 0 : Boolean(p[key]))).map(({ key, label }) =>
    key === 'teamMembers' ? `${p.teamMembers} ${label.toLowerCase()}` : label,
  );
}
