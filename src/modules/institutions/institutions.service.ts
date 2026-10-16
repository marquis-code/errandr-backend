import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Institution } from './schemas/institution.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { Service } from '../services/schemas/service.schema';

/** Fields the campus picker needs — never leak internal bookkeeping to guests. */
const PICKER_FIELDS = 'name shortName slug city state country branding supportedAppTypes category';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<Institution>,
    @InjectModel(Vendor.name) private vendorModel: Model<Vendor>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
  ) {}

  /**
   * Campuses for the picker. Inactive campuses are never returned when
   * activeOnly is set (which is what the public route always does).
   */
  async findAll(activeOnly = true): Promise<Institution[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.institutionModel
      .find(filter)
      .select(PICKER_FIELDS)
      .sort({ name: 1 })
      .exec();
  }

  /** Public key lookup: accepts either an ObjectId or the slug. */
  async findByIdOrSlug(idOrSlug: string): Promise<Institution> {
    if (Types.ObjectId.isValid(idOrSlug)) {
      return this.findById(idOrSlug);
    }
    return this.findBySlug(idOrSlug);
  }

  async findById(id: string): Promise<Institution> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Institution not found');
    }
    const institution = await this.institutionModel.findById(id).exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return institution;
  }

  async findBySlug(slug: string): Promise<Institution> {
    const institution = await this.institutionModel
      .findOne({ slug: String(slug).toLowerCase() })
      .exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return institution;
  }

  async create(data: Partial<Institution>): Promise<Institution> {
    const slug = data.slug ? String(data.slug).toLowerCase().trim() : '';
    if (!slug) {
      throw new ConflictException('Institution slug is required');
    }

    const existing = await this.institutionModel.findOne({ slug }).exec();
    if (existing) {
      throw new ConflictException('Institution with this slug already exists');
    }

    const institution = new this.institutionModel({ ...data, slug });
    return institution.save();
  }

  async update(id: string, data: Partial<Institution>): Promise<Institution> {
    const update: Partial<Institution> = { ...data };

    if (update.slug) {
      update.slug = String(update.slug).toLowerCase().trim();
      const clash = await this.institutionModel
        .findOne({ slug: update.slug, _id: { $ne: id } })
        .exec();
      if (clash) {
        throw new ConflictException('Institution with this slug already exists');
      }
    }

    const institution = await this.institutionModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return institution;
  }

  /**
   * Light counts for one campus's picker card. Products, services and menu
   * items do not carry their own institution, so their counts are derived by
   * joining on the owning vendor's institution.
   */
  async getStats(idOrSlug: string): Promise<{ vendors: number; services: number }> {
    const institution = await this.findByIdOrSlug(idOrSlug);
    const institutionId = institution._id as Types.ObjectId;

    const vendorIds = await this.vendorModel
      .find({ institution: institutionId })
      .distinct('_id')
      .exec();

    const [vendors, services] = await Promise.all([
      this.vendorModel.countDocuments({ institution: institutionId }).exec(),
      this.serviceModel.countDocuments({ vendor: { $in: vendorIds } }).exec(),
    ]);

    return { vendors, services };
  }

  /**
   * Batch stats across all institutions in one round-trip.
   */
  async getAllStats(): Promise<Record<string, { vendors: number; services: number }>> {
    const [vendorAgg, serviceAgg] = await Promise.all([
      this.vendorModel.aggregate([
        { $match: { institution: { $exists: true, $ne: null } } },
        { $group: { _id: '$institution', count: { $sum: 1 } } },
      ]),
      this.serviceModel.aggregate([
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendor',
            foreignField: '_id',
            as: 'vendorDoc',
          },
        },
        { $unwind: '$vendorDoc' },
        { $match: { 'vendorDoc.institution': { $exists: true, $ne: null } } },
        { $group: { _id: '$vendorDoc.institution', count: { $sum: 1 } } },
      ]),
    ]);

    const result: Record<string, { vendors: number; services: number }> = {};
    for (const v of vendorAgg) {
      if (v._id) {
        result[v._id.toString()] = { vendors: v.count, services: 0 };
      }
    }
    for (const s of serviceAgg) {
      if (s._id) {
        const key = s._id.toString();
        if (result[key]) {
          result[key].services = s.count;
        } else {
          result[key] = { vendors: 0, services: s.count };
        }
      }
    }
    return result;
  }
}
