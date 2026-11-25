import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hotel, HotelSchema } from '@pakhotels/db/schemas/hotel.schema';
import { Room, RoomSchema } from '@pakhotels/db/schemas/room.schema';
import { RoomRate, RoomRateSchema } from '@pakhotels/db/schemas/room-rate.schema';
import { Booking, BookingSchema } from '@pakhotels/db/schemas/booking.schema';
import { HotelReview, HotelReviewSchema } from '@pakhotels/db/schemas/hotel-review.schema';
import { HotelClaim, HotelClaimSchema } from '@pakhotels/db/schemas/hotel-claim.schema';
import { City, CitySchema } from '@pakhotels/db/schemas/city.schema';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PushModule } from '../push/push.module';
import { HotelController } from './hotel.controller';
import { BookingController } from './booking.controller';
import { HotelService } from './hotel.service';
import { BookingService } from './booking.service';
import { AvailabilityService } from './availability.service';
import { HotelPlanService } from './hotel-plan.service';

/** Hotels, room types, the rate calendar, bookings, verified reviews and claims. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomRate.name, schema: RoomRateSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: HotelReview.name, schema: HotelReviewSchema },
      { name: HotelClaim.name, schema: HotelClaimSchema },
      { name: City.name, schema: CitySchema },
    ]),
    SubscriptionModule,
    PushModule,
  ],
  controllers: [HotelController, BookingController],
  providers: [HotelService, BookingService, AvailabilityService, HotelPlanService],
  exports: [HotelService, BookingService, HotelPlanService],
})
export class HotelModule {}
