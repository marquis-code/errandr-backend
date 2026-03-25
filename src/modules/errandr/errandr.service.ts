import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Errander, ErranderStatus } from './schemas/errander.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ErrandrService {
  constructor(
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(User.name) private userModel: Model<User>,
    private redisService: RedisService,
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
      'errandr:locations',
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
    const [errandr, total] = await Promise.all([
      this.erranderModel
        .find()
        .populate('user', 'firstName lastName email phone avatar')
        .skip(skip)
        .limit(limit)
        .sort({ totalDeliveries: -1 }),
      this.erranderModel.countDocuments(),
    ]);
    return { errandr, total };
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
