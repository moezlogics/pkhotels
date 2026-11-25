import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HotelClaimDocument = HotelClaim & Document;

/** "This is my hotel" — an owner asking to manage an unclaimed listing. */
@Schema({ timestamps: true })
export class HotelClaim {
  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  phone: string;

  /** Owner, manager, staff… */
  @Prop({ default: '' })
  role: string;

  @Prop({ default: '' })
  message: string;

  /** Proof: a photo of a utility bill, visiting card, registration… */
  @Prop({ default: '' })
  proofUrl: string;

  /** 'pending' | 'approved' | 'rejected' */
  @Prop({ default: 'pending', index: true })
  status: string;

  @Prop({ default: '' })
  adminNote: string;
}

export const HotelClaimSchema = SchemaFactory.createForClass(HotelClaim);
