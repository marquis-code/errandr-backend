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
    if (!isFoodVendor(vendor.category)) {
      throw new ForbiddenException('Menu features are only available for food vendors');
    }
    return vendor;
  }

  async create(ownerId: string, dto: CreateMenuPackDto): Promise<MenuPack> {
    const vendor = await this.resolveVendor(ownerId);
    return this.packModel.create({
      ...dto,
      vendor: vendor._id,
    });
  }

  async findByOwner(ownerId: string): Promise<MenuPack[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.packModel.find({ vendor: vendor._id }).sort({ name: 1 });
  }

  async findById(id: string): Promise<MenuPack> {
    const pack = await this.packModel.findById(id);
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async update(id: string, ownerId: string, dto: Partial<CreateMenuPackDto>): Promise<MenuPack> {
    const vendor = await this.resolveVendor(ownerId);
    const pack = await this.packModel.findOneAndUpdate(
      { _id: id, vendor: vendor._id },
      dto,
      { new: true },
    );
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.packModel.findOneAndDelete({ _id: id, vendor: vendor._id });
    if (!result) throw new NotFoundException('Pack not found');
  }
}
