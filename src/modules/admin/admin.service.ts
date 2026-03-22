import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { Errander } from '../errandr/schemas/errander.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      totalOrders,
      activeOrders,
      completedOrders,
      totalErrandr,
      revenue,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.vendorModel.countDocuments({ status: VendorStatus.APPROVED }),
      this.vendorModel.countDocuments({ status: VendorStatus.PENDING }),
      this.orderModel.countDocuments(),
      this.orderModel.countDocuments({
        status: { $nin: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
      }),
      this.orderModel.countDocuments({ status: OrderStatus.DELIVERED }),
      this.erranderModel.countDocuments(),
      this.orderModel.aggregate([
        { $match: { status: OrderStatus.DELIVERED } },
        { $group: { _id: null, total: { $sum: '$serviceFee' } } },
      ]),
    ]);

    return {
      totalUsers,
      totalVendors,
      pendingVendors,
      totalOrders,
      activeOrders,
      completedOrders,
      totalErrandr,
      totalRevenue: revenue[0]?.total || 0,
    };
  }

  async getPendingVendors(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      this.vendorModel
        .find({ status: VendorStatus.PENDING })
        .populate('owner', 'firstName lastName email phone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.vendorModel.countDocuments({ status: VendorStatus.PENDING }),
    ]);
    return { vendors, total };
  }

  async approveVendor(vendorId: string) {
    return this.vendorModel.findByIdAndUpdate(
      vendorId,
      { status: VendorStatus.APPROVED },
      { new: true },
    );
  }

  async rejectVendor(vendorId: string) {
    return this.vendorModel.findByIdAndUpdate(
      vendorId,
      { status: VendorStatus.REJECTED },
      { new: true },
    );
  }

  async suspendUser(userId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true },
    );
  }

  async activateUser(userId: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true },
    );
  }

  async getRecentOrders(limit = 50) {
    return this.orderModel
      .find()
      .populate('customer', 'firstName lastName')
      .populate('vendor', 'storeName')
      .populate('errander', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}
