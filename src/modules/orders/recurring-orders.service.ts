import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecurringOrder, RecurringOrderStatus } from './schemas/recurring-order.schema';

@Injectable()
export class RecurringOrdersService {
  constructor(
    @InjectModel(RecurringOrder.name)
    private readonly recurringOrderModel: Model<RecurringOrder>,
  ) {}

  async create(userId: string, createDto: any): Promise<RecurringOrder> {
    const newRecurringOrder = new this.recurringOrderModel({
      ...createDto,
      customer: new Types.ObjectId(userId),
      status: RecurringOrderStatus.ACTIVE,
    });
    return newRecurringOrder.save();
  }

  async findByUser(userId: string): Promise<RecurringOrder[]> {
    return this.recurringOrderModel.find({ customer: new Types.ObjectId(userId) }).exec();
  }

  async findById(id: string): Promise<RecurringOrder> {
    const order = await this.recurringOrderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Recurring order with ID ${id} not found`);
    }
    return order;
  }

  async update(id: string, userId: string, updateDto: any): Promise<RecurringOrder> {
    const updatedOrder = await this.recurringOrderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), customer: new Types.ObjectId(userId) },
        { $set: updateDto },
        { new: true },
      )
      .exec();

    if (!updatedOrder) {
      throw new NotFoundException(`Recurring order with ID ${id} not found or you don't have permission`);
    }
    return updatedOrder;
  }

  async cancel(id: string, userId: string): Promise<RecurringOrder> {
    const cancelledOrder = await this.recurringOrderModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), customer: new Types.ObjectId(userId) },
        { $set: { status: RecurringOrderStatus.CANCELLED } },
        { new: true },
      )
      .exec();

    if (!cancelledOrder) {
      throw new NotFoundException(`Recurring order with ID ${id} not found or you don't have permission`);
    }
    return cancelledOrder;
  }

  async getActiveForToday(dayOfWeek: string): Promise<RecurringOrder[]> {
    return this.recurringOrderModel.find({
      status: RecurringOrderStatus.ACTIVE,
      'schedules.day': dayOfWeek,
    }).exec();
  }

  async updateLastRun(id: string, runDate: Date): Promise<void> {
    await this.recurringOrderModel.findByIdAndUpdate(id, { $set: { lastRunAt: runDate } }).exec();
  }

  async getVendorForecasts(vendorId: string): Promise<any> {
    // Basic aggregation to show volume per day
    const forecasts = await this.recurringOrderModel.aggregate([
      { $match: { vendor: new Types.ObjectId(vendorId), status: RecurringOrderStatus.ACTIVE } },
      { $unwind: '$schedules' },
      { $group: {
          _id: '$schedules.day',
          expectedOrders: { $sum: 1 },
          expectedRevenue: { $sum: '$total' }
        }
      },
      { $sort: { expectedOrders: -1 } }
    ]);

    return forecasts;
  }
}
