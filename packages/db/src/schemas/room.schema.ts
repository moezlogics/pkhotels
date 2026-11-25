import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

/**
 * A room type of a hotel ("Deluxe Double Room") with how many such rooms the
 * hotel has. Bookings take rooms of a type for a range of nights.
 */
@Schema({ timestamps: true })
export class Room {
  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  /** e.g. "1 King bed", "2 Single beds". */
  @Prop({ default: '' })
  bedType: string;

  @Prop({ default: 1 })
  beds: number;

  @Prop({ default: 2 })
  maxAdults: number;

  @Prop({ default: 0 })
  maxChildren: number;

  /** sq ft, 0 = not stated */
  @Prop({ default: 0 })
  size: number;

  /** Base price per night in PKR. */
  @Prop({ required: true, min: 0 })
  price: number;

  /** Optional price on Friday and Saturday nights (0 = same as base). */
  @Prop({ default: 0 })
  weekendPrice: number;

  /** "Was" price shown struck through (0 = none). */
  @Prop({ default: 0 })
  originalPrice: number;

  /** How many rooms of this type the hotel has. */
  @Prop({ default: 1, min: 0 })
  quantity: number;

  @Prop({ default: false })
  breakfastIncluded: boolean;

  @Prop({ default: true })
  refundable: boolean;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: 1 })
  minNights: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sort: number;

  /** The old /tf_room/<slug>/ address, redirected to the hotel page. */
  @Prop({ index: true, sparse: true })
  wpSlug?: string;

  @Prop({ type: Number, default: undefined })
  wpId?: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
RoomSchema.index({ hotel: 1, isActive: 1, sort: 1 });
