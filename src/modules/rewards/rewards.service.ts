import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRole } from '../users/schemas/user.schema';
import { Reward, RewardType } from './schemas/reward.schema';
import { Quest, QuestType } from './schemas/quest.schema';
import { UserQuest } from './schemas/user-quest.schema';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Reward.name) private rewardModel: Model<Reward>,
    @InjectModel(Quest.name) private questModel: Model<Quest>,
    @InjectModel(UserQuest.name) private userQuestModel: Model<UserQuest>,
  ) {}

  async addPoints(userId: string, points: number, reason: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.points = (user.points || 0) + points;
    await user.save();

    this.logger.log(`Awarded ${points} points to ${user.email} for: ${reason}`);
    return { success: true, points: user.points, reason };
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.referralCode) return user.referralCode;

    const code = `ERR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    user.referralCode = code;
    await user.save();
    return code;
  }

  async processReferral(newUserId: string, referredByCode: string) {
    if (!referredByCode) return;

    const referrer = await this.userModel.findOne({ referralCode: referredByCode });
    if (!referrer) return;

    const newUser = await this.userModel.findById(newUserId);
    if (!newUser) return;

    // Award points to referrer (500 pts for campus growth)
    await this.addPoints(referrer._id.toString(), 500, `Referral bonus for user ${newUserId}`);
    referrer.referralCount = (referrer.referralCount || 0) + 1;
    await referrer.save();

    // Award welcome bonus to new user (100 pts)
    await this.addPoints(newUserId, 100, `Welcome bonus (Referred by ${referrer.firstName})`);
    
    // Check referral quests for the referrer
    await this.checkQuests(referrer._id.toString(), QuestType.REFERRAL, 1);

    return { success: true, referrerId: referrer._id, pointsAwarded: 500 };
  }

  async spinWheel(userId: string, deviceId?: string) {
    // Aggressive Check: Has the user OR the device won today?
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query: any = {
      createdAt: { $gte: today }
    };

    if (userId && deviceId) {
      query.$or = [
        { user: new Types.ObjectId(userId) },
        { deviceId: deviceId }
      ];
    } else if (userId) {
      query.user = new Types.ObjectId(userId);
    } else {
      query.deviceId = deviceId || 'unknown';
    }

    const existingWin = await this.rewardModel.findOne(query);

    const rewards: { type: RewardType | null; chance: number; value: number; label: string }[] = [
      { type: RewardType.FREE_DELIVERY, chance: 0.1, value: 0, label: 'Free Delivery' },
      { type: RewardType.DISCOUNT, chance: 0.2, value: 500, label: '₦500 Off' },
      { type: RewardType.DISCOUNT, chance: 0.3, value: 200, label: '₦200 Off' },
      { type: null, chance: 0.4, value: 0, label: 'Better luck next time!' },
    ];

    // If they already won today, force "No Win"
    if (existingWin) {
      return { 
        success: false, 
        label: 'You have already claimed your reward for today! Come back tomorrow.',
        alreadyWon: true
      };
    }

    const random = Math.random();
    let cumulativeChance = 0;
    let selectedReward: (typeof rewards)[0] | null = null;

    for (const r of rewards) {
      cumulativeChance += r.chance;
      if (random < cumulativeChance) {
        selectedReward = r;
        break;
      }
    }

    if (selectedReward && selectedReward.type) {
      const code = `SPIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const reward = await this.rewardModel.create({
        user: new Types.ObjectId(userId),
        deviceId: deviceId || 'unknown',
        type: selectedReward.type,
        value: selectedReward.value,
        code,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      return { success: true, reward, label: selectedReward.label };
    }

    return { success: false, label: selectedReward?.label || 'Better luck next time!' };
  }

  async getMyRewards(userId: string) {
    return this.rewardModel.find({ user: new Types.ObjectId(userId), isUsed: false, expiryDate: { $gt: new Date() } });
  }

  async getUserPoints(userId: string): Promise<number> {
    const user = await this.userModel.findById(userId);
    return user?.points || 0;
  }

  async getLeaderboard(type: 'orders' | 'deliveries' | 'points' = 'points') {
    const sortField = {
      orders: 'totalOrders',
      deliveries: 'totalDeliveries',
      points: 'points',
    }[type];

    return this.userModel
      .find({ [sortField]: { $gt: 0 } })
      .select('firstName lastName avatar points totalOrders totalDeliveries department faculty')
      .sort({ [sortField]: -1 })
      .limit(10);
  }

  async checkQuests(userId: string, type: QuestType, increment = 1) {
    const activeQuests = await this.questModel.find({ type, isActive: true });
    const results: any[] = [];

    for (const quest of activeQuests) {
      let userQuest = await this.userQuestModel.findOne({
        user: new Types.ObjectId(userId),
        quest: quest._id,
      });

      if (!userQuest) {
        userQuest = new this.userQuestModel({
          user: new Types.ObjectId(userId),
          quest: quest._id,
          currentValue: 0,
        });
      }

      if (userQuest.isCompleted) continue;

      userQuest.currentValue += increment;
      if (userQuest.currentValue >= quest.targetValue) {
        userQuest.isCompleted = true;
        userQuest.completedAt = new Date();
        
        // Auto-award points for quests
        await this.addPoints(userId, quest.rewardPoints, `Completed Quest: ${quest.title}`);
        results.push({ quest, completed: true });
      } else {
        results.push({ quest, completed: false });
      }

      await userQuest.save();
    }
    return results;
  }

  async getMyQuests(userId: string) {
    const allQuests = await this.questModel.find({ isActive: true });
    const userQuests = await this.userQuestModel.find({ user: new Types.ObjectId(userId) });

    return allQuests.map(q => {
      const progress = userQuests.find(uq => uq.quest.toString() === q._id.toString());
      return {
        ...q.toObject(),
        progress: progress?.currentValue || 0,
        isCompleted: progress?.isCompleted || false,
      };
    });
  }

  async convertToAirtime(userId: string, points: number, phoneNumber: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    
    if (user.points < points) throw new Error('Insufficient points');

    // Mock logic for airtime conversion (1 point = 1 Naira for simplicity)
    const amount = points; 
    user.points -= points;
    await user.save();

    return { 
      success: true, 
      message: `₦${amount} airtime successfully sent to ${phoneNumber}`,
      remainingPoints: user.points
    };
  }

  async updateUserStats(userId: string, update: { orders?: number; deliveries?: number; streak?: boolean }) {
    const user = await this.userModel.findById(userId);
    if (!user) return;

    if (update.orders) user.totalOrders = (user.totalOrders || 0) + update.orders;
    if (update.deliveries) user.totalDeliveries = (user.totalDeliveries || 0) + update.deliveries;
    
    if (update.streak) {
      user.streakCount = (user.streakCount || 0) + 1;
    }

    // Automatically award Pro status if they hit a threshold (e.g., 50 orders)
    if (!user.isPro && (user.totalOrders >= 50 || user.totalDeliveries >= 30)) {
      user.isPro = true;
    }

    await user.save();

    // Trigger quest checks
    if (update.orders) await this.checkQuests(userId, QuestType.ORDER_COUNT, update.orders);
    if (update.deliveries) await this.checkQuests(userId, QuestType.DELIVERY_COUNT, update.deliveries);
    if (update.streak) await this.checkQuests(userId, QuestType.STREAK, 1);
  }
}
