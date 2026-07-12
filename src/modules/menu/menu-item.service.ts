import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from './schemas/menu-item.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { ItemRestockRequest } from './schemas/item-restock-request.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { GlobalProductsService } from '../global-products/global-products.service';

@Injectable()
export class MenuItemService {
  constructor(
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(ItemRestockRequest.name) private restockRequestModel: Model<ItemRestockRequest>,
    private globalProductsService: GlobalProductsService,
  ) {}

  private async resolveVendor(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!isFoodVendor(vendor.category)) {
      throw new ForbiddenException('Menu features are only available for food vendors');
    }
    return vendor;
  }

  async create(ownerId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = {
      ...dto,
      vendor: vendor._id,
    };
    // Map DTO field names to schema field names
    if (dto.categoryId) {
      data.category = new Types.ObjectId(dto.categoryId);
      delete data.categoryId;
    }
    if (dto.modifierIds) {
      data.modifiers = dto.modifierIds.map((id) => new Types.ObjectId(id));
      delete data.modifierIds;
    }
    if (dto.addOnIds) {
      data.addOns = dto.addOnIds.map((id) => new Types.ObjectId(id));
      delete data.addOnIds;
    }
    if (dto.packIds) {
      data.packs = dto.packIds.map((id) => new Types.ObjectId(id));
      delete data.packIds;
    }
    
    if (!data.globalProductId) {
      const globalProd = await this.globalProductsService.findOrCreateManual(data.name, data.category, data.imageUrl);
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
        vendor: vendor._id,
        globalProductId: gp._id,
        name: gp.name,
        imageUrl: gp.image,
        category: gp.categoryId ? gp.categoryId : undefined,
        price: item.price,
        costPrice: item.price, // simple default
        inStock: item.inStock ?? 0,
        trackStock: item.inStock !== undefined,
        isAvailable: true,
        publishItem: true
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
      .find({ vendor: vendor._id })
      .populate('category')
      .populate('modifiers')
      .populate('addOns')
      .populate('packs')
      .sort({ name: 1 });
  }

  async findByVendor(vendorId: string, query?: { category?: string; tag?: string }): Promise<MenuItem[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    const filter: any = {
      vendor: new Types.ObjectId(vendorId),
      publishItem: true,
    };
    if (query?.category) {
      filter.category = new Types.ObjectId(query.category);
    }
    if (query?.tag) {
      filter.tags = query.tag;
    }
    return this.menuItemModel
      .find(filter)
      .populate('category')
      .populate('modifiers')
      .populate('addOns')
      .populate('packs')
      .sort({ name: 1 });
  }

  async findById(id: string): Promise<MenuItem> {
    const item = await this.menuItemModel
      .findById(id)
      .populate('vendor', 'storeName logo isOnline category')
      .populate('category')
      .populate('modifiers')
      .populate('addOns')
      .populate('packs');
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async getTopPicks(vendorId: string): Promise<MenuItem[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException('Vendor not found');
    
    const hasEnoughData = (vendor.totalOrders || 0) >= 20;
    
    if (hasEnoughData) {
      return this.menuItemModel
        .find({ vendor: new Types.ObjectId(vendorId), publishItem: true })
        .sort({ orderCount: -1 })
        .limit(6);
    } else {
      return this.menuItemModel
        .find({ vendor: new Types.ObjectId(vendorId), publishItem: true, isPinned: true })
        .limit(6);
    }
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
      vendor: item.vendor,
      item: item._id,
      itemModel: 'MenuItem'
    });

    return { success: true, message: 'We will notify you when this item is back in stock.' };
  }

  async update(id: string, ownerId: string, dto: Partial<CreateMenuItemDto>): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = { ...dto };
    // Map DTO field names to schema field names
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId ? new Types.ObjectId(dto.categoryId) : null;
      delete data.categoryId;
    }
    if (dto.modifierIds) {
      data.modifiers = dto.modifierIds.map((id) => new Types.ObjectId(id));
      delete data.modifierIds;
    }
    if (dto.addOnIds) {
      data.addOns = dto.addOnIds.map((id) => new Types.ObjectId(id));
      delete data.addOnIds;
    }
    if (dto.packIds) {
      data.packs = dto.packIds.map((id) => new Types.ObjectId(id));
      delete data.packIds;
    }
    const item = await this.menuItemModel.findOneAndUpdate(
      { _id: id, vendor: vendor._id },
      data,
      { new: true },
    );
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async togglePublish(id: string, ownerId: string): Promise<MenuItem> {
    const vendor = await this.resolveVendor(ownerId);
    const item = await this.menuItemModel.findOne({ _id: id, vendor: vendor._id });
    if (!item) throw new NotFoundException('Menu item not found');
    item.publishItem = !item.publishItem;
    await item.save();
    return item;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.menuItemModel.findOneAndDelete({ _id: id, vendor: vendor._id });
    if (!result) throw new NotFoundException('Menu item not found');
  }
}
