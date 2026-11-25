import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * What a hotel owes PakHotels, other than its plan (plans keep their own
 * invoices on Subscription):
 *
 *  boost       — a boost the hotel bought; it starts when the payment is verified
 *  commission  — last month's completed PakHotels bookings × the plan's rate
 *
 * There is no card gateway. The hotel sends the money to one of the admin's
 * accounts (Payment methods), uploads the screenshot, and an admin verifies
 * it — the same flow as plan invoices.
 *
 * status
 *  unpaid     — issued, nothing sent yet
 *  submitted  — the hotel uploaded proof; admin's turn
 *  paid       — verified
 *  rejected   — admin could not verify it (see rejectionReason); hotel re-sends
 *  void       — cancelled by an admin (written off, or the boost was dropped)
 */
export const INVOICE_KINDS = ['boost', 'commission'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];
export const INVOICE_STATUSES = ['unpaid', 'submitted', 'paid', 'rejected', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceLine {
  label: string;
  /** Booking reference, for commission lines. */
  ref?: string;
  /** Stay dates, for commission lines. */
  dates?: string;
  /** Booking total the commission was worked out on. */
  base?: number;
  percent?: number;
  amount: number;
}

export type BillingInvoiceDocument = BillingInvoice & Document;

@Schema({ timestamps: true, collection: 'billing_invoices' })
export class BillingInvoice {
  /** INV-… — the reference the hotel writes on the transfer. */
  @Prop({ required: true, unique: true })
  number: string;

  @Prop({ type: String, required: true, enum: INVOICE_KINDS, index: true })
  kind: InvoiceKind;

  @Prop({ type: Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, default: undefined })
  owner?: Types.ObjectId;

  /** Snapshots, so the invoice still reads right if the hotel is renamed. */
  @Prop({ default: '' })
  hotelName: string;

  @Prop({ default: '' })
  cityName: string;

  /** Commission: the month billed, "2026-10". One invoice per hotel per month. */
  @Prop({ default: '' })
  period: string;

  @Prop({ type: [{ label: String, ref: String, dates: String, base: Number, percent: Number, amount: Number, _id: false }], default: [] })
  lines: InvoiceLine[];

  /** PKR. */
  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ type: String, enum: INVOICE_STATUSES, default: 'unpaid', index: true })
  status: InvoiceStatus;

  @Prop({ type: Date, required: true, index: true })
  dueDate: Date;

  /* ── Boost ── */

  @Prop({ type: Types.ObjectId, ref: 'BoostPlan', default: undefined })
  boostPlan?: Types.ObjectId;

  @Prop({ type: String, default: '' })
  boostPlacement: '' | 'top' | 'featured';

  @Prop({ default: 0 })
  boostDays: number;

  /** Filled when the payment is verified and the boost starts. */
  @Prop({ type: Date }) boostStart?: Date;
  @Prop({ type: Date }) boostEnd?: Date;

  /* ── Payment ── */

  @Prop({ default: '' }) paymentMethod: string;
  @Prop({ default: '' }) paymentNote: string;
  @Prop({ default: '' }) proofUrl: string;
  @Prop({ type: Date }) submittedAt?: Date;
  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ default: '' }) rejectionReason: string;
  @Prop({ type: Types.ObjectId, ref: 'User', default: undefined }) reviewedBy?: Types.ObjectId;

  /* ── Follow-up (the admin's collection list) ── */

  /** Last time an admin (or the system) reminded the hotel. */
  @Prop({ type: Date }) lastReminderAt?: Date;
  @Prop({ default: 0 }) reminders: number;
  /** Admin-only notes: "promised Friday", "owner abroad till 10th". */
  @Prop({ default: '' }) adminNote: string;
}

export const BillingInvoiceSchema = SchemaFactory.createForClass(BillingInvoice);
BillingInvoiceSchema.index({ hotel: 1, kind: 1, period: 1 }, { unique: true, name: 'commission_once_per_month', partialFilterExpression: { kind: 'commission' } });
BillingInvoiceSchema.index({ status: 1, dueDate: 1 });
