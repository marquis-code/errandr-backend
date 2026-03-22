import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './schemas/favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private favoriteModel: Model<Favorite>,
  ) {}

  async addFavorite(userId: string, productId: string, vendorId?: string): Promise<Favorite> {
    try {
      return await this.favoriteModel.create({
        user: new Types.ObjectId(userId),
        product: new Types.ObjectId(productId),
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

  async getUserFavorites(userId: string): Promise<Favorite[]> {
    return this.favoriteModel
      .find({ user: new Types.ObjectId(userId) })
      .populate({
        path: 'product',
        select: 'name price image description isAvailable category',
      })
      .populate({
        path: 'vendor',
        select: 'storeName logo isOnline',
      })
      .sort({ createdAt: -1 });
  }

  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const count = await this.favoriteModel.countDocuments({
      user: new Types.ObjectId(userId),
      product: new Types.ObjectId(productId),
    });
    return count > 0;
  }

  async toggleFavorite(userId: string, productId: string, vendorId?: string): Promise<{ isFavorite: boolean }> {
    const existing = await this.favoriteModel.findOne({
      user: new Types.ObjectId(userId),
      product: new Types.ObjectId(productId),
    });
    if (existing) {
      await existing.deleteOne();
      return { isFavorite: false };
    }
    await this.favoriteModel.create({
      user: new Types.ObjectId(userId),
      product: new Types.ObjectId(productId),
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
