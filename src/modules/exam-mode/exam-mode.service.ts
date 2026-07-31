import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VendorAvailability } from './schemas/vendor-availability.schema';
import { ContentPlan, ContentPlanStatus } from './schemas/content-plan.schema';
import { RescheduleRequest, RescheduleStatus } from './schemas/reschedule-request.schema';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ExamModeService {
  private readonly logger = new Logger(ExamModeService.name);

  constructor(
    @InjectModel(VendorAvailability.name) private vendorAvailabilityModel: Model<VendorAvailability>,
    @InjectModel(ContentPlan.name) private contentPlanModel: Model<ContentPlan>,
    @InjectModel(RescheduleRequest.name) private rescheduleRequestModel: Model<RescheduleRequest>,
    private notificationsGateway: NotificationsGateway,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => OrdersService)) private ordersService: OrdersService,
  ) {}

  // --- VENDOR AVAILABILITY ---

  async getAvailability(vendorId: string): Promise<VendorAvailability> {
    let availability = await this.vendorAvailabilityModel.findOne({ vendorId });
    if (!availability) {
      availability = await this.vendorAvailabilityModel.create({ vendorId });
    }
    return availability;
  }

  async updateAvailability(vendorId: string, data: any): Promise<VendorAvailability> {
    const availability = await this.vendorAvailabilityModel.findOneAndUpdate(
      { vendorId },
      { $set: data },
      { new: true, upsert: true }
    );
    return availability;
  }

  // --- CONTENT PLAN ---

  async createContentPlan(vendorId: string, data: any): Promise<ContentPlan> {
    return this.contentPlanModel.create({ ...data, vendorId });
  }

  async getContentPlans(vendorId: string): Promise<ContentPlan[]> {
    return this.contentPlanModel.find({ vendorId }).sort({ scheduledDate: 1 });
  }

  async updateContentPlan(id: string, vendorId: string, data: any): Promise<ContentPlan> {
    const plan = await this.contentPlanModel.findOneAndUpdate(
      { _id: id, vendorId },
      { $set: data },
      { new: true }
    );
    if (!plan) throw new NotFoundException('Content plan not found');
    return plan;
  }

  async deleteContentPlan(id: string, vendorId: string): Promise<void> {
    const result = await this.contentPlanModel.deleteOne({ _id: id, vendorId });
    if (result.deletedCount === 0) throw new NotFoundException('Content plan not found');
  }

  // --- RESCHEDULE REQUESTS ---

  async getRescheduleRequests(vendorId: string): Promise<RescheduleRequest[]> {
    return this.rescheduleRequestModel.find({ vendorId }).populate('orderId customerId').sort({ createdAt: -1 });
  }

  async getCustomerRescheduleRequests(customerId: string): Promise<RescheduleRequest[]> {
    return this.rescheduleRequestModel.find({ customerId, status: RescheduleStatus.PENDING })
      .populate({ path: 'orderId', populate: { path: 'vendor' } })
      .sort({ createdAt: -1 });
  }

  async resolveRescheduleRequest(id: string, customerId: string, action: 'accept' | 'reject'): Promise<RescheduleRequest> {
    const request = await this.rescheduleRequestModel.findOne({ _id: id, customerId });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RescheduleStatus.PENDING) throw new BadRequestException('Request already resolved');

    if (action === 'accept') {
      request.status = RescheduleStatus.ACCEPTED;
      // Update the actual order's delivery date via OrdersService
      await this.ordersService.updateOrderDeliveryDate(request.orderId.toString(), request.suggestedDate);
    } else {
      request.status = RescheduleStatus.CUSTOMER_REJECTED;
      // Might want to auto-cancel or leave for manual resolution
    }

    await request.save();
    return request;
  }

  // --- CRON JOBS ---

  @Cron(CronExpression.EVERY_HOUR) // Or everyday at 9am
  async handleContentPlanReminders() {
    this.logger.log('Checking for scheduled content plans...');
    const now = new Date();
    const plans = await this.contentPlanModel.find({
      status: ContentPlanStatus.SCHEDULED,
      scheduledDate: { $lte: now }
    }).populate('vendorId');

    for (const plan of plans) {
      try {
        const vendor = plan.vendorId as any; // populated
        const userId = vendor?.user?.toString();
        
        if (userId) {
          // Send FCM Push Notification
          await this.notificationsService.sendNotification(userId, {
            type: 'CONTENT_REMINDER',
            title: 'Time to Post! 📸',
            body: `Your scheduled content is ready to be posted. Tap here to copy the caption.`,
            data: { planId: plan._id }
          });
        }

        // Mark as posted (or leave it for them to manually mark)
        // plan.status = ContentPlanStatus.POSTED;
        // await plan.save();
      } catch (error) {
        this.logger.error(`Failed to send reminder for plan ${plan._id}`, error);
      }
    }
  }

  // --- ORDER INTERCEPTOR HELPER ---
  
  async checkVendorAvailabilityConflict(vendorId: string, requestedDate: Date): Promise<Date | null> {
    const availability = await this.vendorAvailabilityModel.findOne({ vendorId, isExamModeActive: true });
    if (!availability || !availability.unavailableRanges?.length) return null;

    const reqTime = requestedDate.getTime();

    for (const range of availability.unavailableRanges) {
      if (reqTime >= range.startDate.getTime() && reqTime <= range.endDate.getTime()) {
        // Find next available day
        const nextDay = new Date(range.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay;
      }
    }
    return null;
  }

  async createRescheduleRequest(orderId: string, vendorId: string, customerId: string, originalDate: Date, suggestedDate: Date) {
    const request = await this.rescheduleRequestModel.create({
      orderId,
      vendorId,
      customerId,
      originalDate,
      suggestedDate,
      status: RescheduleStatus.PENDING,
      notifiedVia: 'push'
    });

    // Notify Customer via FCM Push Notification
    await this.notificationsService.sendNotification(customerId.toString(), {
      type: 'RESCHEDULE_REQUEST',
      title: 'Order Reschedule Request 📅',
      body: `The vendor is in Exam Mode. Can we deliver your order on ${suggestedDate.toDateString()} instead?`,
      data: { requestId: request._id, orderId }
    });

    return request;
  }
}
