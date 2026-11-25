import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from '@pakhotels/db/schemas/hotel.schema';
import { Booking, BookingSchema } from '@pakhotels/db/schemas/booking.schema';
import { BoostPlan, BoostPlanSchema } from '@pakhotels/db/schemas/boost-plan.schema';
import { BillingInvoice, BillingInvoiceSchema } from '@pakhotels/db/schemas/billing-invoice.schema';
import { Subscription, SubscriptionSchema } from '@pakhotels/db/schemas/subscription.schema';
import { PaymentMethod, PaymentMethodSchema } from '@pakhotels/db/schemas/payment-method.schema';
import { HotelModule } from '../hotel/hotel.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { PushModule } from '../push/push.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/** Boosts and monthly commission invoices (the hybrid revenue model). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: BoostPlan.name, schema: BoostPlanSchema },
      { name: BillingInvoice.name, schema: BillingInvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: PaymentMethod.name, schema: PaymentMethodSchema },
    ]),
    HotelModule,
    SiteSettingsModule,
    PushModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
