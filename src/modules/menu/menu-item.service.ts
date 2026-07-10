import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuItem } from './schemas/menu-item.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { ItemRestockRequest } from './schemas/item-restock-request.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';

@Injectable()
export class MenuItemService {
  constructor(
    @InjectModel(MenuItem.name) private menuItemModel: Model<MenuItem>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(ItemRestockRequest.name) private restockRequestModel: Model<ItemRestockRequest>,
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
    return this.menuItemModel.create(data);
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
