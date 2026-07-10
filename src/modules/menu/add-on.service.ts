import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddOn } from './schemas/add-on.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateAddOnDto } from './dto/create-add-on.dto';

@Injectable()
export class AddOnService {
  constructor(
    @InjectModel(AddOn.name) private addOnModel: Model<AddOn>,
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

  async create(ownerId: string, dto: CreateAddOnDto): Promise<AddOn> {
    const vendor = await this.resolveVendor(ownerId);
    return this.addOnModel.create({
      ...dto,
      vendor: vendor._id,
    });
  }

  async findByOwner(ownerId: string): Promise<AddOn[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.addOnModel.find({ vendor: vendor._id }).sort({ name: 1 });
  }

  async findById(id: string): Promise<AddOn> {
    const addOn = await this.addOnModel.findById(id);
    if (!addOn) throw new NotFoundException('Add-on not found');
    return addOn;
  }

  async update(id: string, ownerId: string, dto: Partial<CreateAddOnDto>): Promise<AddOn> {
    const vendor = await this.resolveVendor(ownerId);
    const addOn = await this.addOnModel.findOneAndUpdate(
      { _id: id, vendor: vendor._id },
      dto,
      { new: true },
    );
    if (!addOn) throw new NotFoundException('Add-on not found');
    return addOn;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.addOnModel.findOneAndDelete({ _id: id, vendor: vendor._id });
    if (!result) throw new NotFoundException('Add-on not found');
  }
}
