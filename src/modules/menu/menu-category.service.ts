import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MenuCategory } from './schemas/menu-category.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';

@Injectable()
export class MenuCategoryService {
  constructor(
    @InjectModel(MenuCategory.name) private categoryModel: Model<MenuCategory>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
  ) {}

  private async resolveVendor(ownerId: string): Promise<Vendor> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!isFoodVendor(vendor.category)) {
      throw new ForbiddenException('Menu features are only available for food vendors');
    }
    return vendor;
  }

  async create(ownerId: string, dto: CreateMenuCategoryDto): Promise<MenuCategory> {
    const vendor = await this.resolveVendor(ownerId);
    return this.categoryModel.create({
      ...dto,
      vendor: vendor._id,
    });
  }

  async findByOwner(ownerId: string): Promise<MenuCategory[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.categoryModel
      .find({ vendor: vendor._id })
      .sort({ sortOrder: 1, name: 1 });
  }

  async findByVendor(vendorId: string): Promise<MenuCategory[]> {
    if (!Types.ObjectId.isValid(vendorId)) return [];
    return this.categoryModel
      .find({ vendor: new Types.ObjectId(vendorId), isActive: true })
      .sort({ sortOrder: 1, name: 1 });
  }

  async update(id: string, ownerId: string, dto: Partial<CreateMenuCategoryDto>): Promise<MenuCategory> {
    const vendor = await this.resolveVendor(ownerId);
    const category = await this.categoryModel.findOneAndUpdate(
      { _id: id, vendor: vendor._id },
      dto,
      { new: true },
    );
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.categoryModel.findOneAndDelete({ _id: id, vendor: vendor._id });
    if (!result) throw new NotFoundException('Category not found');
  }
}
