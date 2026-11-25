import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PackageDocument = Package & Document;

@Schema({ timestamps: true })
export class Package {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  price: number; // PKR

  @Prop({ required: true })
  duration: number; // Duration in days

  @Prop({ required: true })
  propertyLimit: number; // Max properties allowed

  @Prop({ default: 0 })
  featuredListings: number; // Number of featured listings

  @Prop({ default: 5 })
  photosPerProperty: number; // Max photos per property

  @Prop({ default: true })
  isActive: boolean; // Whether package can be purchased

  @Prop({ type: [String], default: [] })
  features: string[]; // Additional features list

  /* ── Benefits the site actually enforces (all off unless set) ── */

  /** "Verified" badge on the agent's profile, listings and listing cards. */
  @Prop({ default: false })
  verifiedBadge: boolean;

  /** Agent accounts the owner can create under their agency (0 = none). */
  @Prop({ default: 0 })
  teamMembers: number;

  /** Facebook, Instagram, YouTube, TikTok, LinkedIn and website links on the profile. */
  @Prop({ default: false })
  socialLinks: boolean;

  /** Cover photo and agency branding on the profile page. */
  @Prop({ default: false })
  brandedProfile: boolean;

  /** New listings go live at once instead of waiting for review. */
  @Prop({ default: false })
  autoPublish: boolean;

  /** Shown in "Verified agencies" on the homepage and at the top of the agents list. */
  @Prop({ default: false })
  spotlight: boolean;

  /** Marked "Most popular" on the pricing cards. */
  @Prop({ default: false })
  highlight: boolean;

  /**
   * A public agent profile page (/agents/<name>-<id>) with a share link, and
   * the links to it from the account's listings. Off: no page, no link.
   */
  @Prop({ default: true })
  profilePage: boolean;

  /* ── PakHotels: what a hotel's plan unlocks (one hotel per account) ── */

  /** Room types the hotel may list (0 = unlimited). */
  @Prop({ default: 3 })
  maxRoomTypes: number;

  /** Online booking requests per calendar month (0 = unlimited). */
  @Prop({ default: 15 })
  monthlyBookings: number;

  /** The hotel's own phone / WhatsApp on its public page. */
  @Prop({ default: false })
  showContact: boolean;

  /** Guests may send an advance to the hotel's own accounts. */
  @Prop({ default: false })
  advancePayments: boolean;

  /** Per-date prices, closing dates and rooms on sale. */
  @Prop({ default: false })
  rateCalendar: boolean;

  /** Bookings confirm themselves without the hotel's approval. */
  @Prop({ default: false })
  instantConfirm: boolean;

  /** Featured on the homepage and at the top of city/search pages. */
  @Prop({ default: false })
  featuredHotel: boolean;

  /** "Hot deal" badge with a discount. */
  @Prop({ default: false })
  deals: boolean;

  /** Video tour on the hotel page. */
  @Prop({ default: false })
  videoTour: boolean;

  /** 'none' | 'basic' | 'full' insights. */
  @Prop({ default: 'none' })
  insights: string;

  /** Placement weight in listings: 0 free, 1 standard, 2 premium. */
  @Prop({ default: 0 })
  placement: number;

  @Prop({ default: false })
  prioritySupport: boolean;

  /**
   * % of every completed booking that came through PakHotels, billed to the
   * hotel once a month (0 = no commission). The hybrid model: Free hotels
   * pay per booking, paid plans pay less or nothing.
   */
  @Prop({ default: 0, min: 0, max: 50 })
  commissionPercent: number;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
