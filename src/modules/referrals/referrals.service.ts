import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Referral, ReferralStatus, ReferrerType, ReferredType } from './schemas/referral.schema';
import { Facilitator, FacilitatorTier } from './schemas/facilitator.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { EmailService } from '../email/email.service';

// Tier configuration
const TIER_CONFIG = [
  { tier: FacilitatorTier.STARTER, minReferrals: 0, maxReferrals: 5, pointsPerReferral: 100, bonusLabel: null },
  { tier: FacilitatorTier.HUSTLER, minReferrals: 6, maxReferrals: 15, pointsPerReferral: 150, bonusLabel: '₦500 wallet credit' },
  { tier: FacilitatorTier.AMBASSADOR, minReferrals: 16, maxReferrals: 30, pointsPerReferral: 200, bonusLabel: '₦1,500 wallet credit + badge' },
  { tier: FacilitatorTier.LEGEND, minReferrals: 31, maxReferrals: Infinity, pointsPerReferral: 300, bonusLabel: '₦3,000 wallet credit + Pro status' },
];

const REFERRED_USER_BONUS = 100; // Points for the person who was referred

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectModel(Referral.name) private referralModel: Model<Referral>,
    @InjectModel(Facilitator.name) private facilitatorModel: Model<Facilitator>,
    @InjectModel(User.name) private userModel: Model<User>,
    private emailService: EmailService,
  ) {}

  // ─── Core Referral Processing ─────────────────────────────────────

  /**
   * Process a referral when a new user signs up with a referral code.
   * Looks up the code in both User and Facilitator collections.
   */
  async processReferral(newUserId: string, referralCode: string) {
    if (!referralCode) return null;

    const newUser = await this.userModel.findById(newUserId);
    if (!newUser) return null;

    // Determine the referred user type
    const referredType = this.mapRoleToReferredType(newUser.role);

    // Check if this user was already referred (prevent double referrals)
    const existingReferral = await this.referralModel.findOne({ referred: new Types.ObjectId(newUserId) });
    if (existingReferral) {
      this.logger.warn(`User ${newUserId} already has a referral record. Skipping.`);
      return null;
    }

    // 1. Check if it's a facilitator code
    const facilitator = await this.facilitatorModel.findOne({ referralCode, isActive: true });
    if (facilitator) {
      return this.processFacilitatorReferral(facilitator, newUser, referralCode, referredType);
    }

    // 2. Check if it's a regular user code
    const referrerUser = await this.userModel.findOne({ referralCode });
    if (referrerUser) {
      return this.processUserReferral(referrerUser, newUser, referralCode, referredType);
    }

    this.logger.warn(`Referral code "${referralCode}" not found in users or facilitators.`);
    return null;
  }

  private async processFacilitatorReferral(
    facilitator: Facilitator,
    newUser: User,
    referralCode: string,
    referredType: ReferredType,
  ) {
    const currentTier = this.calculateTier(facilitator.totalReferrals);
    const tierConfig = TIER_CONFIG.find(t => t.tier === currentTier);
    const pointsForReferrer = tierConfig?.pointsPerReferral || 100;

    // Create referral record
    const referral = await this.referralModel.create({
      facilitatorReferrer: facilitator._id,
      referred: newUser._id,
      referralCode,
      referrerType: ReferrerType.FACILITATOR,
      referredType,
      status: ReferralStatus.COMPLETED,
      referrerPointsAwarded: pointsForReferrer,
      referredPointsAwarded: REFERRED_USER_BONUS,
      tier: currentTier,
    });

    // Update facilitator stats
    facilitator.totalReferrals += 1;
    facilitator.pointsEarned += pointsForReferrer;
    facilitator.tier = this.calculateTier(facilitator.totalReferrals);
    await facilitator.save();

    // Award points to the referred user
    newUser.points = (newUser.points || 0) + REFERRED_USER_BONUS;
    newUser.referredBy = referralCode;
    await newUser.save();

    // If facilitator has a linked user account, award points there too
    if (facilitator.linkedUserId) {
      const linkedUser = await this.userModel.findById(facilitator.linkedUserId);
      if (linkedUser) {
        linkedUser.points = (linkedUser.points || 0) + pointsForReferrer;
        linkedUser.referralCount = (linkedUser.referralCount || 0) + 1;
        await linkedUser.save();
      }
    }

    this.logger.log(
      `✅ Facilitator referral: ${facilitator.name} (${currentTier}) referred ${newUser.email}. ` +
      `Awarded ${pointsForReferrer} pts to facilitator, ${REFERRED_USER_BONUS} pts to new user.`
    );

    return {
      success: true,
      referralId: referral._id,
      referrerType: 'facilitator',
      referrerName: facilitator.name,
      tier: currentTier,
      pointsAwarded: pointsForReferrer,
      referredBonus: REFERRED_USER_BONUS,
    };
  }

  private async processUserReferral(
    referrerUser: User,
    newUser: User,
    referralCode: string,
    referredType: ReferredType,
  ) {
    const referrerType = this.mapRoleToReferrerType(referrerUser.role);
    const referralCount = referrerUser.referralCount || 0;
    const currentTier = this.calculateTier(referralCount);
    const tierConfig = TIER_CONFIG.find(t => t.tier === currentTier);
    const pointsForReferrer = tierConfig?.pointsPerReferral || 100;

    // Create referral record
    const referral = await this.referralModel.create({
      referrer: referrerUser._id,
      referred: newUser._id,
      referralCode,
      referrerType,
      referredType,
      status: ReferralStatus.COMPLETED,
      referrerPointsAwarded: pointsForReferrer,
      referredPointsAwarded: REFERRED_USER_BONUS,
      tier: currentTier,
    });

    // Update referrer user
    referrerUser.points = (referrerUser.points || 0) + pointsForReferrer;
    referrerUser.referralCount = (referrerUser.referralCount || 0) + 1;
    await referrerUser.save();

    // Award welcome bonus to new user
    newUser.points = (newUser.points || 0) + REFERRED_USER_BONUS;
    newUser.referredBy = referralCode;
    await newUser.save();

    this.logger.log(
      `✅ User referral: ${referrerUser.email} (${currentTier}) referred ${newUser.email}. ` +
      `Awarded ${pointsForReferrer} pts to referrer, ${REFERRED_USER_BONUS} pts to new user.`
    );

    return {
      success: true,
      referralId: referral._id,
      referrerType: 'user',
      referrerName: `${referrerUser.firstName} ${referrerUser.lastName}`,
      tier: currentTier,
      pointsAwarded: pointsForReferrer,
      referredBonus: REFERRED_USER_BONUS,
    };
  }

  // ─── Tier Calculation ─────────────────────────────────────────────

  calculateTier(referralCount: number): FacilitatorTier {
    for (const config of TIER_CONFIG) {
      if (referralCount >= config.minReferrals && referralCount <= config.maxReferrals) {
        return config.tier;
      }
    }
    return FacilitatorTier.STARTER;
  }

  getTierConfig(tier: FacilitatorTier) {
    return TIER_CONFIG.find(t => t.tier === tier) || TIER_CONFIG[0];
  }

  // ─── Facilitator Management ───────────────────────────────────────

  async createFacilitator(dto: {
    name: string;
    email: string;
    matricNumber?: string;
    skill?: string;
    referralCode?: string;
    sendWelcomeEmail?: boolean;
  }) {
    // Check for existing facilitator
    const existing = await this.facilitatorModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException(`Facilitator with email ${dto.email} already exists`);

    // Generate branded referral code from name
    const code = dto.referralCode || this.generateBrandedCode(dto.name);

    // Check code uniqueness across both collections
    const codeExists = await this.isCodeTaken(code);
    if (codeExists) {
      // Append random suffix
      const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
      dto.referralCode = `${code}${suffix}`;
    } else {
      dto.referralCode = code;
    }

    const facilitator = await this.facilitatorModel.create({
      name: dto.name,
      email: dto.email,
      matricNumber: dto.matricNumber || '',
      skill: dto.skill || '',
      referralCode: dto.referralCode,
      tier: FacilitatorTier.STARTER,
    });

    // Send welcome email
    if (dto.sendWelcomeEmail !== false) {
      try {
        await this.emailService.sendFacilitatorWelcomeEmail(
          facilitator.email,
          facilitator.name,
          facilitator.referralCode,
          facilitator.skill,
        );
        facilitator.welcomeEmailSent = true;
        await facilitator.save();
        this.logger.log(`📧 Welcome email sent to facilitator: ${facilitator.email}`);
      } catch (e) {
        this.logger.error(`Failed to send welcome email to ${facilitator.email}: ${e.message}`);
      }
    }

    return facilitator;
  }

  async getFacilitators(query?: { isActive?: boolean; search?: string }) {
    const filter: any = {};
    if (query?.isActive !== undefined) filter.isActive = query.isActive;
    if (query?.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { referralCode: { $regex: query.search, $options: 'i' } },
      ];
    }
    return this.facilitatorModel.find(filter).sort({ totalReferrals: -1 });
  }

  async getFacilitator(id: string) {
    const facilitator = await this.facilitatorModel.findById(id);
    if (!facilitator) throw new NotFoundException('Facilitator not found');
    return facilitator;
  }

  async updateFacilitator(id: string, update: Partial<Facilitator>) {
    const facilitator = await this.facilitatorModel.findByIdAndUpdate(id, update, { new: true });
    if (!facilitator) throw new NotFoundException('Facilitator not found');
    return facilitator;
  }

  async deactivateFacilitator(id: string) {
    return this.updateFacilitator(id, { isActive: false } as any);
  }

  async getFacilitatorReferrals(facilitatorId: string) {
    return this.referralModel
      .find({ facilitatorReferrer: new Types.ObjectId(facilitatorId) })
      .populate('referred', 'firstName lastName email role createdAt')
      .sort({ createdAt: -1 });
  }

  async resendFacilitatorWelcomeEmail(id: string) {
    const facilitator = await this.facilitatorModel.findById(id);
    if (!facilitator) throw new NotFoundException('Facilitator not found');

    await this.emailService.sendFacilitatorWelcomeEmail(
      facilitator.email,
      facilitator.name,
      facilitator.referralCode,
      facilitator.skill,
    );
    facilitator.welcomeEmailSent = true;
    await facilitator.save();
    return { success: true, message: `Welcome email resent to ${facilitator.email}` };
  }

  // ─── Referral Queries (Admin) ─────────────────────────────────────

  async getAllReferrals(query?: { page?: number; limit?: number; status?: string; type?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query?.status) filter.status = query.status;
    if (query?.type) filter.referrerType = query.type;

    const [referrals, total] = await Promise.all([
      this.referralModel
        .find(filter)
        .populate('referrer', 'firstName lastName email avatar role')
        .populate('referred', 'firstName lastName email avatar role createdAt')
        .populate('facilitatorReferrer', 'name email referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.referralModel.countDocuments(filter),
    ]);

    return { referrals, total, page, pages: Math.ceil(total / limit) };
  }

  async getReferralsByUser(userId: string) {
    return this.referralModel
      .find({ referrer: new Types.ObjectId(userId) })
      .populate('referred', 'firstName lastName email role createdAt')
      .sort({ createdAt: -1 });
  }

  async getReferralLeaderboard(limit = 20) {
    // Get top facilitators
    const topFacilitators = await this.facilitatorModel
      .find({ isActive: true, totalReferrals: { $gt: 0 } })
      .sort({ totalReferrals: -1 })
      .limit(limit)
      .lean();

    // Get top users
    const topUsers = await this.userModel
      .find({ referralCount: { $gt: 0 } })
      .select('firstName lastName email avatar referralCode referralCount points role')
      .sort({ referralCount: -1 })
      .limit(limit)
      .lean();

    // Merge and sort
    const combined = [
      ...topFacilitators.map(f => ({
        id: f._id,
        name: f.name,
        email: f.email,
        referralCode: f.referralCode,
        referralCount: f.totalReferrals,
        pointsEarned: f.pointsEarned,
        tier: f.tier,
        type: 'facilitator' as const,
      })),
      ...topUsers.map(u => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        referralCode: u.referralCode,
        referralCount: u.referralCount,
        pointsEarned: u.points || 0,
        tier: this.calculateTier(u.referralCount || 0),
        type: u.role as string,
      })),
    ].sort((a, b) => b.referralCount - a.referralCount).slice(0, limit);

    return combined;
  }

  async getAdminReferralStats() {
    const [
      totalReferrals,
      totalFacilitators,
      activeFacilitators,
      completedReferrals,
      referralsByType,
      recentReferrals,
      totalPointsAwarded,
    ] = await Promise.all([
      this.referralModel.countDocuments(),
      this.facilitatorModel.countDocuments(),
      this.facilitatorModel.countDocuments({ isActive: true }),
      this.referralModel.countDocuments({ status: { $in: [ReferralStatus.COMPLETED, ReferralStatus.REWARDED] } }),
      this.referralModel.aggregate([
        { $group: { _id: '$referrerType', count: { $sum: 1 } } },
      ]),
      this.referralModel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      this.referralModel.aggregate([
        { $group: { _id: null, total: { $sum: { $add: ['$referrerPointsAwarded', '$referredPointsAwarded'] } } } },
      ]),
    ]);

    const referralTypeMap: Record<string, number> = {};
    referralsByType.forEach((r: any) => { referralTypeMap[r._id] = r.count; });

    return {
      totalReferrals,
      completedReferrals,
      totalFacilitators,
      activeFacilitators,
      recentReferrals,
      totalPointsAwarded: totalPointsAwarded[0]?.total || 0,
      referralsByType: referralTypeMap,
      conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0,
    };
  }

  // ─── Seed Facilitators ────────────────────────────────────────────

  async seedFacilitators(facilitators: Array<{
    name: string;
    email: string;
    matricNumber?: string;
    skill?: string;
  }>) {
    const results: any[] = [];

    for (const f of facilitators) {
      try {
        const facilitator = await this.createFacilitator({
          name: f.name,
          email: f.email,
          matricNumber: f.matricNumber,
          skill: f.skill,
          sendWelcomeEmail: true,
        });
        results.push({ success: true, name: f.name, email: f.email, code: facilitator.referralCode });
      } catch (e) {
        results.push({ success: false, name: f.name, email: f.email, error: e.message });
        this.logger.error(`Failed to seed facilitator ${f.name}: ${e.message}`);
      }
    }

    return results;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private generateBrandedCode(name: string): string {
    // Take first name, uppercase, prefix with ERR-
    const firstName = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    return `ERR-${firstName}`;
  }

  private async isCodeTaken(code: string): Promise<boolean> {
    const [userWithCode, facilitatorWithCode] = await Promise.all([
      this.userModel.findOne({ referralCode: code }),
      this.facilitatorModel.findOne({ referralCode: code }),
    ]);
    return !!(userWithCode || facilitatorWithCode);
  }

  private mapRoleToReferrerType(role: UserRole): ReferrerType {
    switch (role) {
      case UserRole.STUDENT: return ReferrerType.STUDENT;
      case UserRole.VENDOR: return ReferrerType.VENDOR;
      case UserRole.ERRANDER: return ReferrerType.ERRANDER;
      default: return ReferrerType.STUDENT;
    }
  }

  private mapRoleToReferredType(role: UserRole): ReferredType {
    switch (role) {
      case UserRole.STUDENT: return ReferredType.STUDENT;
      case UserRole.VENDOR: return ReferredType.VENDOR;
      case UserRole.ERRANDER: return ReferredType.ERRANDER;
      default: return ReferredType.STUDENT;
    }
  }
}
