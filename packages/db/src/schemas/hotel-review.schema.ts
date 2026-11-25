import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HotelReviewDocument = HotelReview & Document;

/**
 * A hotel review. Any signed-in account may write one per hotel; when the
 * account has a finished stay booked through PakHotels the review is tied to
 * that booking and shown as "Stayed here" (verified).
 */
@Schema({ timestamps: true })
export class HotelReview {
  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  /** Set when the reviewer stayed through a PakHotels booking (verified). */
  @Prop({ type: Types.ObjectId, ref: 'Booking', default: undefined })
  booking?: Types.ObjectId;

  /** The account that wrote it — one review per account per hotel. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: undefined, index: true })
  user?: Types.ObjectId;

  @Prop({ required: true })
  guestName: string;

  /** 1–5 overall plus optional parts. */
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Number, default: undefined }) cleanliness?: number;
  @Prop({ type: Number, default: undefined }) staff?: number;
  @Prop({ type: Number, default: undefined }) location?: number;
  @Prop({ type: Number, default: undefined }) value?: number;

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  text: string;

  /** Stay purpose copied from the booking (family, business…). */
  @Prop({ default: '' })
  tripType: string;

  @Prop({ default: '' })
  stayMonth: string;

  /** Where the reviewer is from (ISO alpha-2), shown as "United Kingdom". */
  @Prop({ default: '' })
  country: string;

  /** 'approved' | 'pending' | 'hidden' */
  @Prop({ default: 'approved', index: true })
  status: string;

  @Prop({ default: '' })
  reply: string;

  @Prop({ type: Date })
  repliedAt?: Date;
}

export const HotelReviewSchema = SchemaFactory.createForClass(HotelReview);
HotelReviewSchema.index({ hotel: 1, status: 1, createdAt: -1 });
// One review per booking and one per account per hotel (only where the field is set).
HotelReviewSchema.index({ booking: 1 }, { unique: true, name: 'booking_once', partialFilterExpression: { booking: { $type: 'objectId' } } });
HotelReviewSchema.index({ hotel: 1, user: 1 }, { unique: true, name: 'hotel_user_once', partialFilterExpression: { user: { $type: 'objectId' } } });
