import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { Errander } from '../erranders/schemas/errander.schema';
import { Report } from '../reports/schemas/report.schema';
import { EmailService } from '../email/email.service';
import { SystemSetting } from './schemas/system-setting.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSetting>,
    private emailService: EmailService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      totalOrders,
      activeOrders,
      completedOrders,
      totalErranders,
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
      totalErranders,
      totalRevenue: revenue[0]?.total || 0,
      totalVolume: revenue[0]?.total || 0, // Admin dashboard expects totalVolume
    };
  }

  async getRevenueChartData(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate daily revenue from DELIVERED orders
    const dailyData = await this.orderModel.aggregate([
      {
        $match: {
          status: OrderStatus.DELIVERED,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: "$serviceFee" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing dates with zero values
    const chartData: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const existingData = dailyData.find(d => d._id === dateString);
      chartData.push({
        date: dateString,
        revenue: existingData ? existingData.revenue : 0,
        orders: existingData ? existingData.orderCount : 0
      });
    }

    return chartData;
  }

  async getUsers() {
    return this.userModel.find().sort({ createdAt: -1 });
  }

  async getUser(id: string) {
    return this.userModel.findById(id);
  }

  async getVendors() {
    return this.vendorModel.find().populate('owner', 'firstName lastName email phone').sort({ createdAt: -1 });
  }

  async getVendor(id: string) {
    return this.vendorModel.findById(id).populate('owner', 'firstName lastName email phone');
  }

  async getReports() {
    const [reports, total, pending, investigating, resolved, dismissed] = await Promise.all([
      this.reportModel
        .find()
        .populate('reporter', 'firstName lastName email avatar')
        .populate('vendor', 'storeName logo')
        .populate('reportedUser', 'firstName lastName email')
        .populate('order', 'orderNumber total')
        .sort({ createdAt: -1 }),
      this.reportModel.countDocuments(),
      this.reportModel.countDocuments({ status: 'pending' }),
      this.reportModel.countDocuments({ status: 'investigating' }),
      this.reportModel.countDocuments({ status: 'resolved' }),
      this.reportModel.countDocuments({ status: 'dismissed' }),
    ]);
    return {
      reports,
      total,
      stats: { pending, investigating, resolved, dismissed },
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
      .populate('customer', 'firstName lastName email')
      .populate('vendor', 'storeName')
      .populate('errander', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getPendingDispatchers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [dispatchers, total] = await Promise.all([
      this.erranderModel
        .find({ verificationStatus: 'reviewing' })
        .populate('user', 'firstName lastName email phone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.erranderModel.countDocuments({ verificationStatus: 'reviewing' }),
    ]);
    return { dispatchers, total };
  }

  async approveDispatcher(id: string, explicitLevel?: number) {
    const errander = await this.erranderModel.findById(id).populate('user');
    if (!errander) return null;
    
    let finalLevel = 1;
    if (explicitLevel) {
      finalLevel = explicitLevel;
    } else {
      // Automatically determine level to grant based on current level
      const currentLevel = Number(errander.verificationLevel) || 1;
      const nextLevel = currentLevel + 1;
      finalLevel = nextLevel > 3 ? 3 : nextLevel;
    }

    const updated = await this.erranderModel.findByIdAndUpdate(
      id,
      { 
        verificationStatus: 'approved',
        verificationLevel: finalLevel,
        isVerified: true
      },
      { new: true },
    ).populate('user');

    if (updated?.user) {
      const user: any = updated.user;
      this.emailService.sendDispatcherVerificationApproved(user.email, user.firstName);
    }

    return updated;
  }

  async updateDispatcherTier(id: string, tier: number) {
    return this.erranderModel.findByIdAndUpdate(
      id,
      {
        verificationLevel: tier,
        isVerified: true,
        verificationStatus: 'approved'
      },
      { new: true }
    ).populate('user');
  }

  async rejectDispatcher(id: string, reason?: string) {
    const updated = await this.erranderModel.findByIdAndUpdate(
      id,
      { 
        verificationStatus: 'rejected',
        ...(reason && { rejectionReason: reason })
      },
      { new: true }
    ).populate('user');

    if (updated?.user) {
      const user: any = updated.user;
      this.emailService.sendDispatcherVerificationRejected(user.email, user.firstName, reason);
    }

    return updated;
  }

  async getAllDispatchers(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [dispatchers, total] = await Promise.all([
      this.erranderModel
        .find()
        .populate('user', 'firstName lastName email phone avatar role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.erranderModel.countDocuments(),
    ]);

    return { dispatchers, total };
  }

  async getDispatcher(id: string) {
    return this.erranderModel.findById(id).populate('user', '-password');
  }

  async suspendDispatcher(id: string) {
    return this.erranderModel.findByIdAndUpdate(
      id,
      { isApproved: false },
      { new: true }
    );
  }

  async activateDispatcher(id: string) {
    return this.erranderModel.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true }
    );
  }

  async updateUser(id: string, payload: any) {
    // If updating role or sensitive fields, maybe we should handle it carefully, but admin has full rights
    return this.userModel.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    );
  }

  async updateVendor(id: string, payload: any) {
    const updateData = { ...payload };
    if (updateData.owner && typeof updateData.owner === 'object') {
      const vendor = await this.vendorModel.findById(id);
      if (vendor && vendor.owner) {
        // safely extract the ObjectId
        const ownerId = (vendor.owner as any)._id 
          ? (vendor.owner as any)._id.toString() 
          : vendor.owner.toString();
        await this.userModel.findByIdAndUpdate(ownerId, { $set: updateData.owner });
      }
      // Delete owner so it doesn't try to update the Vendor's owner reference with an object
      delete updateData.owner;
    }

    return this.vendorModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate('owner');
  }

  async toggleVendorVisibility(id: string, isVisible: boolean) {
    return this.vendorModel.findByIdAndUpdate(
      id,
      { isVisible },
      { new: true }
    ).populate('owner');
  }

  async deleteVendor(id: string) {
    return this.vendorModel.findByIdAndDelete(id);
  }

  async updateDispatcher(id: string, payload: any) {
    return this.erranderModel.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
    ).populate('user');
  }

  async deleteDispatcher(id: string) {
    return this.erranderModel.findByIdAndDelete(id);
  }

  async batchDeleteDispatchers(ids: string[]): Promise<any> {
    return this.erranderModel.deleteMany({ _id: { $in: ids } });
  }

  async getSetting(key: string) {
    const setting = await this.systemSettingModel.findOne({ key });
    return setting ? setting.value : null;
  }
}
