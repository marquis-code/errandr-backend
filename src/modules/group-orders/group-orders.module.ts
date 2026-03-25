import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupOrdersService } from './group-orders.service';
import { GroupOrdersController } from './group-orders.controller';
import { GroupOrdersGateway } from './group-orders.gateway';
import { GroupOrder, GroupOrderSchema } from './schemas/group-order.schema';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GroupOrder.name, schema: GroupOrderSchema },
    ]),
    forwardRef(() => OrdersModule),
  ],
  controllers: [GroupOrdersController],
  providers: [GroupOrdersService, GroupOrdersGateway],
  exports: [GroupOrdersService],
})
export class GroupOrdersModule {}
