import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * A boost a hotel can buy on its own, like an OLX "Featured ad": one hotel,
 * one placement, a number of days. The admin sets the prices.
 *
 *  top       — above every other hotel in its city and on search pages
 *  featured  — in the homepage's "Featured" rail, with a Featured tag
 */
export const BOOST_PLACEMENTS = ['top', 'featured'] as const;
export type BoostPlacement = (typeof BOOST_PLACEMENTS)[number];

export type BoostPlanDocument = BoostPlan & Document;

@Schema({ timestamps: true, collection: 'boost_plans' })
export class BoostPlan {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, enum: BOOST_PLACEMENTS })
  placement: BoostPlacement;

  @Prop({ required: true, min: 1, max: 365 })
  days: number;

  /** PKR. */
  @Prop({ required: true, min: 0 })
  price: number;

  /** Marked "Best value" on the card. */
  @Prop({ default: false })
  highlight: boolean;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 0 })
  order: number;
}

export const BoostPlanSchema = SchemaFactory.createForClass(BoostPlan);
