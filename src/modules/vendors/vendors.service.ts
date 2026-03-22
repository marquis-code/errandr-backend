import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor, VendorStatus, VendorCategory } from './schemas/vendor.schema';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { Order, OrderStatus } from '../orders/schemas/order.schema';

@Injectable()
export class VendorsService {
  constructor(
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    private redisService: RedisService,
    private emailService: EmailService,
  ) {}

  private checkIsOpen(vendor: Vendor): { isOpen: boolean; message: string } {
    if (!vendor.isOnline) return { isOpen: false, message: 'Closed (Manual)' };

    const now = new Date();
    // Use West Africa Time (WAT) or whatever the local time is. For simplicity, let's use the current server time for now.
    // In a real app, you'd handle timezone offsets.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const dayConfig = (vendor as any).businessHours?.find((bh: any) => bh.day === currentDay);
    
    if (!dayConfig || dayConfig.isClosed) {
      return { isOpen: false, message: 'Closed for the day' };
    }

    if (currentTime < dayConfig.open || currentTime > dayConfig.close) {
      return { isOpen: false, message: `Closed (Opens at ${dayConfig.open})` };
    }

    // Check Break Period
    if (vendor.breakPeriod?.enabled) {
      if (currentTime >= vendor.breakPeriod.start && currentTime <= vendor.breakPeriod.end) {
        return { isOpen: false, message: `Currently on break (Until ${vendor.breakPeriod.end})` };
      }
    }

    return { isOpen: true, message: 'Open Now' };
  }

  private augmentVendor(vendor: any) {
    if (!vendor) return null;
    const { isOpen, message } = this.checkIsOpen(vendor);
    const vendorObj = vendor.toObject ? vendor.toObject() : vendor;
    return {
      ...vendorObj,
      isOpen,
      statusMessage: message,
    };
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
    page?: number;
    limit?: number;
  }): Promise<{ vendors: Vendor[]; total: number }> {
    const { category, isInsideCampus, isStudentBusiness, preOrderOnly, search, page = 1, limit = 20 } = query;
    const filter: any = { status: VendorStatus.APPROVED };

    if (category) filter.category = category;
    if (isInsideCampus !== undefined) filter.isInsideCampus = isInsideCampus;
    if (isStudentBusiness !== undefined) filter.isStudentBusiness = isStudentBusiness;
    if (preOrderOnly !== undefined) filter.preOrderOnly = preOrderOnly;
    if (search) {
      filter.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      this.vendorModel.find(filter).populate('owner', 'firstName lastName avatar').skip(skip).limit(limit).sort({ rating: -1 }),
      this.vendorModel.countDocuments(filter),
    ]);
    return { 
      vendors: vendors.map(v => this.augmentVendor(v)), 
      total 
    };
  }

  async getStudentBusinesses(): Promise<Vendor[]> {
    return this.vendorModel
      .find({ status: VendorStatus.APPROVED, isStudentBusiness: true })
      .populate('owner', 'firstName lastName avatar')
      .sort({ rating: -1 });
  }

  async getPopularVendors(): Promise<Vendor[]> {
    const vendors = await this.vendorModel
      .find({ status: VendorStatus.APPROVED })
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

  async findByOwner(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(id: string, ownerId: string, data: Partial<Vendor>): Promise<Vendor> {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.owner.toString() !== ownerId) throw new ForbiddenException();

    Object.assign(vendor, data);
    await vendor.save();
    return vendor;
  }

  async toggleOnline(id: string, ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.owner.toString() !== ownerId) throw new ForbiddenException();

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
    
    const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
    const totalSales = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => new Date((o as any).createdAt) >= today);
    const todaySales = todayOrders
      .filter(o => o.status === OrderStatus.DELIVERED)
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const activeOrders = orders.filter(o => 
      [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP].includes(o.status)
    ).length;

    return {
      totalSales,
      todaySales,
      totalOrders: orders.length,
      todayOrders: todayOrders.length,
      activeOrders,
      rating: vendor.rating || 5.0,
      reviewsCount: vendor.totalRatings || 0
    };
  }

  async getOnlineVendors(): Promise<Vendor[]> {
    const vendors = await this.vendorModel
      .find({ status: VendorStatus.APPROVED, isOnline: true })
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
    return Object.values(VendorCategory);
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
}
