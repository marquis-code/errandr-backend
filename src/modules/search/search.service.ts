import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { Product } from '../products/schemas/product.schema';
import { Service } from '../services/schemas/service.schema';
import { MenuItem } from '../menu/schemas/menu-item.schema';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
  ) {}

  async globalSearch(q: string, location?: string, time?: string) {
    let vendorIds: any[] | null = null;

    // 1. Filter vendors if location or time is provided
    if (location || (time && time !== 'any')) {
      const vendorQuery: any = { isOnline: true, status: 'approved' };

      if (location) {
        vendorQuery.$or = [
          { storeName: { $regex: location, $options: 'i' } },
          { address: { $regex: location, $options: 'i' } },
          { university: { $regex: location, $options: 'i' } },
        ];
      }

      const matchingVendors = await this.vendorModel.find(vendorQuery).lean().exec();
      
      let filteredVendors = matchingVendors;
      
      if (time && time === 'now') {
        const todayStr = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
        const currentHour = new Date().getHours();
        const currentMin = new Date().getMinutes();
        const currentTimeInt = currentHour * 60 + currentMin;
        
        filteredVendors = filteredVendors.filter(v => {
          if (!v.businessHours || v.businessHours.length === 0) return true; // Default open if not set
          const todayHours = v.businessHours.find(h => h.day.toLowerCase() === todayStr);
          if (!todayHours || todayHours.isClosed) return false;
          
          if (!todayHours.open || !todayHours.close) return true; // Invalid format safety

          const [openH, openM] = todayHours.open.split(':').map(Number);
          const [closeH, closeM] = todayHours.close.split(':').map(Number);
          const openInt = openH * 60 + openM;
          const closeInt = closeH * 60 + closeM;
          
          return currentTimeInt >= openInt && currentTimeInt <= closeInt;
        });
      }

      vendorIds = filteredVendors.map(v => v._id);
    }

    // 2. Perform search on Products, Services, and MenuItems
    const productQuery: any = { isAvailable: true };
    const serviceQuery: any = { isAvailable: true };
    const menuItemQuery: any = { publishItem: true };

    if (q) {
      productQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
      serviceQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
      menuItemQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    if (vendorIds !== null) {
      productQuery.vendor = { $in: vendorIds };
      serviceQuery.vendor = { $in: vendorIds };
      menuItemQuery.vendor = { $in: vendorIds };
    }

    const [products, services, menuItems] = await Promise.all([
      this.productModel.find(productQuery).populate('vendor').limit(50).lean().exec(),
      this.serviceModel.find(serviceQuery).populate('vendor').limit(50).lean().exec(),
      this.menuItemModel.find(menuItemQuery).populate('vendor').limit(50).lean().exec(),
    ]);

    // 3. Find Vendors directly matching the query
    let vendors: any[] = [];
    if (q) {
      const vQuery: any = {
        isOnline: true,
        status: 'approved',
        $or: [
          { storeName: { $regex: q, $options: 'i' } },
          { category: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } },
        ]
      };
      if (vendorIds !== null) {
        vQuery._id = { $in: vendorIds };
      }
      vendors = await this.vendorModel.find(vQuery).limit(20).lean().exec();
    } else if (vendorIds !== null) {
      // If no query but location/time specified, return matching vendors
      vendors = await this.vendorModel.find({ _id: { $in: vendorIds } }).limit(20).lean().exec();
    }

    return {
      success: true,
      data: {
        products,
        services,
        menuItems,
        vendors,
      }
    };
  }
}
