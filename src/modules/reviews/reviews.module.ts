import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { VendorReview, VendorReviewSchema } from './schemas/review.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorReview.name, schema: VendorReviewSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService]
})
export class ReviewsModule {}
