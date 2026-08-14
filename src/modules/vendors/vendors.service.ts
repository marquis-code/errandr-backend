import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor, VendorStatus, VendorCategory } from './schemas/vendor.schema';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';
import { VendorNotification } from './schemas/vendor-notification.schema';
import { Product } from '../products/schemas/product.schema';
import { Service } from '../services/schemas/service.schema';
import { WebPushService } from './web-push.service';
import { MenuItem } from '../menu/schemas/menu-item.schema';
import { Wallet } from '../wallets/schemas/wallet.schema';
import { Appointment, AppointmentStatus } from '../appointments/schemas/appointment.schema';
import { augmentVendor, checkIsOpen } from '../../utils/vendor-helpers';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(VendorNotification.name) private vendorNotificationModel: Model<VendorNotification>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(Appointment.name) private appointmentModel: Model<Appointment>,
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    private redisService: RedisService,
    private emailService: EmailService,
    private webPushService: WebPushService,
  ) {}

  public augmentVendor(vendor: any) {
    return augmentVendor(vendor);
  }

  public checkIsOpen(vendor: any) {
    return checkIsOpen(vendor);
  }



  async create(ownerId: string, data: Partial<Vendor>): Promise<Vendor> {
    const vendor = await this.vendorModel.create({
      ...data,
      owner: new Types.ObjectId(ownerId),
    });

    // Send welcome email (non-blocking)
    try {
      const ownerDoc = await this.vendorModel.findById(vendor._id).populate('owner', 'firstName email');
      const owner = ownerDoc?.owner as any;
      if (owner?.email) {
        this.emailService.sendVendorWelcome(owner.email, owner.firstName || 'there', vendor.storeName);
      }
    } catch (e) {
      // Don't block vendor creation if email fails
    }

    return vendor;
  }

  async findAll(query: {
    category?: VendorCategory;
    isInsideCampus?: boolean;
    isStudentBusiness?: boolean;
    preOrderOnly?: boolean;
    search?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ vendors: Vendor[]; total: number }> {
    const { category, isInsideCampus, isStudentBusiness, preOrderOnly, search, sortBy, page = 1, limit = 20 } = query;
    const filter: any = { status: VendorStatus.APPROVED, isVisible: { $ne: false } };

    if (category) filter.category = category;
    if (isInsideCampus !== undefined) filter.isInsideCampus = isInsideCampus;
    if (isStudentBusiness !== undefined) filter.isStudentBusiness = isStudentBusiness;
    if (preOrderOnly !== undefined) filter.preOrderOnly = preOrderOnly;
    if (search) {
      const matchingProducts = await this.productModel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }).select('vendor').lean();

      const matchingServices = await this.serviceModel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }).select('vendor').lean();

      const matchingMenuItems = await this.menuItemModel.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }).select('vendorId').lean();

      const vendorIdsFromItems = [
        ...matchingProducts.map(p => p.vendor),
        ...matchingServices.map(s => s.vendor),
        ...matchingMenuItems.map(m => m.vendorId)
      ];

      filter.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { _id: { $in: vendorIdsFromItems } }
      ];
    }

    let sortOptions: any = { rating: -1 };
    if (sortBy === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sortBy === 'trending') {
      sortOptions = { totalOrders: -1, rating: -1 };
    } else if (sortBy === 'recommended') {
      sortOptions = { isFeatured: -1, rating: -1 };
    }

    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      this.vendorModel.find(filter).populate('owner', 'firstName lastName avatar').skip(skip).limit(limit).sort(sortOptions),
      this.vendorModel.countDocuments(filter),
    ]);
    return { 
      vendors: vendors.map(v => this.augmentVendor(v)), 
      total 
    };
  }

  async getStudentBusinesses(): Promise<Vendor[]> {
    return this.vendorModel
      .find({ status: VendorStatus.APPROVED, isStudentBusiness: true, isVisible: { $ne: false } })
      .populate('owner', 'firstName lastName avatar')
      .sort({ rating: -1 });
  }

  async getPopularVendors(): Promise<Vendor[]> {
    const vendors = await this.vendorModel
      .find({ status: VendorStatus.APPROVED, isVisible: { $ne: false } })
      .populate('owner', 'firstName lastName avatar')
      .sort({ rating: -1 })
      .limit(10);
    return vendors.map(v => this.augmentVendor(v)) as any;
  }

  async findById(id: string): Promise<Vendor> {
    const vendor = await this.vendorModel
      .findById(id)
      .populate('owner', 'firstName lastName avatar phone');
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.augmentVendor(vendor) as any;
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];
    
    const vendors = await this.vendorModel
      .find({ _id: { $in: validIds.map(id => new Types.ObjectId(id)) } })
      .populate('owner', 'firstName lastName avatar phone');
      
    return vendors.map(v => this.augmentVendor(v)) as any;
  }

  async toggleVendorOnlineStatus(vendorId: string, isOnline: boolean) {
    const vendor = await this.vendorModel.findByIdAndUpdate(vendorId, { isOnline }, { new: true });
    // Clear cache
    await this.redisService.del('all_approved_vendors');
    return vendor;
  }

  async addNotificationRequest(vendorId: string, email: string, pushSubscription?: any) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');

    let existing = await this.vendorNotificationModel.findOne({ vendorId, email, isNotified: false });
    if (existing) {
      if (pushSubscription && !existing.pushSubscription) {
        existing.pushSubscription = pushSubscription;
        await existing.save();
        return { message: 'Push notifications enabled for this vendor.' };
      }
      return { message: 'You are already on the notification list for this vendor.' };
    }

    await this.vendorNotificationModel.create({ vendorId, email, pushSubscription });
    return { message: 'We will notify you when this vendor comes online.' };
  }

  async findByOwner(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async findBySubdomain(subdomain: string): Promise<Vendor> {
    const vendor = await this.vendorModel
      .findOne({ subdomain: subdomain.toLowerCase().trim() })
      .populate('owner', 'firstName lastName avatar phone');
    if (!vendor) throw new NotFoundException('Vendor not found for this subdomain');
    return this.augmentVendor(vendor) as any;
  }

  async checkSubdomainAvailability(subdomain: string): Promise<{ available: boolean; subdomain: string }> {
    const cleaned = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!cleaned || cleaned.length < 3) {
      return { available: false, subdomain: cleaned };
    }
    const existing = await this.vendorModel.findOne({ subdomain: cleaned });
    return { available: !existing, subdomain: cleaned };
  }

  async update(id: string, ownerId: string, data: Partial<Vendor>): Promise<Vendor> {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    // Safely extract the hex strings regardless of population status
    const vOwnerId = ((vendor.owner as any)?._id || vendor.owner).toString();
    const reqOwnerId = ((ownerId as any)?._id || ownerId).toString();

    if (vOwnerId !== reqOwnerId) {
      throw new ForbiddenException('You do not have permission to modify this vendor');
    }

    Object.assign(vendor, data);
    await vendor.save();
    return vendor;
  }

  async updateFcmToken(ownerId: string, fcmToken: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    vendor.fcmToken = fcmToken;
    await vendor.save();
    return vendor;
  }

  async toggleOnline(id: string, ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    const vOwnerId = ((vendor.owner as any)?._id || vendor.owner).toString();
    const reqOwnerId = ((ownerId as any)?._id || ownerId).toString();

    if (vOwnerId !== reqOwnerId) {
      throw new ForbiddenException('You do not have permission to modify this vendor');
    }

    vendor.isOnline = !vendor.isOnline;
    await vendor.save();

    // Cache vendor status in Redis for fast lookups
    await this.redisService.set(
      `vendor:status:${id}`,
      vendor.isOnline ? 'online' : 'offline',
      300,
    );

    return vendor;
  }

  async getVendorStats(ownerId: string) {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const orders = await this.orderModel.find({ vendor: vendor._id });
    const appointments = await this.appointmentModel.find({ vendor: vendor._id });
    const wallet = await this.walletModel.findOne({ owner: new Types.ObjectId(ownerId) });
    
    const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
    const completedAppointments = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);

    const totalSales = wallet ? wallet.totalEarned : 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = orders.filter(o => {
      const d = new Date((o as any).createdAt);
      return d >= today && d < tomorrow;
    });

    const todayAppointments = appointments.filter(a => {
      const d = new Date(a.scheduledDate);
      return d >= today && d < tomorrow;
    });

    const todaySales = wallet ? wallet.balance : 0;

    const activeOrdersCount = orders.filter(o => 
      [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP].includes(o.status)
    ).length;

    const activeAppointmentsCount = appointments.filter(a =>
      [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(a.status)
    ).length;

    return {
      totalSales,
      todaySales,
      totalOrders: orders.length + appointments.length,
      todayOrders: todayOrders.length + todayAppointments.length,
      activeOrders: activeOrdersCount + activeAppointmentsCount,
      rating: vendor.rating || 5.0,
      reviewsCount: vendor.totalRatings || 0
    };
  }

  async getOnlineVendors(): Promise<Vendor[]> {
    const vendors = await this.vendorModel
      .find({ status: VendorStatus.APPROVED, isOnline: true, isVisible: { $ne: false } })
      .populate('owner', 'firstName lastName avatar')
      .sort({ rating: -1 });
    
    return vendors.map(v => this.augmentVendor(v)) as any;
  }

  async getNearbyVendors(
    lng: number,
    lat: number,
    maxDistance = 5000,
  ): Promise<Vendor[]> {
    return this.vendorModel.find({
      status: VendorStatus.APPROVED,
      isOnline: true,
      isVisible: { $ne: false },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    }).populate('owner', 'firstName lastName avatar');
  }

  async getVendorStatus(id: string): Promise<string> {
    const cached = await this.redisService.get(`vendor:status:${id}`);
    if (cached) return cached;

    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const status = vendor.isOnline ? 'online' : 'offline';
    await this.redisService.set(`vendor:status:${id}`, status, 300);
    return status;
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.vendorModel.distinct('category', { status: VendorStatus.APPROVED }).exec();
    const predefined = Object.values(VendorCategory);
    
    // Combine predefined and dynamic, remove empties, make unique
    const allCategories = [...new Set([...predefined, ...categories])];
    return allCategories.filter(c => c && c.trim() !== '');
  }

  async approveVendor(id: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findByIdAndUpdate(
      id,
      { status: VendorStatus.APPROVED },
      { new: true },
    );
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async suspendVendor(id: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findByIdAndUpdate(
      id,
      { status: VendorStatus.SUSPENDED, isOnline: false },
      { new: true },
    );
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async getVendorReviews(vendorId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Find all orders for this vendor that have a vendorReview
    const filter = {
      vendor: new Types.ObjectId(vendorId),
      vendorReview: { $exists: true, $ne: '' }
    };

    const rawReviews = await this.orderModel
      .find(filter)
      .select('vendorRating vendorReview customer createdAt')
      .populate('customer', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const reviews = rawReviews.map(r => ({
      _id: r._id,
      rating: r.vendorRating,
      comment: r.vendorReview,
      createdAt: r.createdAt,
      user: {
        name: r.customer ? `${(r.customer as any).firstName || ''} ${(r.customer as any).lastName || ''}`.trim() : 'Anonymous'
      }
    }));

    const total = await this.orderModel.countDocuments(filter);

    return {
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }
}
