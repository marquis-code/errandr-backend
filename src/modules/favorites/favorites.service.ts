import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './schemas/favorite.schema';
import { augmentVendor } from '../../utils/vendor-helpers';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private favoriteModel: Model<Favorite>,
  ) {}

  async addFavorite(userId: string, productId?: string, vendorId?: string): Promise<Favorite> {
    try {
      return await this.favoriteModel.create({
        user: new Types.ObjectId(userId),
        product: productId ? new Types.ObjectId(productId) : undefined,
        vendor: vendorId ? new Types.ObjectId(vendorId) : undefined,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Already in favorites');
      }
      throw err;
    }
  }

  async removeFavorite(userId: string, productId: string): Promise<void> {
    await this.favoriteModel.deleteOne({
      user: new Types.ObjectId(userId),
      product: new Types.ObjectId(productId),
    });
  }

  async getUserFavorites(userId: string): Promise<any[]> {
    const favorites = await this.favoriteModel
      .find({ user: new Types.ObjectId(userId) })
      .populate({
        path: 'product',
        select: 'name price image description isAvailable category',
      })
      .populate({
        path: 'vendor',
        select: 'storeName logo banner isOnline rating totalRatings category address location isStudentBusiness isFeatured businessType serviceLocation minOrder deliveryFee businessHours breakPeriod openingTime closingTime isOpen',
      })
      .sort({ createdAt: -1 });

    return favorites.map((f: any) => {
      const favObj = f.toObject ? f.toObject() : f;
      if (favObj.vendor) {
        favObj.vendor = augmentVendor(favObj.vendor);
      }
      return favObj;
    });
  }

  async isFavorite(userId: string, productId?: string, vendorId?: string): Promise<boolean> {
    const query: any = { user: new Types.ObjectId(userId) };
    if (productId) query.product = new Types.ObjectId(productId);
    if (vendorId) query.vendor = new Types.ObjectId(vendorId);
    
    const count = await this.favoriteModel.countDocuments(query);
    return count > 0;
  }

  async toggleFavorite(userId: string, productId?: string, vendorId?: string): Promise<{ isFavorite: boolean }> {
    const query: any = { user: new Types.ObjectId(userId) };
    if (productId) query.product = new Types.ObjectId(productId);
    else query.product = { $exists: false };
    
    if (vendorId) query.vendor = new Types.ObjectId(vendorId);
    else query.vendor = { $exists: false };

    const existing = await this.favoriteModel.findOne(query);
    if (existing) {
      await existing.deleteOne();
      return { isFavorite: false };
    }
    
    await this.favoriteModel.create({
      user: new Types.ObjectId(userId),
      product: productId ? new Types.ObjectId(productId) : undefined,
      vendor: vendorId ? new Types.ObjectId(vendorId) : undefined,
    });
    return { isFavorite: true };
  }

  async getFavoriteCount(productId: string): Promise<number> {
    return this.favoriteModel.countDocuments({
      product: new Types.ObjectId(productId),
    });
  }
}
