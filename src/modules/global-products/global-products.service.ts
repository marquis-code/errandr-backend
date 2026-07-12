import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GlobalProduct } from './schemas/global-product.schema';

@Injectable()
export class GlobalProductsService {
  constructor(
    @InjectModel(GlobalProduct.name) private globalProductModel: Model<GlobalProduct>,
  ) {}

  async search(query: string, categoryId?: string, limit = 50): Promise<GlobalProduct[]> {
    const filter: any = { isActive: true };
    
    if (query) {
      filter.$text = { $search: query };
    }
    
    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }
    
    let dbQuery = this.globalProductModel.find(filter);
    
    if (query) {
      dbQuery = dbQuery.sort({ score: { $meta: 'textScore' } });
    } else {
      dbQuery = dbQuery.sort({ vendorAdoptionCount: -1 });
    }
    
    return dbQuery.limit(limit);
  }

  async findByCategory(categoryId: string): Promise<GlobalProduct[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      return [];
    }
    return this.globalProductModel.find({ 
      categoryId: new Types.ObjectId(categoryId), 
      isActive: true 
    }).sort({ vendorAdoptionCount: -1 });
  }

  async incrementAdoption(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) return;
    await this.globalProductModel.findByIdAndUpdate(id, {
      $inc: { vendorAdoptionCount: 1 }
    });
  }

  async findOrCreateManual(name: string, categoryId?: string, image?: string): Promise<GlobalProduct> {
    const existing = await this.globalProductModel.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return existing;
    }

    return this.globalProductModel.create({
      name,
      categoryId: categoryId && Types.ObjectId.isValid(categoryId) ? new Types.ObjectId(categoryId) : undefined,
      image,
      source: 'manual',
    });
  }
}
