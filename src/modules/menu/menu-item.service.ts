// Force restart
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from './schemas/menu-item.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { ItemRestockRequest } from './schemas/item-restock-request.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { GlobalProductsService } from '../global-products/global-products.service';
import { SystemSetting } from '../admin/schemas/system-setting.schema';

@Injectable()
export class MenuItemService {
  constructor(
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(ItemRestockRequest.name) private restockRequestModel: Model<ItemRestockRequest>,
    @InjectModel(SystemSetting.name) private settingModel: Model<SystemSetting>,
    private globalProductsService: GlobalProductsService,
  ) {}

  private async resolveVendor(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!isFoodVendor(vendor)) {
      throw new ForbiddenException('Menu features are only available for food vendors');
    }
    return vendor;
  }

  async create(ownerId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = {
      ...dto,
      vendorId: vendor._id,
    };
    // Safely extract ObjectId from populated objects or raw strings
    const toObjectId = (val: any): Types.ObjectId | null => {
      if (!val) return null;
      if (typeof val === 'string') return new Types.ObjectId(val);
      if (val._id) return new Types.ObjectId(val._id);
      return null;
    };

    if (dto.categoryId) {
      data.categoryId = toObjectId(dto.categoryId);
    }
    if (dto.addOnGroupIds) {
      data.addOnGroupIds = (dto.addOnGroupIds as any[]).map((v: any) => toObjectId(v)).filter(Boolean);
    }
    
    if (!data.globalProductId) {
      const globalProd = await this.globalProductsService.findOrCreateManual(data.name, data.category, data.image);
      data.globalProductId = globalProd._id;
    } else {
      await this.globalProductsService.incrementAdoption(data.globalProductId as any);
    }
    
    return this.menuItemModel.create(data);
  }

  async createBulkFromCatalog(ownerId: string, items: { globalProductId: string, price: number, inStock?: number }[]): Promise<MenuItem[]> {
    const vendor = await this.resolveVendor(ownerId);
    
    const globalIds = items.map(i => new Types.ObjectId(i.globalProductId));
    const globalProducts = await this.globalProductsService.search('', undefined, 1000);
    const globalProductsMap = new Map();
    const targetGlobalProducts = await (this.globalProductsService as any).globalProductModel.find({ _id: { $in: globalIds } });
    targetGlobalProducts.forEach((gp: any) => globalProductsMap.set(gp._id.toString(), gp));
    
    const itemsToCreate = items.map(item => {
      const gp = globalProductsMap.get(item.globalProductId);
      if (!gp) throw new NotFoundException(`Global product ${item.globalProductId} not found`);
      
      return {
        vendorId: vendor._id,
        globalProductId: gp._id,
        name: gp.name,
        imageUrl: gp.image,
        categoryId: gp.categoryId ? gp.categoryId : undefined,
        pricePerPortion: item.price,
        maxPortionsPerOrder: 0,
        isAvailable: true
      };
    });
    
    const createdItems = await this.menuItemModel.insertMany(itemsToCreate);
    
    for (const item of items) {
      await this.globalProductsService.incrementAdoption(item.globalProductId);
    }
    
    return createdItems;
  }

  async findByOwner(ownerId: string): Promise<MenuItem[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.menuItemModel
      .find({ vendorId: vendor._id })
      .populate('categoryId')
      .populate('addOnGroupIds')
      .sort({ name: 1 });
  }

  async getMarkupFactor(): Promise<number> {
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const markupPct = errandSetting?.value?.foodMarkupPercentage ?? 5;
    return 1 + (markupPct / 100);
  }

  async applyMarkupToItem(item: any, factor: number): Promise<any> {
    if (!item) return item;
    const iObj = typeof item.toObject === 'function' ? item.toObject() : item;
    if (iObj.pricePerPortion) {
      iObj.pricePerPortion = Math.ceil(iObj.pricePerPortion * factor);
    }
    if (iObj.addOnGroupIds && Array.isArray(iObj.addOnGroupIds)) {
      iObj.addOnGroupIds.forEach((group: any) => {
        if (group && group.options && Array.isArray(group.options)) {
          group.options.forEach((opt: any) => {
            if (opt.price) {
              opt.price = Math.ceil(opt.price * factor);
            }
          });
        }
      });
    }
    return iObj;
  }

  async applyMarkupToItems(items: MenuItem[]): Promise<any[]> {
    const factor = await this.getMarkupFactor();
    return Promise.all(items.map(item => this.applyMarkupToItem(item, factor)));
  }

  async findByVendor(vendorId: string, query?: { category?: string; tag?: string }): Promise<MenuItem[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    const filter: any = {
      vendorId: new Types.ObjectId(vendorId),
      isAvailable: true,
    };
    if (query?.category) {
      filter.categoryId = new Types.ObjectId(query.category);
    }
    if (query?.tag) {
      filter.tags = query.tag;
    }
    const items = await this.menuItemModel
      .find(filter)
      .populate('categoryId')
      .populate('addOnGroupIds')
      .sort({ name: 1 });
    return this.applyMarkupToItems(items);
  }

  async findById(id: string): Promise<MenuItem> {
    const item = await this.menuItemModel
      .findById(id)
      .populate('vendorId', 'storeName logo isOnline category')
      .populate('categoryId')
      .populate('addOnGroupIds');
    if (!item) throw new NotFoundException('Menu item not found');
    const factor = await this.getMarkupFactor();
    return this.applyMarkupToItem(item, factor);
  }

  async getTopPicks(vendorId: string): Promise<MenuItem[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    const hasEnoughData = (vendor.totalOrders || 0) >= 20;
    
    let items;
    if (hasEnoughData) {
      items = await this.menuItemModel
        .find({ vendorId: new Types.ObjectId(vendorId), isAvailable: true })
        .sort({ orderCount: -1 })
        .limit(6);
    } else {
      items = await this.menuItemModel
        .find({ vendorId: new Types.ObjectId(vendorId), isAvailable: true, isPinned: true })
        .limit(6);
    }
    return this.applyMarkupToItems(items);
  }

  async notifyRestock(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const item = await this.menuItemModel.findById(id);
    if (!item) throw new NotFoundException('Menu item not found');

    const existingRequest = await this.restockRequestModel.findOne({
      user: new Types.ObjectId(userId),
      item: new Types.ObjectId(id),
      notified: false
    });

    if (existingRequest) {
      return { success: true, message: 'You are already subscribed to restock notifications for this item.' };
    }

    await this.restockRequestModel.create({
      user: new Types.ObjectId(userId),
      vendor: item.vendorId,
      item: item._id,
      itemModel: 'MenuItem'
    });

    return { success: true, message: 'We will notify you when this item is back in stock.' };
  }

  async update(id: string, ownerId: string, dto: Partial<CreateMenuItemDto>): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = { ...dto };

    // Safely extract ObjectId from populated objects or raw strings
    const toObjectId = (val: any): Types.ObjectId | null => {
      if (!val) return null;
      if (typeof val === 'string') return new Types.ObjectId(val);
      if (val._id) return new Types.ObjectId(val._id);
      return null;
    };

    if (dto.categoryId !== undefined) {
      data.categoryId = toObjectId(dto.categoryId);
    }
    if (dto.addOnGroupIds) {
      data.addOnGroupIds = (dto.addOnGroupIds as any[]).map((v: any) => toObjectId(v)).filter(Boolean);
    }

    // Strip populated/computed fields that shouldn't be written back
    delete data._id;
    delete data.__v;
    delete data.vendorId;
    delete data.createdAt;
    delete data.updatedAt;
    const item = await this.menuItemModel.findOneAndUpdate(
      { _id: id, vendorId: vendor._id },
      data,
      { new: true },
    );
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async togglePublish(id: string, ownerId: string): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const item = await this.menuItemModel.findOne({ _id: id, vendorId: vendor._id });
    if (!item) throw new NotFoundException('Menu item not found');
    item.isAvailable = !item.isAvailable;
    await item.save();
    return item;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.menuItemModel.findOneAndDelete({ _id: id, vendorId: vendor._id });
    if (!result) throw new NotFoundException('Menu item not found');
  }
}
