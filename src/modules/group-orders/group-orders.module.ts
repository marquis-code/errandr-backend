import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupOrdersService } from './group-orders.service';
import { GroupOrdersController } from './group-orders.controller';
import { GroupOrder, GroupOrderSchema } from './schemas/group-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GroupOrder.name, schema: GroupOrderSchema },
    ]),
  ],
  controllers: [GroupOrdersController],
  providers: [GroupOrdersService],
  exports: [GroupOrdersService],
})
export class GroupOrdersModule {}
