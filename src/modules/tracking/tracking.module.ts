import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  providers: [TrackingGateway, TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
