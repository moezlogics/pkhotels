import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentReview, AgentReviewSchema } from '@pakhotels/db/schemas/agent-review.schema';
import { User, UserSchema } from '@pakhotels/db/schemas/user.schema';
import { Property, PropertySchema } from '@pakhotels/db/schemas/property.schema';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentReview.name, schema: AgentReviewSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
  ],
  providers: [ReviewService],
  controllers: [ReviewController],
  exports: [ReviewService],
})
export class ReviewModule {}
