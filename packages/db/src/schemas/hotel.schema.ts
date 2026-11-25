import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HotelDocument = Hotel & Document;

export interface HotelPerks {
  plan: string;
  placement: number;
  featured: boolean;
  verified: boolean;
  showContact: boolean;
  advancePayments: boolean;
  rateCalendar: boolean;
  instantConfirm: boolean;
  deals: boolean;
  videoTour: boolean;
  insights: string;
  maxRoomTypes: number;
  photos: number;
  monthlyBookings: number;
  autoPublish: boolean;
  /** % of each completed PakHotels booking billed to the hotel monthly (0 = none). */
  commissionPercent?: number;
  /** A paid "Top of city" boost is running. */
  boostTop?: boolean;
  /** A paid "Homepage featured" boost is running. */
  boostFeatured?: boolean;
}

/**
 * One hotel (or guest house / resort / apartment building) on PakHotels.
 *
 * `slug` is the public address (/hotels/<slug>/) and must never change once a
 * hotel is live: the 166 hotels imported from the WordPress site keep the
 * slugs they ranked with.
 */
@Schema({ timestamps: true })
export class Hotel {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  /** Hotel, guest house, resort, apartment, motel, hostel… */
  @Prop({ default: 'hotel', index: true })
  propertyType: string;

  /** 0 = unrated, 1–5 stars. */
  @Prop({ default: 0, min: 0, max: 5 })
  stars: number;

  @Prop({ default: '' })
  shortDescription: string;

  /** Rich text (HTML). */
  @Prop({ default: '' })
  description: string;

  /* ── Location ── */

  @Prop({ type: Types.ObjectId, ref: 'City', index: true })
  city?: Types.ObjectId;

  @Prop({ index: true, lowercase: true, trim: true })
  citySlug: string;

  @Prop({ trim: true })
  cityName: string;

  @Prop({ type: Types.ObjectId, ref: 'Area', default: undefined })
  area?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  areaName?: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ type: Number, default: undefined })
  lat?: number;

  @Prop({ type: Number, default: undefined })
  lng?: number;

  @Prop({ type: [{ title: String, distance: String }], default: [] })
  nearby: { title: string; distance: string }[];

  /* ── Media ── */

  @Prop({ default: '' })
  coverImage: string;

  @Prop({ type: [String], default: [] })
  gallery: string[];

  @Prop({ default: '' })
  videoUrl?: string;

  /* ── Amenities & policies ── */

  /** Keys from the amenity list (web: lib/hotel-amenities.ts), e.g. "wifi", "generator". */
  @Prop({ type: [String], default: [], index: true })
  amenities: string[];

  @Prop({ default: '14:00' })
  checkInTime: string;

  @Prop({ default: '12:00' })
  checkOutTime: string;

  /** CNIC / passport required at check-in. */
  @Prop({ default: true })
  idRequired: boolean;

  /** 'family_only' | 'couples_with_nikah' | 'couples_allowed' | 'not_stated' */
  @Prop({ default: 'couples_with_nikah' })
  couplePolicy: string;

  @Prop({ default: true })
  childrenAllowed: boolean;

  @Prop({ default: false })
  petsAllowed: boolean;

  @Prop({ default: false })
  smokingAllowed: boolean;

  /** 'free' | 'flexible' | 'non_refundable' and the hours before check-in for free cancellation. */
  @Prop({ default: 'free' })
  cancellationPolicy: string;

  @Prop({ default: 24 })
  freeCancelHours: number;

  /** Free text shown under "House rules" / terms. */
  @Prop({ default: '' })
  policies: string;

  /** Prices include tax? Otherwise "+ x% tax" is shown. */
  @Prop({ default: true })
  taxIncluded: boolean;

  @Prop({ default: 0 })
  taxPercent: number;

  @Prop({ default: 0 })
  extraBedPrice: number;

  @Prop({ type: [{ q: String, a: String }], default: [] })
  faqs: { q: string; a: string }[];

  /* ── Contact (shown publicly only on paid plans) ── */

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  whatsapp: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  website: string;

  /* ── Booking settings ── */

  /** Accept online booking requests at all. */
  @Prop({ default: true })
  acceptsBookings: boolean;

  /** Confirm bookings without the hotel's approval (needs the plan perk). */
  @Prop({ default: false })
  instantConfirm: boolean;

  /** Hours a pending request waits for the hotel before it expires. */
  @Prop({ default: 12 })
  responseHours: number;

  /** 'none' | 'optional' | 'required' — advance sent straight to the hotel's accounts. */
  @Prop({ default: 'none' })
  advanceMode: string;

  /** Advance as % of the total (when advanceMode is optional/required). */
  @Prop({ default: 25 })
  advancePercent: number;

  /** The hotel's own accounts for advances. PakHotels never holds the money. */
  @Prop({
    type: [{ kind: String, title: String, accountName: String, accountNumber: String, iban: String }],
    default: [],
  })
  paymentAccounts: { kind: string; title: string; accountName: string; accountNumber: string; iban?: string }[];

  /* ── Ownership & status ── */

  /** Owner account. Empty = unclaimed (imported) — bookings go to the admin. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, default: undefined })
  owner?: Types.ObjectId;

  /** 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended' */
  @Prop({ default: 'pending', index: true })
  status: string;

  @Prop({ default: '' })
  rejectionReason?: string;

  /** Set by the admin (Premium plans get it automatically). */
  @Prop({ default: false, index: true })
  featured: boolean;

  /** Shown with a verified badge (paid plans, or set by the admin). */
  @Prop({ default: false })
  verified: boolean;

  /** "Hot deal" label + % off, Premium only. */
  @Prop({ default: '' })
  dealText: string;

  @Prop({ default: 0 })
  dealPercent: number;

  /** Placement weight: 2 premium, 1 standard, 0 free — set from the owner's plan. */
  @Prop({ default: 0, index: true })
  rank: number;

  /**
   * Snapshot of what the owner's plan unlocks, refreshed by HotelPlanService
   * (on dashboard visits and every few minutes) so public pages never have to
   * look up subscriptions.
   */
  @Prop({ type: Object, default: undefined })
  perks?: HotelPerks;

  /* ── Guests from abroad ── */

  /**
   * Whether the hotel may host foreign passport holders ('yes' | 'no' | ''
   * not stated). Many Pakistani guest houses are not registered to; a
   * foreigner turned away at the desk is the worst booking there is.
   */
  @Prop({ default: '' })
  acceptsForeigners: string;

  /** The hotel files the foreigner's police registration (Form C) itself. */
  @Prop({ default: false })
  foreignerRegistration: boolean;

  /** Languages the front desk speaks: 'en', 'ur', 'pa', 'ps', 'sd', 'ar', 'zh'… */
  @Prop({ type: [String], default: [] })
  languages: string[];

  /** Nearest airport and how far it is. */
  @Prop({ default: '' })
  airportName: string;

  @Prop({ default: 0 })
  airportKm: number;

  @Prop({ default: false })
  airportPickup: boolean;

  /** PKR per trip; 0 = free (when airportPickup is on). */
  @Prop({ default: 0 })
  airportPickupPrice: number;

  /* ── Paid boosts (bought one at a time, OLX style) ── */

  /** "Top of city": listed above every other hotel in its city until then. */
  @Prop({ type: Date, default: undefined })
  boostTopUntil?: Date;

  /** "Homepage featured": in the homepage's featured rail until then. */
  @Prop({ type: Date, default: undefined })
  boostFeaturedUntil?: Date;

  /**
   * Online booking paused because a commission invoice is long overdue.
   * Set and cleared by BillingService; the listing itself stays visible.
   */
  @Prop({ default: false })
  billingHold: boolean;

  /* ── Denormalised for listings ── */

  /** Lowest active room price per night. */
  @Prop({ default: 0, index: true })
  minPrice: number;

  @Prop({ default: 0 })
  roomTypes: number;

  @Prop({ default: 0 })
  ratingAvg: number;

  @Prop({ default: 0 })
  ratingCount: number;

  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  bookingsCount: number;

  /* ── SEO ── */

  @Prop({ default: '' })
  metaTitle: string;

  @Prop({ default: '' })
  metaDescription: string;

  /** Where it came from: 'wordpress' for the imported hotels. */
  @Prop({ default: '' })
  source?: string;

  @Prop({ type: Number, default: undefined, index: true, sparse: true })
  wpId?: number;
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);

HotelSchema.index({ status: 1, citySlug: 1, rank: -1, featured: -1, ratingAvg: -1 });
HotelSchema.index({ status: 1, featured: -1, rank: -1 });
HotelSchema.index({ name: 'text', cityName: 'text', areaName: 'text', address: 'text' });
