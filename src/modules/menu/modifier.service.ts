import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Modifier } from './schemas/modifier.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { isFoodVendor } from './helpers/food-vendor.helper';
import { CreateModifierDto } from './dto/create-modifier.dto';

@Injectable()
export class ModifierService {
  constructor(
    @InjectModel(Modifier.name) private modifierModel: Model<Modifier>,
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

  async create(ownerId: string, dto: CreateModifierDto): Promise<Modifier> {
    const vendor = await this.resolveVendor(ownerId);
    return this.modifierModel.create({
      ...dto,
      vendor: vendor._id,
    });
  }

  async findByOwner(ownerId: string): Promise<Modifier[]> {
    const vendor = await this.resolveVendor(ownerId);
    return this.modifierModel.find({ vendor: vendor._id }).sort({ name: 1 });
  }

  async findById(id: string): Promise<Modifier> {
    const modifier = await this.modifierModel.findById(id);
    if (!modifier) throw new NotFoundException('Modifier not found');
    return modifier;
  }

  async update(id: string, ownerId: string, dto: Partial<CreateModifierDto>): Promise<Modifier> {
    const vendor = await this.resolveVendor(ownerId);
    const modifier = await this.modifierModel.findOneAndUpdate(
      { _id: id, vendor: vendor._id },
      dto,
      { new: true },
    );
    if (!modifier) throw new NotFoundException('Modifier not found');
    return modifier;
  }

  async delete(id: string, ownerId: string): Promise<void> {
    const vendor = await this.resolveVendor(ownerId);
    const result = await this.modifierModel.findOneAndDelete({ _id: id, vendor: vendor._id });
    if (!result) throw new NotFoundException('Modifier not found');
  }
}
