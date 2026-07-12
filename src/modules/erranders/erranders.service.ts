import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Errander, ErranderStatus } from './schemas/errander.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { RedisService } from '../redis/redis.service';
import { RewardsService } from '../rewards/rewards.service';

@Injectable()
export class ErrandersService {
  constructor(
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(User.name) private userModel: Model<User>,
    private redisService: RedisService,
    private rewardsService: RewardsService,
  ) {}

  async register(userId: string, data: Partial<Errander>): Promise<Errander> {
    const existing = await this.erranderModel.findOne({ user: new Types.ObjectId(userId) });
    if (existing) throw new ConflictException('Already registered as errander');

    // Update user role
    await this.userModel.findByIdAndUpdate(userId, { role: UserRole.ERRANDER });

    return this.erranderModel.create({
      ...data,
      user: new Types.ObjectId(userId),
    });
  }

  async submitTier2Verification(userId: string, data: { idCardImage: string; selfieImage: string; whatsappNumber?: string }) {
    const errander = await this.getOrCreateErrander(userId);
    errander.idCardImage = data.idCardImage;
    errander.selfieImage = data.selfieImage;
    errander.verificationStatus = 'reviewing';
    await errander.save();
    return errander;
  }

  async submitTier3Verification(userId: string, data: { guarantorDetails: any }) {
    const errander = await this.getOrCreateErrander(userId);
    errander.guarantorDetails = data.guarantorDetails;
    errander.verificationStatus = 'reviewing';
    await errander.save();
    return errander;
  }

  async getProfile(userId: string): Promise<Errander> {
    const errander = await this.erranderModel
      .findOne({ user: new Types.ObjectId(userId) })
      .populate('user', 'firstName lastName email phone avatar');
    
    if (!errander) {
      await this.getOrCreateErrander(userId);
      return this.getProfile(userId);
    }
    return errander;
  }

  async updateLocation(
    userId: string,
    coordinates: number[],
  ): Promise<void> {
    await this.erranderModel.findOneAndUpdate(
      { user: new Types.ObjectId(userId) },
      { currentLocation: { type: 'Point', coordinates } },
    );

    // Update Redis geo index for fast proximity lookups
    await this.redisService.geoadd(
      'erranders:locations',
      coordinates[0],
      coordinates[1],
      userId,
    );
  }

  async toggleStatus(userId: string): Promise<Errander> {
    const errander = await this.getOrCreateErrander(userId);
    
    if (errander.status === ErranderStatus.AVAILABLE) {
      errander.status = ErranderStatus.OFFLINE;
    } else if (errander.status === ErranderStatus.OFFLINE) {
      errander.status = ErranderStatus.AVAILABLE;
      // Compliance: Reward for going online and being available
      await this.rewardsService.addPoints(userId, 5, 'Shift bonus: Online and ready to accept orders');
    }
    // Don't toggle if BUSY (currently on delivery)

    await errander.save();
    return errander;
  }

  async getEarnings(userId: string) {
    const errander = await this.getOrCreateErrander(userId);
    return {
      totalDeliveries: errander.totalDeliveries,
      totalEarnings: errander.totalEarnings,
      rating: errander.rating,
    };
  }

  async getAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [erranders, total] = await Promise.all([
      this.erranderModel
        .find()
        .populate('user', 'firstName lastName email phone avatar')
        .skip(skip)
        .limit(limit)
        .sort({ totalDeliveries: -1 }),
      this.erranderModel.countDocuments(),
    ]);
    return { erranders, total };
  }

  async getAvailable(): Promise<Errander[]> {
    return this.erranderModel
      .find({ status: ErranderStatus.AVAILABLE })
      .populate('user', 'firstName lastName avatar phone');
  }

  private async getOrCreateErrander(userId: string): Promise<Errander> {
    const errander = await this.erranderModel.findOne({ user: new Types.ObjectId(userId) });
    if (errander) return errander;

    try {
      await this.userModel.findByIdAndUpdate(userId, { role: UserRole.ERRANDER });
      return await this.erranderModel.create({
        user: new Types.ObjectId(userId),
        status: ErranderStatus.OFFLINE,
      });
    } catch (e: any) {
      if (e.code === 11000) {
        const existing = await this.erranderModel.findOne({ user: new Types.ObjectId(userId) });
        return existing as Errander;
      }
      throw e;
    }
  }
}
