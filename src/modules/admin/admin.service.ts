import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { Vendor, VendorStatus } from '../vendors/schemas/vendor.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { Errander } from '../erranders/schemas/errander.schema';
import { Report } from '../reports/schemas/report.schema';
import { EmailService } from '../email/email.service';
import { SystemSetting } from './schemas/system-setting.schema';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(Report.name) private reportModel: Model<Report>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSetting>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
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
      financialAgg,
      customerOrdersAgg,
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
        {
          $group: {
            _id: null,
            gmv: { $sum: { $ifNull: ['$total', 0] } },
            serviceFeeRevenue: { $sum: { $ifNull: ['$serviceFee', 0] } },
            deliveryFeeTotal: { $sum: { $ifNull: ['$deliveryFee', 0] } },
            erranderPayoutTotal: { $sum: { $ifNull: ['$erranderPayout', 0] } },
            subtotalExpenses: { $sum: { $ifNull: ['$subtotal', 0] } },
          },
        },
      ]),
      this.orderModel.aggregate([
        { $match: { status: OrderStatus.DELIVERED } },
        {
          $group: {
            _id: '$customer',
            orderCount: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$total', 0] } },
          },
        },
      ]),
    ]);

    const fin = financialAgg[0] || {
      gmv: 0,
      serviceFeeRevenue: 0,
      deliveryFeeTotal: 0,
      erranderPayoutTotal: 0,
      subtotalExpenses: 0,
    };

    const gmv = fin.gmv || 0;
    const deliveryMargin = Math.max(0, (fin.deliveryFeeTotal || 0) - (fin.erranderPayoutTotal || 0));
    const netRevenue = (fin.serviceFeeRevenue || 0) + deliveryMargin;
    const expenses = (fin.subtotalExpenses || 0) + (fin.erranderPayoutTotal || 0);
    // Platform Net Profit is the retained platform revenue (service fees + delivery margin)
    const profit = netRevenue > 0 ? netRevenue : Math.max(0, gmv - expenses);

    const convertedCount = customerOrdersAgg.length;
    const leads = Math.max(0, totalUsers - convertedCount);
    const conversionRate = totalUsers > 0 ? Number(((convertedCount / totalUsers) * 100).toFixed(1)) : 0;
    const repeatCustomers = customerOrdersAgg.filter((c) => c.orderCount > 1).length;
    const retentionRate = convertedCount > 0 ? Number(((repeatCustomers / convertedCount) * 100).toFixed(1)) : 0;
    const estimatedAcquisitionBudget = Math.round(gmv * 0.05);
    const cac = convertedCount > 0 ? Math.round(estimatedAcquisitionBudget / convertedCount) : 0;

    return {
      totalUsers,
      totalVendors,
      pendingVendors,
      totalOrders,
      activeOrders,
      completedOrders,
      totalErranders,
      totalRevenue: gmv,
      totalVolume: gmv,
      gmv,
      revenue: gmv,
      netRevenue,
      expenses,
      profit,
      leads,
      conversions: convertedCount,
      conversionRate,
      retention: repeatCustomers,
      retentionRate,
      cac,
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

  async getFinancialBreakdown(filters: {
    startDate?: string;
    endDate?: string;
    vendorId?: string;
    studentId?: string;
    erranderId?: string;
  }) {
    // 1. Build Date Range
    let start: Date;
    let end: Date = new Date();

    if (filters.startDate) {
      start = new Date(filters.startDate);
      if (filters.startDate.length === 10) {
        start.setHours(0, 0, 0, 0);
      }
    } else {
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    if (filters.endDate) {
      end = new Date(filters.endDate);
      if (filters.endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end = new Date();
    }

    // 2. Base match for Orders
    const orderMatch: any = {
      status: OrderStatus.DELIVERED,
      createdAt: { $gte: start, $lte: end },
    };

    if (filters.vendorId && Types.ObjectId.isValid(filters.vendorId)) {
      orderMatch.vendor = new Types.ObjectId(filters.vendorId);
    }
    if (filters.studentId && Types.ObjectId.isValid(filters.studentId)) {
      orderMatch.customer = new Types.ObjectId(filters.studentId);
    }
    if (filters.erranderId && Types.ObjectId.isValid(filters.erranderId)) {
      orderMatch.errander = new Types.ObjectId(filters.erranderId);
    }

    // 3. Match for Appointments (Services)
    const apptMatch: any = {
      status: { $in: [AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED] },
      scheduledDate: { $gte: start, $lte: end },
    };

    if (filters.vendorId && Types.ObjectId.isValid(filters.vendorId)) {
      apptMatch.vendor = new Types.ObjectId(filters.vendorId);
    }
    if (filters.studentId && Types.ObjectId.isValid(filters.studentId)) {
      apptMatch.user = new Types.ObjectId(filters.studentId);
    }
    // Services are handled by vendors / service providers, not errand runners
    const includeAppointments = !filters.erranderId;

    // 4. Fetch orders and appointments for aggregation
    const [orders, appointments] = await Promise.all([
      this.orderModel
        .find(orderMatch)
        .select(
          'type total subtotal deliveryFee erranderPayout erranderShare serviceFee vendorShare agreedDeliveryFee actualItemCost createdAt',
        )
        .lean(),
      includeAppointments
        ? this.appointmentModel
            .find(apptMatch)
            .select('price commitmentFee scheduledDate createdAt status')
            .lean()
        : Promise.resolve([]),
    ]);

    // Financial accumulator variables
    let normalErrandsVolume = 0;
    let normalErrandsVendorPayout = 0;
    let normalErrandsNinjaPayout = 0;
    let normalErrandsProfit = 0;
    let normalErrandsCount = 0;

    let customErrandsVolume = 0;
    let customErrandsVendorPayout = 0;
    let customErrandsNinjaPayout = 0;
    let customErrandsProfit = 0;
    let customErrandsCount = 0;

    const dailyMap = new Map<
      string,
      {
        date: string;
        vendorPayout: number;
        ninjaPayout: number;
        platformProfit: number;
        profitNormal: number;
        profitCustom: number;
        profitServices: number;
        totalVolume: number;
      }
    >();

    const getDayKey = (d: Date | string) => {
      const date = new Date(d);
      return date.toISOString().split('T')[0];
    };

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = getDayKey(cursor);
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: key,
          vendorPayout: 0,
          ninjaPayout: 0,
          platformProfit: 0,
          profitNormal: 0,
          profitCustom: 0,
          profitServices: 0,
          totalVolume: 0,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Process Orders
    for (const order of orders) {
      const total = Number(order.total || 0);
      const deliveryFee = Number(order.deliveryFee || 0);
      const serviceFee = Number(order.serviceFee || 0);
      const dayKey = getDayKey(order.createdAt || start);
      const daily = dailyMap.get(dayKey) || {
        date: dayKey,
        vendorPayout: 0,
        ninjaPayout: 0,
        platformProfit: 0,
        profitNormal: 0,
        profitCustom: 0,
        profitServices: 0,
        totalVolume: 0,
      };

      if (order.type === 'custom_errand') {
        customErrandsCount++;
        customErrandsVolume += total;

        let ninjaPayout = 0;
        if (order.erranderPayout && order.erranderPayout > 0) {
          ninjaPayout = Number(order.erranderPayout);
        } else if (order.erranderShare && order.erranderShare > 0) {
          ninjaPayout = Number(order.erranderShare);
        } else if (order.agreedDeliveryFee && order.agreedDeliveryFee > 0) {
          ninjaPayout = Math.round(Number(order.agreedDeliveryFee) * 0.8);
        } else if (deliveryFee > 0) {
          ninjaPayout = Math.round(deliveryFee * 0.8);
        }

        const vendorPayout = Number(order.actualItemCost || order.subtotal || 0);
        const runnerCut = (order.agreedDeliveryFee || deliveryFee || 0);
        const deliveryPlatformCut = Math.max(0, runnerCut - ninjaPayout);
        const profit = serviceFee + deliveryPlatformCut;

        customErrandsNinjaPayout += ninjaPayout;
        customErrandsVendorPayout += vendorPayout;
        customErrandsProfit += profit;

        daily.totalVolume += total;
        daily.ninjaPayout += ninjaPayout;
        daily.vendorPayout += vendorPayout;
        daily.platformProfit += profit;
        daily.profitCustom += profit;
      } else {
        normalErrandsCount++;
        normalErrandsVolume += total;

        const ninjaPayout = Number(order.erranderPayout || order.erranderShare || deliveryFee || 0);

        let vendorPayout = 0;
        if (order.vendorShare && order.vendorShare > 0) {
          vendorPayout = Number(order.vendorShare);
        } else if (order.subtotal && order.subtotal > 0) {
          vendorPayout = Number(order.subtotal);
        } else {
          vendorPayout = Math.max(0, total - deliveryFee - serviceFee);
        }

        const deliveryMargin = Math.max(0, deliveryFee - ninjaPayout);
        const profit = serviceFee + deliveryMargin;

        normalErrandsNinjaPayout += ninjaPayout;
        normalErrandsVendorPayout += vendorPayout;
        normalErrandsProfit += profit;

        daily.totalVolume += total;
        daily.ninjaPayout += ninjaPayout;
        daily.vendorPayout += vendorPayout;
        daily.platformProfit += profit;
        daily.profitNormal += profit;
      }

      dailyMap.set(dayKey, daily);
    }

    // Process Services (Appointments)
    let servicesVolume = 0;
    let servicesProviderPayout = 0;
    let servicesProfit = 0;
    let servicesCount = 0;

    for (const appt of appointments) {
      servicesCount++;
      const price = Number(appt.price || appt.commitmentFee || 0);
      const commitmentFee = Number(appt.commitmentFee || 0);
      servicesVolume += price;

      const platformFee = Math.max(200, Math.round((commitmentFee || price) * 0.1));
      const providerPayout = Math.max(0, price - platformFee);

      servicesProviderPayout += providerPayout;
      servicesProfit += platformFee;

      const dayKey = getDayKey(appt.scheduledDate || (appt as any).createdAt || start);
      const daily = dailyMap.get(dayKey) || {
        date: dayKey,
        vendorPayout: 0,
        ninjaPayout: 0,
        platformProfit: 0,
        profitNormal: 0,
        profitCustom: 0,
        profitServices: 0,
        totalVolume: 0,
      };

      daily.totalVolume += price;
      daily.vendorPayout += providerPayout;
      daily.platformProfit += platformFee;
      daily.profitServices += platformFee;

      dailyMap.set(dayKey, daily);
    }

    const totalVendorPayout = normalErrandsVendorPayout + customErrandsVendorPayout + servicesProviderPayout;
    const totalNinjaPayout = normalErrandsNinjaPayout + customErrandsNinjaPayout;
    const totalPlatformProfit = normalErrandsProfit + customErrandsProfit + servicesProfit;
    const totalVolume = normalErrandsVolume + customErrandsVolume + servicesVolume;
    const totalTransactions = normalErrandsCount + customErrandsCount + servicesCount;

    const timeSeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        totalVendorPayout,
        totalNinjaPayout,
        totalPlatformProfit,
        totalVolume,
        totalTransactions,
        vendorSharePercentage: totalVolume > 0 ? Number(((totalVendorPayout / totalVolume) * 100).toFixed(1)) : 0,
        ninjaSharePercentage: totalVolume > 0 ? Number(((totalNinjaPayout / totalVolume) * 100).toFixed(1)) : 0,
        platformMarginPercentage: totalVolume > 0 ? Number(((totalPlatformProfit / totalVolume) * 100).toFixed(1)) : 0,
      },
      profitBreakdown: {
        normalErrands: {
          volume: normalErrandsVolume,
          vendorPayout: normalErrandsVendorPayout,
          ninjaPayout: normalErrandsNinjaPayout,
          profit: normalErrandsProfit,
          orderCount: normalErrandsCount,
        },
        customErrands: {
          volume: customErrandsVolume,
          vendorPayout: customErrandsVendorPayout,
          ninjaPayout: customErrandsNinjaPayout,
          profit: customErrandsProfit,
          orderCount: customErrandsCount,
        },
        services: {
          volume: servicesVolume,
          providerPayout: servicesProviderPayout,
          profit: servicesProfit,
          bookingCount: servicesCount,
        },
      },
      timeSeries,
      appliedFilters: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        vendorId: filters.vendorId || null,
        studentId: filters.studentId || null,
        erranderId: filters.erranderId || null,
      },
    };
  }

  async getFinancialFilterOptions() {
    const [vendors, erranders, topStudents] = await Promise.all([
      this.vendorModel
        .find({ status: VendorStatus.APPROVED })
        .select('_id storeName businessType')
        .sort({ storeName: 1 })
        .lean(),
      this.userModel
        .find({ role: { $in: ['errander', 'dispatcher'] } })
        .select('_id firstName lastName phone')
        .sort({ firstName: 1 })
        .lean(),
      this.userModel
        .find({ role: 'student', totalOrders: { $gt: 0 } })
        .select('_id firstName lastName email totalOrders')
        .sort({ totalOrders: -1 })
        .limit(100)
        .lean(),
    ]);

    return {
      vendors: vendors.map((v) => ({
        id: v._id.toString(),
        name: v.storeName || 'Unnamed Vendor',
        type: v.businessType || 'store',
      })),
      erranders: erranders.map((e) => ({
        id: e._id.toString(),
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unnamed Runner',
        phone: e.phone || '',
      })),
      students: topStudents.map((s) => ({
        id: s._id.toString(),
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
        email: s.email,
        orders: s.totalOrders || 0,
      })),
    };
  }

  async getUsers() {
    return this.userModel.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'owner',
          as: 'walletInfo'
        }
      },
      {
        $addFields: {
          walletBalance: { 
            $ifNull: [ { $arrayElemAt: ['$walletInfo.balance', 0] }, 0 ] 
          }
        }
      },
      { $project: { password: 0, walletInfo: 0 } }
    ]);
  }

  async getUser(id: string) {
    const user = await this.userModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'owner',
          as: 'walletInfo'
        }
      },
      {
        $addFields: {
          walletBalance: { 
            $ifNull: [ { $arrayElemAt: ['$walletInfo.balance', 0] }, 0 ] 
          },
          totalEarned: {
            $ifNull: [ { $arrayElemAt: ['$walletInfo.totalEarned', 0] }, 0 ] 
          },
          wallet: { $arrayElemAt: ['$walletInfo', 0] }
        }
      },
      { $project: { password: 0, walletInfo: 0 } }
    ]);
    return user[0];
  }

  async getVendors() {
    return this.vendorModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerDetails'
        }
      },
      {
        $unwind: { path: '$ownerDetails', preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'wallets',
          localField: 'owner',
          foreignField: 'owner',
          as: 'walletInfo'
        }
      },
      {
        $addFields: {
          walletBalance: { $ifNull: [{ $arrayElemAt: ['$walletInfo.balance', 0] }, 0] },
          owner: {
            _id: '$ownerDetails._id',
            firstName: '$ownerDetails.firstName',
            lastName: '$ownerDetails.lastName',
            email: '$ownerDetails.email',
            phone: '$ownerDetails.phone',
            avatar: '$ownerDetails.avatar'
          }
        }
      },
      {
        $project: {
          ownerDetails: 0,
          walletInfo: 0
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);
  }

  async getVendor(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.vendorModel.findOne({
      $or: [
        { _id: new Types.ObjectId(id) },
        { owner: new Types.ObjectId(id) }
      ]
    }).populate('owner', 'firstName lastName email phone');
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

  async getRecentOrders(
    page = 1,
    limit = 50,
    startDate?: string,
    endDate?: string,
    status?: string,
    customerId?: string,
    vendorId?: string,
    erranderId?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string,
    exportAsCsv?: boolean,
    type?: string
  ): Promise<any> {
    const query: any = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      if (type === 'group') {
        query.isGroupOrder = true;
      } else if (type === 'pooled') {
        query.isPooledErrand = true;
      } else if (type === 'auto_pilot') {
        query.isAutopilot = true;
      } else {
        query.type = type;
      }
    }
    
    if (customerId) {
      query.$or = [{ customer: new Types.ObjectId(customerId) }, { user: new Types.ObjectId(customerId) }];
    }

    if (vendorId) {
      query.vendor = new Types.ObjectId(vendorId);
    }
    
    if (erranderId) {
      query.errander = new Types.ObjectId(erranderId);
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        ...(query.$or || []),
        { orderNumber: { $regex: search, $options: 'i' } },
        { paymentReference: { $regex: search, $options: 'i' } }
      ];
    }

    let sort: any = { createdAt: -1 };
    if (sortBy) {
      let dbSortKey = sortBy;
      if (sortBy === 'date') dbSortKey = 'createdAt';
      else if (sortBy === 'order') dbSortKey = 'orderNumber';
      else if (sortBy === 'amount') dbSortKey = 'total';
      else if (sortBy === 'status') dbSortKey = 'status';
      
      sort = {};
      sort[dbSortKey] = sortOrder === 'asc' ? 1 : -1;
    }

    if (exportAsCsv) {
      const orders = await this.orderModel
        .find(query)
        .populate('customer', 'firstName lastName email phone')
        .populate('vendor', 'storeName phone')
        .populate('errander', 'firstName lastName phone vehicleType plateNumber')
        .populate('interception.secondErrander', 'firstName lastName phone avatar')
        .sort(sort);

      const header = ['ID', 'Order Number', 'Date', 'Customer', 'Vendor', 'Status', 'Total', 'Delivery Fee'].join(',');
      const rows = orders.map(o => {
        const customer = o.customer as any;
        const vendor = o.vendor as any;
        return [
          o._id.toString(),
          o.orderNumber || '',
          o.createdAt.toISOString(),
          customer ? `"${customer.firstName} ${customer.lastName}"` : '',
          vendor ? `"${vendor.storeName}"` : '',
          o.status,
          o.total,
          o.deliveryFee
        ].join(',');
      });

      return [header, ...rows].join('\n');
    }

    const skip = (page - 1) * limit;

    const [orders, total, pendingCount, processingCount, completedCount, cancelledCount, revenueAgg] = await Promise.all([
      this.orderModel
        .find(query)
        .populate('customer', 'firstName lastName email phone')
        .populate('vendor', 'storeName phone')
        .populate('errander', 'firstName lastName phone vehicleType plateNumber')
        .populate('interception.secondErrander', 'firstName lastName phone avatar')
        .sort(sort)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0),
      this.orderModel.countDocuments(query),
      this.orderModel.countDocuments({ ...query, status: 'pending' }),
      this.orderModel.countDocuments({ ...query, status: { $in: ['accepted', 'assigned', 'picked_up'] } }),
      this.orderModel.countDocuments({ ...query, status: 'delivered' }),
      this.orderModel.countDocuments({ ...query, status: 'cancelled' }),
      this.orderModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $ifNull: ["$total", { $ifNull: ["$totalAmount", 0] }] }
            }
          }
        }
      ])
    ]);

    return {
      orders,
      total,
      page,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
      stats: {
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        cancelled: cancelledCount,
        totalRevenue: revenueAgg[0]?.totalRevenue || 0
      }
    };
  }

  async getPendingDispatchers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [dispatchersRaw, total] = await Promise.all([
      this.erranderModel
        .find({ verificationStatus: 'reviewing' })
        .populate('user', 'firstName lastName email phone walletBalance points streakCount avatar role')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      this.erranderModel.countDocuments({ verificationStatus: 'reviewing' }),
    ]);

    const userIds = dispatchersRaw.map((e: any) => e.user?._id).filter(Boolean);
    const WalletModel = this.userModel.db.model('Wallet');
    const wallets: any[] = await WalletModel.find({ owner: { $in: userIds } }).lean();

    const dispatchers = dispatchersRaw.map((errander: any) => {
      const wallet = wallets.find((w: any) => w.owner.toString() === errander.user?._id?.toString());
      if (errander.user) {
        errander.user.walletBalance = wallet?.balance || 0;
      }
      errander.totalEarnings = wallet?.totalEarned || errander.totalEarnings || 0;
      return errander;
    });

    console.log("Got dispatchers!", dispatchers.length); return { dispatchers, total };
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
    
    try {
      const [dispatchersRaw, total] = await Promise.all([
        this.erranderModel
          .find()
          .select('-idCardImage -selfieImage -ninSlipImage')
          .populate('user', 'firstName lastName email phone avatar role walletBalance points streakCount')
          .skip(skip)
          .limit(limit)
          .lean(),
        this.erranderModel.estimatedDocumentCount(),
      ]);

      const userIds = dispatchersRaw.map((e: any) => e.user?._id).filter(Boolean);
      const WalletModel = this.userModel.db.model('Wallet');
      const wallets: any[] = await WalletModel.find({ owner: { $in: userIds } }).lean();

      const dispatchers = dispatchersRaw.map((errander: any) => {
        const wallet = wallets.find((w: any) => w.owner.toString() === errander.user?._id?.toString());
        if (errander.user) {
          errander.user.walletBalance = wallet?.balance || 0;
        }
        errander.totalEarnings = wallet?.totalEarned || errander.totalEarnings || 0;
        return errander;
      });

      return { dispatchers, total };
    } catch (e: any) {
      console.error(`getAllDispatchers ERROR:`, e.message);
      throw e;
    }
  }

  async getDispatcher(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const errander: any = await this.erranderModel.findOne({
      $or: [
        { _id: new Types.ObjectId(id) },
        { user: new Types.ObjectId(id) }
      ]
    }).populate('user', '-password').lean();

    if (!errander) return null;

    if (errander.user?._id) {
      const WalletModel = this.userModel.db.model('Wallet');
      const wallet: any = await WalletModel.findOne({ owner: errander.user._id }).lean();
      
      errander.user.walletBalance = wallet?.balance || 0;
      errander.totalEarnings = wallet?.totalEarned || errander.totalEarnings || 0;
    }
    
    return errander;
  }

  async suspendDispatcher(id: string) {
    return this.erranderModel.findByIdAndUpdate(
      id,
      { isApproved: false },
      { new: true }
    );
  }

  async debitDispatcherEarnings(id: string, amount: number, description?: string) {
    const dispatcher = await this.erranderModel.findById(id);
    if (!dispatcher) throw new NotFoundException('Dispatcher not found');
    if ((dispatcher.totalEarnings || 0) < amount) {
      throw new BadRequestException('Insufficient earnings balance');
    }
    
    const updated = await this.erranderModel.findByIdAndUpdate(
      id,
      { $inc: { totalEarnings: -amount } },
      { new: true }
    );
    
    return updated;
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
    try {
      const updateData = { ...payload };

      // Remove fields that should never be in $set
      delete updateData._id;
      delete updateData.__v;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      // Handle owner update separately — owner is a ref (ObjectId), not an embedded doc
      if (updateData.owner && typeof updateData.owner === 'object') {
        try {
          const vendor = await this.vendorModel.findById(id);
          if (vendor && vendor.owner) {
            const ownerId = (vendor.owner as any)._id
              ? (vendor.owner as any)._id.toString()
              : vendor.owner.toString();
            
            // Only update with valid owner fields
            const ownerUpdate: any = {};
            if (updateData.owner.firstName) ownerUpdate.firstName = updateData.owner.firstName;
            if (updateData.owner.lastName) ownerUpdate.lastName = updateData.owner.lastName;
            if (updateData.owner.email) ownerUpdate.email = updateData.owner.email;
            if (updateData.owner.phone) ownerUpdate.phone = updateData.owner.phone;

            if (Object.keys(ownerUpdate).length > 0) {
              await this.userModel.findByIdAndUpdate(ownerId, { $set: ownerUpdate });
            }
          }
        } catch (ownerErr) {
          console.error('Failed to update vendor owner:', ownerErr);
          // Continue with vendor update even if owner update fails
        }
        delete updateData.owner;
      }

      // Sanitize businessHours — strip _id from sub-documents to prevent CastError
      if (Array.isArray(updateData.businessHours)) {
        updateData.businessHours = updateData.businessHours.map((bh: any) => ({
          day: bh.day,
          open: bh.open || '00:00',
          close: bh.close || '23:59',
          isClosed: !!bh.isClosed,
        }));
      }

      if (Array.isArray(updateData.packs)) {
        updateData.packs = updateData.packs.map((p: any) => {
          const { _id, ...rest } = p;
          return rest;
        });
      }

      if (Array.isArray(updateData.payoutAccounts)) {
        updateData.payoutAccounts = updateData.payoutAccounts.map((pa: any) => {
          const { _id, ...rest } = pa;
          return rest;
        });
      }

      if (updateData.location && typeof updateData.location === 'object') {
          delete updateData.location._id;
      }

      // Strip empty string values for enum fields to prevent validation errors
      if (updateData.status === '') delete updateData.status;
      if (updateData.businessType === '') delete updateData.businessType;
      if (updateData.serviceLocation === '') delete updateData.serviceLocation;

      // Ensure numeric fields are actually numbers
      if (updateData.baseDeliveryFee !== undefined) updateData.baseDeliveryFee = Number(updateData.baseDeliveryFee) || 0;
      if (updateData.packagingFee !== undefined) updateData.packagingFee = Number(updateData.packagingFee) || 0;
      if (updateData.minimumOrder !== undefined) updateData.minimumOrder = Number(updateData.minimumOrder) || 0;
      if (updateData.preparationTime !== undefined) updateData.preparationTime = Number(updateData.preparationTime) || 0;

      const updated = await this.vendorModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: false }
      ).populate('owner');

      if (!updated) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return updated;
    } catch (error) {
      console.error('updateVendor error:', error);
      throw error;
    }
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
    try {
      const updateData = { ...payload };

      // Remove fields that should never be in $set
      delete updateData._id;
      delete updateData.__v;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      // Handle user update separately — user is a ref (ObjectId), not an embedded doc
      if (updateData.user && typeof updateData.user === 'object') {
        try {
          const dispatcher = await this.erranderModel.findById(id);
          if (dispatcher && dispatcher.user) {
            const userId = (dispatcher.user as any)._id
              ? (dispatcher.user as any)._id.toString()
              : dispatcher.user.toString();

            const userUpdate: any = {};
            if (updateData.user.firstName) userUpdate.firstName = updateData.user.firstName;
            if (updateData.user.lastName) userUpdate.lastName = updateData.user.lastName;
            if (updateData.user.email) userUpdate.email = updateData.user.email;
            if (updateData.user.phone) userUpdate.phone = updateData.user.phone;

            if (Object.keys(userUpdate).length > 0) {
              await this.userModel.findByIdAndUpdate(userId, { $set: userUpdate });
            }
          }
        } catch (userErr) {
          console.error('Failed to update dispatcher user:', userErr);
        }
        delete updateData.user;
      }

      const updated = await this.erranderModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: false }
      ).populate('user');

      if (!updated) {
        throw new NotFoundException(`Dispatcher with ID ${id} not found`);
      }

      return updated;
    } catch (error) {
      console.error('updateDispatcher error:', error);
      throw error;
    }
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

  async getFastestDispatchers(limit: number = 4) {
    const dispatchers = await this.orderModel.aggregate([
      { $match: { status: OrderStatus.DELIVERED, errander: { $exists: true, $ne: null } } },
      { 
        $addFields: {
          acceptanceTime: {
            $let: {
              vars: {
                acceptedStatus: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$statusHistory",
                        as: "history",
                        cond: { $in: ["$$history.status", ["accepted", "confirmed", "preparing", "ready_for_pickup", "picked_up", "in_transit"]] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ["$$acceptedStatus.timestamp", "$createdAt"] }
            }
          },
          deliveryTime: {
            $let: {
              vars: {
                deliveredStatus: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$statusHistory",
                        as: "history",
                        cond: { $eq: ["$$history.status", "delivered"] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ["$actualDeliveryTime", { $ifNull: ["$$deliveredStatus.timestamp", "$updatedAt"] }] }
            }
          }
        }
      },
      {
        $addFields: {
          deliveryDurationMs: { $subtract: ["$deliveryTime", "$acceptanceTime"] }
        }
      },
      {
        $match: {
          deliveryDurationMs: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: "$errander",
          averageDeliveryTimeMs: { $avg: "$deliveryDurationMs" },
          totalDeliveries: { $sum: 1 }
        }
      },
      { $match: { totalDeliveries: { $gte: 1 } } },
      { $sort: { averageDeliveryTimeMs: 1 } },
      { $limit: limit }
    ]);

    const populated = await this.userModel.populate(dispatchers, { path: '_id', select: 'firstName lastName email phone avatar' });
    
    return populated.map((d: any) => ({
      user: d._id,
      averageDeliveryTimeMs: d.averageDeliveryTimeMs,
      totalDeliveries: d.totalDeliveries
    }));
  }
}
