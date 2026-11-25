import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '@pakhotels/db/schemas/user.schema';
import { Subscription, SubscriptionSchema } from '@pakhotels/db/schemas/subscription.schema';
import { Package, PackageSchema } from '@pakhotels/db/schemas/package.schema';
import { AgencyService } from './agency.service';

/** Agency membership and the verified badge — imported by every module that needs them. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Package.name, schema: PackageSchema },
    ]),
  ],
  providers: [AgencyService],
  exports: [AgencyService],
})
export class AgencyModule {}
