import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ExamModeController } from './exam-mode.controller';
import { ExamModeService } from './exam-mode.service';
import { VendorAvailability, VendorAvailabilitySchema } from './schemas/vendor-availability.schema';
import { ContentPlan, ContentPlanSchema } from './schemas/content-plan.schema';
import { RescheduleRequest, RescheduleRequestSchema } from './schemas/reschedule-request.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorAvailability.name, schema: VendorAvailabilitySchema },
      { name: ContentPlan.name, schema: ContentPlanSchema },
      { name: RescheduleRequest.name, schema: RescheduleRequestSchema },
    ]),
    ScheduleModule.forRoot(),
    NotificationsModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [ExamModeController],
  providers: [ExamModeService],
  exports: [ExamModeService],
})
export class ExamModeModule {}
