import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service } from './schemas/service.schema';
import { VendorsService } from '../vendors/vendors.service';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<Service>,
    private readonly vendorsService: VendorsService,
  ) {}

  async create(vendorId: string, data: any) {
    return this.serviceModel.create({ ...data, vendor: new Types.ObjectId(vendorId) });
  }

  async createForOwner(ownerId: string, data: any) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.serviceModel.create({ ...data, vendor: vendor._id });
  }

  async findAll(query: any) {
    const filter: any = {};
    if (query.vendor) filter.vendor = new Types.ObjectId(query.vendor);
    if (query.category) filter.category = query.category;
    if (query.search) {
      filter.$text = { $search: query.search };
    }
    return this.serviceModel.find(filter).sort({ createdAt: -1 });
  }

  async findByOwner(ownerId: string, query: any = {}) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.findAll({ ...query, vendor: vendor._id });
  }

  async findById(id: string) {
    const service = await this.serviceModel.findById(id);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async updateForOwner(id: string, ownerId: string, data: any) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    
    // Sanitize data
    delete data._id;
    delete data.vendor;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;

    const service = await this.serviceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), vendor: vendor._id },
      { $set: data },
      { new: true }
    );
    if (!service) throw new NotFoundException('Service not found or unauthorized');
    return service;
  }

  async deleteForOwner(id: string, ownerId: string) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    const service = await this.serviceModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      vendor: vendor._id
    });
    if (!service) throw new NotFoundException('Service not found or unauthorized');
    return { success: true };
  }

  async toggleAvailabilityForOwner(id: string, ownerId: string) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    const service = await this.findById(id);
    if (service.vendor.toString() !== vendor._id.toString()) throw new NotFoundException('Unauthorized');
    service.isAvailable = !service.isAvailable;
    await service.save();
    return service;
  }
}
