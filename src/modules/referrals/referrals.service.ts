import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Referral, ReferralStatus, ReferrerType, ReferredType } from './schemas/referral.schema';
import { Facilitator, FacilitatorTier } from './schemas/facilitator.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { PromoCode } from '../promo-codes/schemas/promo-code.schema';
import { PromoRedemption } from '../promo-codes/schemas/promo-redemption.schema';
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
    @InjectModel(PromoCode.name) private promoCodeModel: Model<PromoCode>,
    @InjectModel(PromoRedemption.name) private promoRedemptionModel: Model<PromoRedemption>,
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

  // ─── Unified Multi-Persona Referrers (Ninja, Customer, Vendor, Ambassador) ───

  async getAllReferrers(query?: { role?: string; search?: string; page?: number; limit?: number }) {
    const role = query?.role || 'all';
    const search = query?.search ? query.search.trim() : '';
    const results: any[] = [];

    // 1. Fetch Facilitators (Ambassadors)
    if (role === 'all' || role === 'facilitator') {
      const facFilter: any = {};
      if (search) {
        facFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } },
        ];
      }
      const facilitators = await this.facilitatorModel.find(facFilter).lean();

      // Find all promo codes for these facilitators
      const facIds = facilitators.map(f => f._id);
      const facPromos = await this.promoCodeModel.find({ referrerFacilitator: { $in: facIds } }).lean();

      for (const fac of facilitators) {
        const linkedPromos = facPromos.filter(p => p.referrerFacilitator && p.referrerFacilitator.toString() === fac._id.toString());
        const totalPromoRev = linkedPromos.reduce((acc, p) => acc + (p.totalRevenueGenerated || 0), 0);
        const totalPromoOrders = linkedPromos.reduce((acc, p) => acc + (p.usageCount || 0), 0);

        results.push({
          _id: fac._id,
          type: 'facilitator',
          role: 'facilitator',
          roleLabel: 'Campus Ambassador',
          roleEmoji: '💎',
          name: fac.name,
          email: fac.email,
          phone: fac.phone || '',
          referralCode: fac.referralCode,
          matricNumber: fac.matricNumber || '',
          skill: fac.skill || '',
          totalReferrals: fac.totalReferrals || 0,
          pointsEarned: fac.pointsEarned || 0,
          walletBalance: 0,
          tier: fac.tier || this.calculateTier(fac.totalReferrals || 0),
          isActive: fac.isActive !== false,
          createdAt: (fac as any).createdAt,
          promoCodes: linkedPromos.map(p => ({
            _id: p._id,
            code: p.code,
            discountType: p.discountType,
            value: p.value,
            usageCount: p.usageCount,
            totalRevenueGenerated: p.totalRevenueGenerated || 0,
            isActive: p.isActive,
          })),
          promoCodesCount: linkedPromos.length,
          totalPromoRevenue: totalPromoRev,
          totalPromoOrders,
        });
      }
    }

    // 2. Fetch Users (Errand Ninjas, Customers, Vendors)
    if (role === 'all' || ['errander', 'student', 'vendor'].includes(role)) {
      const userFilter: any = {};
      if (role !== 'all') {
        userFilter.role = role;
      } else {
        userFilter.role = { $in: [UserRole.ERRANDER, UserRole.STUDENT, UserRole.VENDOR] };
      }

      if (search) {
        userFilter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } },
        ];
      }

      // If user has not searched and role is student/all, show active or referrers with codes or referrals
      const users = await this.userModel.find(userFilter).limit(search ? 100 : 200).lean();
      const userIds = users.map(u => u._id);
      const userPromos = await this.promoCodeModel.find({ referrerUser: { $in: userIds } }).lean();

      for (const u of users) {
        const linkedPromos = userPromos.filter(p => p.referrerUser && p.referrerUser.toString() === u._id.toString());
        const totalPromoRev = linkedPromos.reduce((acc, p) => acc + (p.totalRevenueGenerated || 0), 0);
        const totalPromoOrders = linkedPromos.reduce((acc, p) => acc + (p.usageCount || 0), 0);

        let roleLabel = 'Customer';
        let roleEmoji = '🎓';
        if (u.role === UserRole.ERRANDER) {
          roleLabel = 'Errand Ninja';
          roleEmoji = '🚲';
        } else if (u.role === UserRole.VENDOR) {
          roleLabel = 'Vendor';
          roleEmoji = '🏪';
        }

        // Auto-generate code if empty
        const code = u.referralCode || `ERR-${(u.firstName || 'REF').substring(0, 4).toUpperCase()}-${u._id.toString().substring(18, 22).toUpperCase()}`;

        results.push({
          _id: u._id,
          type: 'user',
          role: u.role,
          roleLabel,
          roleEmoji,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          phone: u.phone || '',
          referralCode: code,
          totalReferrals: u.referralCount || 0,
          pointsEarned: u.points || 0,
          walletBalance: u.walletBalance || 0,
          tier: this.calculateTier(u.referralCount || 0),
          isActive: u.isActive !== false,
          createdAt: (u as any).createdAt,
          avatar: u.avatar || '',
          promoCodes: linkedPromos.map(p => ({
            _id: p._id,
            code: p.code,
            discountType: p.discountType,
            value: p.value,
            usageCount: p.usageCount,
            totalRevenueGenerated: p.totalRevenueGenerated || 0,
            isActive: p.isActive,
          })),
          promoCodesCount: linkedPromos.length,
          totalPromoRevenue: totalPromoRev,
          totalPromoOrders,
        });
      }
    }

    // Sort by referral count or promo revenue
    results.sort((a, b) => (b.totalReferrals + b.totalPromoOrders) - (a.totalReferrals + a.totalPromoOrders));

    const total = results.length;
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const paginated = results.slice((page - 1) * limit, page * limit);

    return {
      referrers: paginated,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getReferrerFullProfile(type: 'facilitator' | 'user', id: string) {
    let profile: any = null;
    let promoCodes: any[] = [];
    let referralsList: any[] = [];
    let redemptionsList: any[] = [];

    if (type === 'facilitator') {
      const fac = await this.facilitatorModel.findById(id).lean();
      if (!fac) throw new NotFoundException('Facilitator not found');

      profile = {
        _id: fac._id,
        type: 'facilitator',
        role: 'facilitator',
        roleLabel: 'Campus Ambassador',
        roleEmoji: '💎',
        name: fac.name,
        email: fac.email,
        phone: fac.phone || '',
        matricNumber: fac.matricNumber || '',
        skill: fac.skill || '',
        referralCode: fac.referralCode,
        totalReferrals: fac.totalReferrals || 0,
        pointsEarned: fac.pointsEarned || 0,
        tier: fac.tier || this.calculateTier(fac.totalReferrals || 0),
        isActive: fac.isActive,
        createdAt: (fac as any).createdAt,
      };

      [promoCodes, referralsList, redemptionsList] = await Promise.all([
        this.promoCodeModel.find({ referrerFacilitator: fac._id }).lean(),
        this.referralModel
          .find({ facilitatorReferrer: fac._id })
          .populate('referred', 'firstName lastName email role phone avatar createdAt')
          .sort({ createdAt: -1 })
          .lean(),
        this.promoRedemptionModel
          .find({ referrerFacilitator: fac._id })
          .populate('customer', 'firstName lastName email phone')
          .populate('orderId', 'orderType total status createdAt')
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    } else {
      const user = await this.userModel.findById(id).lean();
      if (!user) throw new NotFoundException('User not found');

      let roleLabel = 'Customer';
      let roleEmoji = '🎓';
      if (user.role === UserRole.ERRANDER) {
        roleLabel = 'Errand Ninja';
        roleEmoji = '🚲';
      } else if (user.role === UserRole.VENDOR) {
        roleLabel = 'Vendor';
        roleEmoji = '🏪';
      }

      profile = {
        _id: user._id,
        type: 'user',
        role: user.role,
        roleLabel,
        roleEmoji,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        phone: user.phone || '',
        referralCode: user.referralCode,
        totalReferrals: user.referralCount || 0,
        pointsEarned: user.points || 0,
        walletBalance: user.walletBalance || 0,
        tier: this.calculateTier(user.referralCount || 0),
        isActive: user.isActive,
        createdAt: (user as any).createdAt,
        avatar: user.avatar,
      };

      [promoCodes, referralsList, redemptionsList] = await Promise.all([
        this.promoCodeModel.find({ referrerUser: user._id }).lean(),
        this.referralModel
          .find({ referrer: user._id })
          .populate('referred', 'firstName lastName email role phone avatar createdAt')
          .sort({ createdAt: -1 })
          .lean(),
        this.promoRedemptionModel
          .find({ referrerUser: user._id })
          .populate('customer', 'firstName lastName email phone')
          .populate('orderId', 'orderType total status createdAt')
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    }

    const totalRevenueDriven = promoCodes.reduce((acc, p) => acc + (p.totalRevenueGenerated || 0), 0);
    const totalPromoOrders = promoCodes.reduce((acc, p) => acc + (p.usageCount || 0), 0);

    return {
      profile,
      promoCodes,
      referrals: referralsList,
      redemptions: redemptionsList,
      metrics: {
        totalReferrals: profile.totalReferrals,
        pointsEarned: profile.pointsEarned,
        totalRevenueDriven,
        totalPromoOrders,
        promoCodesCount: promoCodes.length,
      },
    };
  }

  async generateOrUpdateReferralCode(type: 'facilitator' | 'user', id: string, customCode?: string) {
    let cleanCode = (customCode || '').trim().toUpperCase();

    if (cleanCode) {
      const isTaken = await this.isCodeTaken(cleanCode);
      if (isTaken) {
        throw new BadRequestException(`Referral code "${cleanCode}" is already taken`);
      }
    }

    if (type === 'facilitator') {
      const fac = await this.facilitatorModel.findById(id);
      if (!fac) throw new NotFoundException('Facilitator not found');

      if (!cleanCode) {
        cleanCode = this.generateBrandedCode(fac.name);
        if (await this.isCodeTaken(cleanCode)) {
          cleanCode = `${cleanCode}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
        }
      }

      fac.referralCode = cleanCode;
      await fac.save();
      return fac;
    } else {
      const user = await this.userModel.findById(id);
      if (!user) throw new NotFoundException('User not found');

      if (!cleanCode) {
        const prefix = user.role === UserRole.ERRANDER ? 'NINJA' : user.role === UserRole.VENDOR ? 'VENDOR' : 'CUST';
        cleanCode = `ERR-${prefix}-${(user.firstName || 'USER').substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        if (await this.isCodeTaken(cleanCode)) {
          cleanCode = `${cleanCode}X`;
        }
      }

      user.referralCode = cleanCode;
      await user.save();
      return user;
    }
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
        .populate('referrer', 'firstName lastName email avatar role phone')
        .populate('referred', 'firstName lastName email avatar role phone createdAt')
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

  async getReferralLeaderboard(limit = 20, roleFilter?: string) {
    const combined: any[] = [];

    // 1. Facilitators
    if (!roleFilter || roleFilter === 'all' || roleFilter === 'facilitator') {
      const topFacilitators = await this.facilitatorModel
        .find({ isActive: true, totalReferrals: { $gt: 0 } })
        .sort({ totalReferrals: -1 })
        .limit(limit)
        .lean();

      combined.push(...topFacilitators.map(f => ({
        id: f._id,
        name: f.name,
        email: f.email,
        referralCode: f.referralCode,
        referralCount: f.totalReferrals,
        pointsEarned: f.pointsEarned,
        tier: f.tier || this.calculateTier(f.totalReferrals || 0),
        type: 'facilitator' as const,
        roleLabel: 'Campus Ambassador',
        roleEmoji: '💎',
      })));
    }

    // 2. Users
    if (!roleFilter || roleFilter === 'all' || ['errander', 'student', 'vendor'].includes(roleFilter)) {
      const userQuery: any = { referralCount: { $gt: 0 } };
      if (roleFilter && roleFilter !== 'all') {
        userQuery.role = roleFilter;
      } else {
        userQuery.role = { $in: [UserRole.ERRANDER, UserRole.STUDENT, UserRole.VENDOR] };
      }

      const topUsers = await this.userModel
        .find(userQuery)
        .select('firstName lastName email avatar referralCode referralCount points role')
        .sort({ referralCount: -1 })
        .limit(limit)
        .lean();

      combined.push(...topUsers.map(u => {
        let roleLabel = 'Customer';
        let roleEmoji = '🎓';
        if (u.role === UserRole.ERRANDER) {
          roleLabel = 'Errand Ninja';
          roleEmoji = '🚲';
        } else if (u.role === UserRole.VENDOR) {
          roleLabel = 'Vendor';
          roleEmoji = '🏪';
        }

        return {
          id: u._id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          referralCode: u.referralCode,
          referralCount: u.referralCount || 0,
          pointsEarned: u.points || 0,
          tier: this.calculateTier(u.referralCount || 0),
          type: u.role as string,
          roleLabel,
          roleEmoji,
        };
      }));
    }

    // Sort by referral count desc
    combined.sort((a, b) => b.referralCount - a.referralCount);
    return combined.slice(0, limit);
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
      ninjasCount,
      vendorsCount,
      customersCount,
      referralPromosCount,
      promoRedemptionsStats,
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
      this.userModel.countDocuments({ role: UserRole.ERRANDER }),
      this.userModel.countDocuments({ role: UserRole.VENDOR }),
      this.userModel.countDocuments({ role: UserRole.STUDENT }),
      this.promoCodeModel.countDocuments({
        $or: [{ isReferralPromo: true }, { referrerType: { $in: ['errander', 'student', 'vendor', 'facilitator'] } }],
      }),
      this.promoRedemptionModel.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$orderTotal' },
            totalDiscounts: { $sum: '$discountAmount' },
          },
        },
      ]),
    ]);

    const referralTypeMap: Record<string, number> = {
      facilitator: 0,
      errander: 0,
      student: 0,
      vendor: 0,
    };
    referralsByType.forEach((r: any) => { 
      if (r._id) referralTypeMap[r._id] = r.count; 
    });

    return {
      totalReferrals,
      completedReferrals,
      totalFacilitators,
      activeFacilitators,
      recentReferrals,
      totalPointsAwarded: totalPointsAwarded[0]?.total || 0,
      referralsByType: referralTypeMap,
      conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0,
      personas: {
        ninjas: {
          total: ninjasCount,
          referrals: referralTypeMap['errander'] || 0,
        },
        customers: {
          total: customersCount,
          referrals: referralTypeMap['student'] || 0,
        },
        vendors: {
          total: vendorsCount,
          referrals: referralTypeMap['vendor'] || 0,
        },
        ambassadors: {
          total: totalFacilitators,
          referrals: referralTypeMap['facilitator'] || 0,
        },
      },
      affiliatePromos: {
        totalPromoCodes: referralPromosCount,
        totalOrdersDriven: promoRedemptionsStats[0]?.totalOrders || 0,
        totalRevenueDriven: promoRedemptionsStats[0]?.totalRevenue || 0,
        totalDiscountsGiven: promoRedemptionsStats[0]?.totalDiscounts || 0,
      },
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

  async validateCode(code: string): Promise<{ valid: boolean }> {
    const isValid = await this.isCodeTaken(code);
    return { valid: isValid };
  }

  private generateBrandedCode(name: string): string {
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
