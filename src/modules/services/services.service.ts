import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service } from './schemas/service.schema';
import { VendorsService } from '../vendors/vendors.service';
import { InstitutionResolver } from '../institutions/institution-resolver.service';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<Service>,
    private readonly vendorsService: VendorsService,
    private readonly institutionResolver: InstitutionResolver,
  ) {}

  async create(vendorId: string, data: any) {
    return this.serviceModel.create({ ...data, vendor: new Types.ObjectId(vendorId) });
  }

  async createForOwner(ownerId: string, data: any) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.serviceModel.create({ ...data, vendor: vendor._id });
  }

  async findAll(query: any, req?: any) {
    const filter: any = {};
    if (query.vendor) filter.vendor = new Types.ObjectId(query.vendor);
    if (query.category) filter.category = query.category;
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    // Campus tenancy: `null` means "do not scope" — keep the original query.
    const institution = req ? await this.institutionResolver.resolve(req) : null;
    if (!institution) {
      return this.serviceModel.find(filter).populate('vendor', 'storeName logo banner address rating totalRatings category isOnline subdomain serviceLocation phone').sort({ createdAt: -1 });
    }

    // Services inherit their institution from the owning vendor. Rather than
    // materialising every campus vendor id, join on the vendor with `$lookup`
    // and keep only rows whose vendor belongs to the campus.
    return this.serviceModel.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendor',
          foreignField: '_id',
          as: 'vendorDoc',
        },
      },
      { $match: { 'vendorDoc.institution': institution } },
      {
        $addFields: {
          vendor: { $arrayElemAt: ['$vendorDoc', 0] },
        },
      },
      { $project: { vendorDoc: 0 } },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async findByOwner(ownerId: string, query: any = {}) {
    const vendor = await this.vendorsService.findByOwner(ownerId);
    return this.findAll({ ...query, vendor: vendor._id });
  }

  async findById(id: string, req?: any) {
    const service = await this.serviceModel.findById(id).populate('vendor', 'storeName logo banner address rating totalRatings category isOnline subdomain serviceLocation businessHours phone');
    if (!service) throw new NotFoundException('Service not found');

    // A campus-scoped caller must not open another campus's service by id.
    const institution = req ? await this.institutionResolver.resolve(req) : null;
    if (institution && !(await this.vendorsService.isInInstitution(String(service.vendor?._id || service.vendor), institution))) {
      throw new NotFoundException('Service not found');
    }

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
