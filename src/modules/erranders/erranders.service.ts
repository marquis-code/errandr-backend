import { Injectable, NotFoundException, ConflictException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Errander, ErranderStatus } from './schemas/errander.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { RedisService } from '../redis/redis.service';
import { RewardsService } from '../rewards/rewards.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ErrandersService {
  private readonly logger = new Logger(ErrandersService.name);

  constructor(
    @InjectModel(Errander.name) private erranderModel: Model<Errander>,
    @InjectModel(User.name) private userModel: Model<User>,
    private redisService: RedisService,
    private rewardsService: RewardsService,
    private emailService: EmailService,
  ) {}

  /**
   * Retry helper for transient MongoDB errors (ECONNRESET, network timeouts)
   */
  private async withRetry<T>(operation: () => Promise<T>, label: string, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isTransient = error?.message?.includes('ECONNRESET') ||
          error?.message?.includes('ETIMEDOUT') ||
          error?.message?.includes('MongoNetworkError') ||
          error?.name === 'MongoNetworkError' ||
          error?.name === 'MongoNetworkTimeoutError';

        if (isTransient && attempt < maxRetries) {
          const delay = attempt * 200;
          this.logger.warn(`[${label}] Transient error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException('Max retries exceeded');
  }

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

  async submitTier2Verification(userId: string, data: { idCardImage: string; selfieImage: string; ninSlipImage?: string; ninNumber?: string; whatsappNumber?: string; school?: string; matricNumber?: string }) {
    if (!data.ninSlipImage && !data.ninNumber) {
      throw new Error('Either NIN slip image or NIN number must be provided');
    }

    const errander = await this.getOrCreateErrander(userId);
    errander.idCardImage = data.idCardImage;
    errander.selfieImage = data.selfieImage;
    if (data.ninSlipImage) errander.ninSlipImage = data.ninSlipImage;
    if (data.ninNumber) errander.ninNumber = data.ninNumber;
    if (data.school) errander.school = data.school;
    if (data.matricNumber) errander.matricNumber = data.matricNumber;
    errander.verificationStatus = 'reviewing';
    await errander.save();

    // Trigger email notification
    const user = await this.userModel.findById(userId);
    if (user && user.email) {
      this.emailService.sendDispatcherVerificationSubmitted(user.email, user.firstName);
    }

    return errander;
  }

  async submitTier3Verification(userId: string, data: { guarantorDetails: any }) {
    const errander = await this.getOrCreateErrander(userId);
    errander.guarantorDetails = data.guarantorDetails;
    errander.verificationStatus = 'reviewing';
    await errander.save();

    // Trigger email notification
    const user = await this.userModel.findById(userId);
    if (user && user.email) {
      this.emailService.sendDispatcherVerificationSubmitted(user.email, user.firstName);
    }

    return errander;
  }

  async getProfile(userId: string): Promise<Errander> {
    return this.withRetry(async () => {
      let errander = await this.erranderModel
        .findOne({ user: new Types.ObjectId(userId) })
        .populate('user', 'firstName lastName email phone avatar')
        .maxTimeMS(10000)
        .lean();

      if (!errander) {
        await this.getOrCreateErrander(userId);
        errander = await this.erranderModel
          .findOne({ user: new Types.ObjectId(userId) })
          .populate('user', 'firstName lastName email phone avatar')
          .maxTimeMS(10000)
          .lean();
      }
      return errander as unknown as Errander;
    }, 'getProfile');
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
    return this.withRetry(async () => {
      const errander = await this.getOrCreateErrander(userId);
      return {
        totalDeliveries: errander.totalDeliveries || 0,
        totalEarnings: errander.totalEarnings || 0,
        rating: errander.rating || 0,
      };
    }, 'getEarnings');
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
