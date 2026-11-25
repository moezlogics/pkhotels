import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from '@pakhotels/db/schemas/subscription.schema';
import { Package, PackageSchema } from '@pakhotels/db/schemas/package.schema';
import { Property, PropertySchema } from '@pakhotels/db/schemas/property.schema';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { AgencyModule } from '../agency/agency.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Package.name, schema: PackageSchema },
      // Read-only here: counts a free user's live listings against the free tier.
      { name: Property.name, schema: PropertySchema },
    ]),
    AgencyModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
