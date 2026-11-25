import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

export const BOOKING_STATUSES = [
  'pending', // waiting for the hotel
  'confirmed', // hotel accepted (or instant confirmation)
  'checked_in',
  'completed', // stayed and left
  'declined', // hotel said no
  'cancelled', // by the guest or the hotel
  'no_show',
  'expired', // hotel did not answer in time
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that hold rooms. */
export const HOLDING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in'];

/**
 * A room reservation. There is no online payment: the guest pays at the
 * hotel, or sends an advance straight to the hotel's own account and uploads
 * the proof. PakHotels never holds money; when the hotel's plan carries a
 * commission, completed web bookings are billed to the hotel each month.
 */
@Schema({ timestamps: true })
export class Booking {
  /** Public reference, e.g. PH-7K2M4Q. */
  @Prop({ required: true, unique: true })
  ref: string;

  /** Secret for the guest's manage link (no account needed). */
  @Prop({ required: true, select: false })
  token: string;

  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  /** Snapshot so the booking reads the same if the hotel is edited later. */
  @Prop({ default: '' })
  hotelName: string;

  @Prop({ default: '' })
  hotelSlug: string;

  @Prop({ default: '' })
  cityName: string;

  /** Hotel owner at the time of booking (empty = unclaimed hotel, admin handles it). */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, default: undefined })
  owner?: Types.ObjectId;

  /** Signed-in guest, if any. */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, default: undefined })
  user?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  guestName: string;

  /** Normalised 03xxxxxxxxx. */
  @Prop({ required: true, index: true })
  guestPhone: string;

  @Prop({ default: '', lowercase: true, trim: true })
  guestEmail: string;

  @Prop({ default: '' })
  guestCity: string;

  /** YYYY-MM-DD */
  @Prop({ required: true, index: true })
  checkIn: string;

  @Prop({ required: true })
  checkOut: string;

  @Prop({ required: true })
  nights: number;

  @Prop({ default: 1 })
  adults: number;

  @Prop({ default: 0 })
  children: number;

  @Prop({
    type: [
      {
        room: { type: Types.ObjectId, ref: 'Room' },
        name: String,
        qty: Number,
        /** Price of each night for one room, in order. */
        nightly: [Number],
        subtotal: Number,
      },
    ],
    default: [],
  })
  rooms: { room: Types.ObjectId; name: string; qty: number; nightly: number[]; subtotal: number }[];

  @Prop({ default: 0 })
  extraBeds: number;

  @Prop({ default: 0 })
  extrasTotal: number;

  @Prop({ default: 0 })
  tax: number;

  @Prop({ required: true })
  total: number;

  /** Rooms in the booking (sum of qty) — for quick availability counts. */
  @Prop({ default: 1 })
  roomCount: number;

  /** 'family' | 'business' | 'couple' | 'friends' | 'solo' */
  @Prop({ default: '' })
  purpose: string;

  @Prop({ default: '' })
  arrivalTime: string;

  @Prop({ default: '' })
  specialRequests: string;

  @Prop({ enum: BOOKING_STATUSES, default: 'pending', index: true })
  status: BookingStatus;

  /** 'pay_at_hotel' | 'advance' */
  @Prop({ default: 'pay_at_hotel' })
  paymentMode: string;

  @Prop({ default: 0 })
  advanceAmount: number;

  /** 'none' | 'submitted' | 'received' | 'rejected' */
  @Prop({ default: 'none' })
  advanceStatus: string;

  @Prop({ default: '' })
  advanceMethod: string;

  @Prop({ default: '' })
  advanceProofUrl: string;

  @Prop({ default: '' })
  advanceNote: string;

  /** 'web' | 'dashboard' (added by the hotel for a walk-in / phone booking) */
  @Prop({ default: 'web' })
  source: string;

  /** Note for the guest from the hotel (shown on the manage page). */
  @Prop({ default: '' })
  hotelNote: string;

  /** Private note for the hotel. */
  @Prop({ default: '' })
  internalNote: string;

  @Prop({ default: '' })
  cancelReason: string;

  /** When a pending request expires if the hotel does not answer. */
  @Prop({ type: Date, index: true })
  expiresAt?: Date;

  @Prop({ type: [{ status: String, at: Date, by: String, note: String }], default: [] })
  history: { status: string; at: Date; by: string; note?: string }[];

  @Prop({ default: false })
  reviewed: boolean;

  /* ── Guests from abroad ── */

  /** The guest's country (ISO 3166 alpha-2), 'PK' for Pakistanis. */
  @Prop({ default: 'PK' })
  guestCountry: string;

  /** A foreign passport holder (police registration, passport + visa at check-in). */
  @Prop({ default: false, index: true })
  guestForeign: boolean;

  /** Booked by someone else for this guest (an overseas son booking for his parents). */
  @Prop({ default: '' })
  bookerName: string;

  @Prop({ default: '' })
  bookerPhone: string;

  /* ── Commission (hybrid plans) ── */

  /** The hotel's commission rate when the booking was made (snapshot). */
  @Prop({ default: 0 })
  commissionPercent: number;

  /** Worked out when the stay completes: total × rate. */
  @Prop({ default: 0 })
  commissionAmount: number;

  /** The monthly invoice that billed this booking. */
  @Prop({ type: Types.ObjectId, ref: 'BillingInvoice', default: undefined, index: true })
  invoice?: Types.ObjectId;

  /**
   * The guest says they did stay, after the hotel marked the booking
   * cancelled or no-show. Admin decides; this is how missed commission and
   * fake no-shows get caught.
   */
  @Prop({ type: String, default: '' })
  stayDispute: '' | 'open' | 'upheld' | 'rejected';

  @Prop({ default: '' })
  stayDisputeNote: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ hotel: 1, status: 1, checkIn: 1 });
BookingSchema.index({ hotel: 1, checkIn: 1, checkOut: 1 });
BookingSchema.index({ owner: 1, createdAt: -1 });
BookingSchema.index({ status: 1, expiresAt: 1 });
// The monthly invoice run: completed, commissionable, not yet billed.
BookingSchema.index({ status: 1, commissionPercent: 1, invoice: 1, checkOut: 1 });
