import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomRateDocument = RoomRate & Document;

/**
 * A calendar override for one room type on one night: a different price,
 * fewer rooms on sale, or closed. Nights without a row use the room's
 * defaults.
 */
@Schema({ timestamps: true })
export class RoomRate {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true })
  room: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  /** The night, as YYYY-MM-DD (Pakistan dates — no time zone games). */
  @Prop({ required: true })
  date: string;

  @Prop({ type: Number, default: undefined })
  price?: number;

  /** Rooms on sale that night (overrides the room's quantity). */
  @Prop({ type: Number, default: undefined })
  available?: number;

  @Prop({ default: false })
  closed: boolean;
}

export const RoomRateSchema = SchemaFactory.createForClass(RoomRate);
RoomRateSchema.index({ room: 1, date: 1 }, { unique: true });
