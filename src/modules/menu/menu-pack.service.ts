import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuPack } from './schemas/menu-pack.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateMenuPackDto } from './dto/create-menu-pack.dto';

@Injectable()
export class MenuPackService {
  constructor(
    @InjectModel(MenuPack.name) private packModel: Model<MenuPack>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
  ) {}

  private async resolveVendor(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!isFoodVendor(vendor)) {
      throw new ForbiddenException('Menu features are only available for food vendors');
    }
    return vendor;
  }

  // Safely extract ObjectId from populated objects or raw strings
  private toObjectId(val: any): Types.ObjectId | null {
    if (!val) return null;
    if (typeof val === 'string') return new Types.ObjectId(val);
    if (val._id) return new Types.ObjectId(val._id);
    return null;
  }

  async create(ownerId: string, dto: CreateMenuPackDto): Promise<MenuPack> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = {
      ...dto,
      vendorId: vendor._id,
    };
    if (dto.categoryId) {
      data.categoryId = this.toObjectId(dto.categoryId);
    }
    if (dto.addOnGroupIds) {
      data.addOnGroupIds = dto.addOnGroupIds.map((id: any) => this.toObjectId(id)).filter(Boolean);
    }
    if (dto.components) {
      data.components = dto.components.map((c: any) => ({
        itemId: this.toObjectId(c.itemId),
        portions: c.portions,
      }));
    }
    return this.packModel.create(data);
  }

  async findByOwner(ownerId: string): Promise<MenuPack[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.packModel
      .find({ vendorId: vendor._id })
      .populate('categoryId')
      .populate('addOnGroupIds')
      .populate('components.itemId', 'name pricePerPortion image')
      .sort({ name: 1 });
  }

  async findById(id: string): Promise<MenuPack> {
    const pack = await this.packModel
      .findById(id)
      .populate('categoryId')
      .populate('addOnGroupIds')
      .populate('components.itemId', 'name pricePerPortion image');
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async update(id: string, ownerId: string, dto: Partial<CreateMenuPackDto>): Promise<MenuPack> {
    const vendor = await this.resolveVendor(ownerId);
    const data: any = { ...dto };

    if (dto.categoryId !== undefined) {
      data.categoryId = this.toObjectId(dto.categoryId);
    }
    if (dto.addOnGroupIds) {
      data.addOnGroupIds = (dto.addOnGroupIds as any[]).map((v: any) => this.toObjectId(v)).filter(Boolean);
    }
    if (dto.components) {
      data.components = (dto.components as any[]).map((c: any) => ({
        itemId: this.toObjectId(c.itemId),
        portions: c.portions,
      }));
    }

    // Strip read-only fields
    delete data._id;
    delete data.__v;
    delete data.vendorId;
    delete data.createdAt;
    delete data.updatedAt;

    const pack = await this.packModel.findOneAndUpdate(
      { _id: id, vendorId: vendor._id },
      data,
      { new: true },
    );
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.packModel.findOneAndDelete({ _id: id, vendorId: vendor._id });
    if (!result) throw new NotFoundException('Pack not found');
  }
}
