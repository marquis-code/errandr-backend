import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VendorReview } from './schemas/review.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(VendorReview.name) private reviewModel: Model<VendorReview>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
  ) {}

  async createReview(userId: string, vendorId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Find all completed orders for this vendor by this user
    const completedOrders = await this.orderModel.find({
      customer: userId,
      vendor: vendorId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.PICKED_UP] }
    });

    if (!completedOrders || completedOrders.length === 0) {
      throw new BadRequestException('You can only review vendors you have completed an order with.');
    }

    // Find all reviews by this user for this vendor
    const existingReviews = await this.reviewModel.find({
      user: userId,
      vendor: vendorId,
      order: { $in: completedOrders.map(o => o._id) }
    });

    const reviewedOrderIds = existingReviews.map(r => r.order.toString());
    
    // Find an order that hasn't been reviewed yet
    const unreviewedOrder = completedOrders.find(o => !reviewedOrderIds.includes(o._id.toString()));

    if (!unreviewedOrder) {
      throw new BadRequestException('You have already reviewed all your orders from this vendor.');
    }

    const review = await this.reviewModel.create({
      user: userId,
      vendor: vendorId,
      order: unreviewedOrder._id,
      rating,
      comment,
    });

    // Sync the order status so it knows it has been rated
    unreviewedOrder.hasRatedVendor = true;
    unreviewedOrder.vendorRating = rating;
    unreviewedOrder.vendorReview = comment || '';
    await unreviewedOrder.save();

    // Update vendor rating averages
    await this.updateVendorRating(vendorId);

    return review;
  }

  async getVendorReviews(vendorId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find({ vendor: vendorId, isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-comment')
        .populate('user', 'firstName lastName avatar')
        .lean(),
      this.reviewModel.countDocuments({ vendor: vendorId, isActive: true }),
    ]);

    return {
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  private async updateVendorRating(vendorId: string) {
    const stats = await this.reviewModel.aggregate([
      { $match: { vendor: new Types.ObjectId(vendorId), isActive: true } },
      {
        $group: {
          _id: '$vendor',
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await this.vendorModel.findByIdAndUpdate(vendorId, {
        rating: Math.round(stats[0].averageRating * 10) / 10,
        totalRatings: stats[0].totalRatings,
      });
    }
  }
}
