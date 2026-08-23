import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { augmentVendor } from '../../utils/vendor-helpers';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findById(id: string): Promise<any> {
    const user = await this.userModel.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'owner',
          as: 'walletInfo'
        }
      },
      {
        $addFields: {
          walletBalance: { 
            $ifNull: [ { $arrayElemAt: ['$walletInfo.balance', 0] }, 0 ] 
          }
        }
      },
      { $project: { password: 0, walletInfo: 0 } }
    ]);
    if (!user || user.length === 0) throw new NotFoundException('User not found');
    return user[0];
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).select('-password');
  }

  async updateProfile(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateLocation(id: string, coordinates: number[]): Promise<User> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { location: { type: 'Point', coordinates } },
        { new: true },
      )
      .select('-password');
  }

  async findAll(page = 1, limit = 20): Promise<{ users: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel.aggregate([
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'wallets',
            localField: '_id',
            foreignField: 'owner',
            as: 'walletInfo'
          }
        },
        {
          $addFields: {
            walletBalance: { 
              $ifNull: [ { $arrayElemAt: ['$walletInfo.balance', 0] }, 0 ] 
            }
          }
        },
        { $project: { password: 0, walletInfo: 0 } }
      ]),
      this.userModel.countDocuments(),
    ]);
    return { users, total };
  }

  async updateFcmToken(id: string, fcmToken: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { fcmToken });
  }

  async addRecentlyViewedVendor(userId: string, vendorId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    const maxItems = 15;
    let recentlyViewed = user.recentlyViewed || [];
    
    // Remove if it already exists so we can add it to the front/update timestamp
    recentlyViewed = recentlyViewed.filter(item => item.vendor && item.vendor.toString() !== vendorId);
    
    // Add to the front
    recentlyViewed.unshift({ vendor: new Types.ObjectId(vendorId), viewedAt: new Date() });
    
    // Cap the array
    if (recentlyViewed.length > maxItems) {
      recentlyViewed = recentlyViewed.slice(0, maxItems);
    }
    
    await this.userModel.findByIdAndUpdate(userId, { recentlyViewed });
  }

  async getRecentlyViewedVendors(userId: string): Promise<any[]> {
    const user = await this.userModel.findById(userId).populate({
      path: 'recentlyViewed.vendor',
      select: 'storeName image banner logo rating category businessType isOnline preOrderOnly deliveryFee preparationTime businessHours breakPeriod'
    });
    if (!user) return [];

    // Expiration: 7 days
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 7);

    let needsUpdate = false;
    const validRecentlyViewed: any[] = [];
    const vendorsToReturn: any[] = [];

    for (const item of (user.recentlyViewed || [])) {
      if (item.viewedAt >= expirationDate && item.vendor) {
        validRecentlyViewed.push({
          vendor: item.vendor._id || item.vendor,
          viewedAt: item.viewedAt
        });
        vendorsToReturn.push(item.vendor);
      } else {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      // Update in background
      this.userModel.findByIdAndUpdate(userId, { recentlyViewed: validRecentlyViewed }).exec().catch(console.error);
    }

    return vendorsToReturn.map(v => augmentVendor(v));
  }

  async deleteAccount(userId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.isActive = false;
    user.deletedAt = new Date();
    if (reason) {
      user.deletionReason = reason;
    }

    await user.save();

    return {
      success: true,
      message: 'Account successfully deleted.'
    };
  }
}
