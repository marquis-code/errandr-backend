import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

/**
 * Enterprise-grade Ambassador & Multi-Persona Referral Tracking Service.
 *
 * Provides complete visibility across:
 * 1. Campus Ambassadors (Facilitators)
 * 2. Errand Ninjas (Rider referrers & recruits)
 * 3. Customers & Students (Student referral & promo loops)
 * 4. Vendors (Merchant partnerships & referrals)
 * 5. Staff & Internal Team
 *
 * Tracks dual attribution:
 * - Direct Signup Referral Codes (User onboarding)
 * - Trackable Promo Code Redemptions (Order-level attribution)
 *
 * Delivers exact itemized metrics:
 * - Who was referred (name, contact, persona, registration date)
 * - How many paid orders they completed
 * - Exactly how much was spent on Erranders (₦)
 * - Errand Ninja deliveries completed and delivery fees earned
 * - Vendor store orders and GMV generated
 */
@Injectable()
export class AmbassadorsService {
  private readonly logger = new Logger(AmbassadorsService.name);

  constructor(
    @InjectModel('Facilitator') private facilitatorModel: Model<any>,
    @InjectModel('Referral') private referralModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Order') private orderModel: Model<any>,
    @InjectModel('PromoCode') private promoCodeModel: Model<any>,
    @InjectModel('PromoRedemption') private promoRedemptionModel: Model<any>,
    @InjectModel('Vendor') private vendorModel: Model<any>,
    @InjectModel('Appointment') private appointmentModel: Model<any>,
  ) {}

  /**
   * Comprehensive Overview of all Ambassadors, Errand Ninjas, Students, Vendors & Staff referrers.
   * Can be filtered by persona ('all', 'facilitator', 'errander', 'student', 'vendor', 'staff'),
   * search query, or minimum spend driven.
   */
  async overview(query?: { persona?: string; search?: string; minSpend?: number }): Promise<any[]> {
    const persona = (query?.persona || 'all').toLowerCase();
    const search = (query?.search || '').trim();
    const minSpend = query?.minSpend || 0;

    const rows: any[] = [];

    // 1. Process Campus Ambassadors (Facilitators)
    if (persona === 'all' || persona === 'facilitator') {
      const facFilter: any = {};
      if (search) {
        facFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } },
          { matricNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const facilitators = await this.facilitatorModel.find(facFilter).lean().exec();
      const facRows = await Promise.all(facilitators.map((f: any) => this.buildFacilitatorRow(f)));
      rows.push(...facRows);
    }

    // 2. Process User Referrers (Errand Ninjas, Students, Vendors, Staff)
    if (persona === 'all' || ['errander', 'student', 'vendor', 'staff'].includes(persona)) {
      const userRows = await this.fetchAndBuildUserReferrers(persona, search);
      rows.push(...userRows);
    }

    // Filter by minimum spend if specified
    const filteredRows = minSpend > 0 ? rows.filter((r) => r.spend >= minSpend) : rows;

    // Sort by Spend Driven desc, then by Orders Placed, then by Total Referrals
    return filteredRows.sort((a, b) => {
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (b.ordersPlaced !== a.ordersPlaced) return b.ordersPlaced - a.ordersPlaced;
      return b.totalReferrals - a.totalReferrals;
    });
  }

  /**
   * Build metrics row for a Campus Ambassador (Facilitator)
   */
  private async buildFacilitatorRow(facilitator: any): Promise<any> {
    const facId = facilitator._id;
    const facCode = facilitator.referralCode || '';

    // A. Direct Signup Referrals
    const referralFilter: any = {
      $or: [{ facilitatorReferrer: facId }],
    };
    if (facCode) {
      referralFilter.$or.push({ referralCode: facCode });
    }
    const referrals = await this.referralModel.find(referralFilter).lean().exec();

    // B. Linked Promo Codes
    const promoFilter: any = {
      $or: [{ referrerFacilitator: facId }],
    };
    if (facCode) {
      promoFilter.$or.push({ code: { $regex: `^${facCode}$`, $options: 'i' } });
    }
    const promoCodes = await this.promoCodeModel.find(promoFilter).lean().exec();
    const promoIds = promoCodes.map((p: any) => p._id);
    const promoCodeStrings = promoCodes.map((p: any) => p.code.toUpperCase());

    // C. Promo Redemptions
    const redemptionFilter: any = {
      $or: [{ referrerFacilitator: facId }],
    };
    if (promoIds.length) {
      redemptionFilter.$or.push({ promoId: { $in: promoIds } });
    }
    if (promoCodeStrings.length) {
      redemptionFilter.$or.push({ promoCode: { $in: promoCodeStrings } });
    }
    const redemptions = await this.promoRedemptionModel.find(redemptionFilter).lean().exec();

    // D. Extract unique referred user IDs from both Signup Referrals and Promo Code Redemptions
    const signupUserMap = new Map<string, string>(); // userId -> referralCode
    for (const r of referrals) {
      if (r.referred && Types.ObjectId.isValid(String(r.referred))) {
        signupUserMap.set(String(r.referred), r.referralCode || facCode);
      }
    }

    const promoUserMap = new Map<string, string[]>(); // userId -> promoCodes[]
    for (const red of redemptions) {
      if (red.customer && Types.ObjectId.isValid(String(red.customer))) {
        const uId = String(red.customer);
        const existing = promoUserMap.get(uId) || [];
        if (red.promoCode && !existing.includes(red.promoCode)) {
          existing.push(red.promoCode);
        }
        promoUserMap.set(uId, existing);
      }
    }

    const allReferredUserIds = Array.from(new Set([...signupUserMap.keys(), ...promoUserMap.keys()]));

    // Build itemized breakdown of all referred people
    const { people, ordersPlaced, spend, byType } = await this.resolveReferredPeople(
      allReferredUserIds,
      signupUserMap,
      promoUserMap,
    );

    // Sum promo metrics
    const promoRedemptionsCount = redemptions.length;
    const promoDiscountGiven = redemptions.reduce(
      (sum: number, r: any) => sum + Number(r.discountAmount || r.amount || 0),
      0,
    );
    const promoRevenueGenerated = redemptions.reduce(
      (sum: number, r: any) => sum + Number(r.orderTotal || 0),
      0,
    );

    // Errand Ninja & Vendor aggregate impact
    const { riderDeliveries, riderFees, vendorOrders, vendorGmv, bookingRevenue } =
      await this.resolvePersonaEcosystemMetrics(allReferredUserIds);

    const activeReferrals = people.filter((p) => p.orders > 0 || p.deliveriesCount > 0 || p.vendorOrdersCount > 0).length;
    const totalReferrals = allReferredUserIds.length;
    const conversionRate = totalReferrals > 0 ? Math.round((activeReferrals / totalReferrals) * 100) : 0;

    return {
      id: String(facilitator._id),
      type: 'facilitator',
      role: 'facilitator',
      roleLabel: 'Campus Ambassador',
      roleEmoji: '💎',
      name: facilitator.name || 'Unnamed Ambassador',
      email: facilitator.email,
      phone: facilitator.phone || '',
      matricNumber: facilitator.matricNumber || '',
      skill: facilitator.skill || '',
      referralCode: facilitator.referralCode || '',
      tier: facilitator.tier || 'starter',
      pointsEarned: facilitator.pointsEarned || 0,
      isActive: facilitator.isActive !== false,
      joinedAt: (facilitator as any).createdAt,
      totalReferrals,
      referred: byType,
      activeReferrals,
      conversionRate,
      ordersPlaced,
      spend,
      promoCodes: promoCodes.map((p: any) => ({
        _id: p._id,
        code: p.code,
        discountType: p.discountType,
        value: p.value,
        usageCount: p.usageCount || 0,
        totalRevenueGenerated: p.totalRevenueGenerated || 0,
        isActive: p.isActive,
      })),
      promoRedemptions: promoRedemptionsCount,
      promoDiscountGiven,
      promoRevenueGenerated,
      riderDeliveries,
      riderFees,
      vendorOrders,
      vendorGmv,
      bookingRevenue,
      people,
    };
  }

  /**
   * Find and build rows for User referrers (Students, Errand Ninjas, Vendors, Staff)
   */
  private async fetchAndBuildUserReferrers(persona: string, search: string): Promise<any[]> {
    // 1. Identify users who have referral activity
    const userConditions: any[] = [
      { referralCount: { $gt: 0 } },
    ];

    if (search) {
      userConditions.push(
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } },
      );
    }

    // Also look up users who appear as referrers in Referral or PromoCode collections
    const [referralUserIds, promoReferrerUserIds] = await Promise.all([
      this.referralModel.distinct('referrer'),
      this.promoCodeModel.distinct('referrerUser'),
    ]);

    const activeUserIds = [...referralUserIds, ...promoReferrerUserIds].filter(
      (id) => id && Types.ObjectId.isValid(String(id)),
    );

    if (activeUserIds.length) {
      userConditions.push({ _id: { $in: activeUserIds } });
    }

    const queryFilter: any = { $or: userConditions };

    if (persona === 'staff') {
      queryFilter.role = { $in: ['admin', 'staff'] };
    } else if (persona === 'errander') {
      queryFilter.role = 'errander';
    } else if (persona === 'student') {
      queryFilter.role = 'student';
    } else if (persona === 'vendor') {
      queryFilter.role = 'vendor';
    }

    const users = await this.userModel.find(queryFilter).limit(search ? 100 : 250).lean().exec();

    const rows = await Promise.all(users.map((u: any) => this.buildUserRow(u)));
    return rows;
  }

  /**
   * Build metrics row for a User Referrer (Student, Vendor, Errand Ninja, or Staff)
   */
  private async buildUserRow(user: any): Promise<any> {
    const userId = user._id;
    const userCode = user.referralCode || '';

    // A. Direct Signup Referrals
    const referralFilter: any = {
      $or: [{ referrer: userId }],
    };
    if (userCode) {
      referralFilter.$or.push({ referralCode: userCode });
    }
    const referrals = await this.referralModel.find(referralFilter).lean().exec();

    // B. Linked Promo Codes
    const promoFilter: any = {
      $or: [{ referrerUser: userId }],
    };
    if (userCode) {
      promoFilter.$or.push({ code: { $regex: `^${userCode}$`, $options: 'i' } });
    }
    const promoCodes = await this.promoCodeModel.find(promoFilter).lean().exec();
    const promoIds = promoCodes.map((p: any) => p._id);
    const promoCodeStrings = promoCodes.map((p: any) => p.code.toUpperCase());

    // C. Promo Redemptions
    const redemptionFilter: any = {
      $or: [{ referrerUser: userId }],
    };
    if (promoIds.length) {
      redemptionFilter.$or.push({ promoId: { $in: promoIds } });
    }
    if (promoCodeStrings.length) {
      redemptionFilter.$or.push({ promoCode: { $in: promoCodeStrings } });
    }
    const redemptions = await this.promoRedemptionModel.find(redemptionFilter).lean().exec();

    // D. Extract unique referred user IDs
    const signupUserMap = new Map<string, string>();
    for (const r of referrals) {
      if (r.referred && Types.ObjectId.isValid(String(r.referred))) {
        signupUserMap.set(String(r.referred), r.referralCode || userCode);
      }
    }

    const promoUserMap = new Map<string, string[]>();
    for (const red of redemptions) {
      if (red.customer && Types.ObjectId.isValid(String(red.customer))) {
        const uId = String(red.customer);
        const existing = promoUserMap.get(uId) || [];
        if (red.promoCode && !existing.includes(red.promoCode)) {
          existing.push(red.promoCode);
        }
        promoUserMap.set(uId, existing);
      }
    }

    const allReferredUserIds = Array.from(new Set([...signupUserMap.keys(), ...promoUserMap.keys()]));

    // Build itemized breakdown of referred people
    const { people, ordersPlaced, spend, byType } = await this.resolveReferredPeople(
      allReferredUserIds,
      signupUserMap,
      promoUserMap,
    );

    const promoRedemptionsCount = redemptions.length;
    const promoDiscountGiven = redemptions.reduce(
      (sum: number, r: any) => sum + Number(r.discountAmount || r.amount || 0),
      0,
    );
    const promoRevenueGenerated = redemptions.reduce(
      (sum: number, r: any) => sum + Number(r.orderTotal || 0),
      0,
    );

    const { riderDeliveries, riderFees, vendorOrders, vendorGmv, bookingRevenue } =
      await this.resolvePersonaEcosystemMetrics(allReferredUserIds);

    const activeReferrals = people.filter((p) => p.orders > 0 || p.deliveriesCount > 0 || p.vendorOrdersCount > 0).length;
    const totalReferrals = allReferredUserIds.length;
    const conversionRate = totalReferrals > 0 ? Math.round((activeReferrals / totalReferrals) * 100) : 0;

    let roleLabel = 'Customer / Student';
    let roleEmoji = '🎓';
    let mappedRole: string = user.role || 'student';

    if (user.role === 'admin' || user.role === 'staff') {
      roleLabel = 'Erranders Staff';
      roleEmoji = '👔';
      mappedRole = 'staff';
    } else if (user.role === 'vendor') {
      roleLabel = 'Vendor Merchant';
      roleEmoji = '🏪';
    } else if (user.role === 'errander') {
      roleLabel = 'Errand Ninja';
      roleEmoji = '🛵';
    }

    const autoCode = user.referralCode || `ERR-${(user.firstName || 'REF').substring(0, 4).toUpperCase()}-${String(user._id).substring(18, 22).toUpperCase()}`;

    return {
      id: String(user._id),
      type: 'user',
      role: mappedRole,
      roleLabel,
      roleEmoji,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unnamed Referrer',
      email: user.email,
      phone: user.phone || '',
      avatar: user.avatar || '',
      referralCode: autoCode,
      tier: user.referralCount >= 31 ? 'legend' : user.referralCount >= 16 ? 'ambassador' : user.referralCount >= 6 ? 'hustler' : 'starter',
      pointsEarned: user.points || 0,
      walletBalance: user.walletBalance || 0,
      isActive: user.isActive !== false,
      joinedAt: (user as any).createdAt,
      totalReferrals,
      referred: byType,
      activeReferrals,
      conversionRate,
      ordersPlaced,
      spend,
      promoCodes: promoCodes.map((p: any) => ({
        _id: p._id,
        code: p.code,
        discountType: p.discountType,
        value: p.value,
        usageCount: p.usageCount || 0,
        totalRevenueGenerated: p.totalRevenueGenerated || 0,
        isActive: p.isActive,
      })),
      promoRedemptions: promoRedemptionsCount,
      promoDiscountGiven,
      promoRevenueGenerated,
      riderDeliveries,
      riderFees,
      vendorOrders,
      vendorGmv,
      bookingRevenue,
      people,
    };
  }

  /**
   * Helper: Resolves and aggregates detailed statistics for every referred user
   */
  private async resolveReferredPeople(
    userIds: string[],
    signupUserMap: Map<string, string>,
    promoUserMap: Map<string, string[]>,
  ): Promise<{ people: any[]; ordersPlaced: number; spend: number; byType: { student: number; vendor: number; errander: number } }> {
    const people: any[] = [];
    const byType = { student: 0, vendor: 0, errander: 0 };
    let ordersPlaced = 0;
    let spend = 0;

    if (!userIds.length) {
      return { people, ordersPlaced, spend, byType };
    }

    const objectIds = userIds.map((id) => new Types.ObjectId(id));

    // 1. Fetch User profiles
    const users = await this.userModel
      .find({ _id: { $in: objectIds } })
      .select('firstName lastName email phone role avatar createdAt')
      .lean()
      .exec();

    // 2. Aggregate orders placed by these users as customers
    const orderStats = await this.orderModel
      .aggregate([
        {
          $match: {
            customer: { $in: objectIds },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: '$customer',
            count: { $sum: 1 },
            total: { $sum: '$total' },
            firstOrderAt: { $min: '$createdAt' },
            lastOrderAt: { $max: '$createdAt' },
          },
        },
      ])
      .exec();

    const statMap = new Map(orderStats.map((s: any) => [String(s._id), s]));

    // 3. For any Errand Ninjas, aggregate rider deliveries
    const riderDeliveriesStats = await this.orderModel
      .aggregate([
        {
          $match: {
            errander: { $in: objectIds },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: '$errander',
            count: { $sum: 1 },
            fees: { $sum: { $ifNull: ['$deliveryFee', 0] } },
          },
        },
      ])
      .exec();
    const riderMap = new Map(riderDeliveriesStats.map((r: any) => [String(r._id), r]));

    // 4. For any Vendors, aggregate store orders & GMV
    const vendorsOwned = await this.vendorModel
      .find({ owner: { $in: objectIds } })
      .select('_id owner name')
      .lean()
      .exec();

    const ownerToStoresMap = new Map<string, Types.ObjectId[]>();
    for (const v of vendorsOwned) {
      const oId = String(v.owner);
      const list = ownerToStoresMap.get(oId) || [];
      list.push(new Types.ObjectId(String(v._id)));
      ownerToStoresMap.set(oId, list);
    }

    const storeIds = vendorsOwned.map((v: any) => v._id);
    let storeOrdersMap = new Map<string, any>();
    if (storeIds.length) {
      const vendorStats = await this.orderModel
        .aggregate([
          {
            $match: {
              vendor: { $in: storeIds },
              status: { $nin: ['cancelled', 'refunded'] },
            },
          },
          {
            $group: {
              _id: '$vendor',
              count: { $sum: 1 },
              gmv: { $sum: '$total' },
            },
          },
        ])
        .exec();
      storeOrdersMap = new Map(vendorStats.map((vs: any) => [String(vs._id), vs]));
    }

    // 5. Build individual person records
    for (const u of users) {
      const uId = String(u._id);
      const roleStr = String(u.role || 'student').toLowerCase();
      if (roleStr in byType) {
        byType[roleStr as keyof typeof byType] += 1;
      } else {
        byType.student += 1;
      }

      const orderStat: any = statMap.get(uId);
      const personOrders = orderStat?.count || 0;
      const personSpend = orderStat?.total || 0;

      ordersPlaced += personOrders;
      spend += personSpend;

      const hasSignup = signupUserMap.has(uId);
      const hasPromo = promoUserMap.has(uId);
      const promoCodesUsed = promoUserMap.get(uId) || [];

      let attributionType: 'signup_code' | 'promo_code' | 'both' = 'signup_code';
      if (hasSignup && hasPromo) {
        attributionType = 'both';
      } else if (hasPromo) {
        attributionType = 'promo_code';
      }

      // Rider deliveries
      const riderStat: any = riderMap.get(uId);
      const deliveriesCount = riderStat?.count || 0;
      const deliveryFeesEarned = riderStat?.fees || 0;

      // Vendor orders
      const userStores = ownerToStoresMap.get(uId) || [];
      let vendorOrdersCount = 0;
      let vendorGmv = 0;
      for (const sId of userStores) {
        const sStat: any = storeOrdersMap.get(String(sId));
        if (sStat) {
          vendorOrdersCount += sStat.count || 0;
          vendorGmv += sStat.gmv || 0;
        }
      }

      people.push({
        id: uId,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'User',
        email: u.email,
        phone: u.phone || '',
        role: u.role || 'student',
        avatar: u.avatar || '',
        joinedAt: u.createdAt,
        attributionType,
        signupReferralCode: signupUserMap.get(uId) || null,
        promoCodesUsed,
        orders: personOrders,
        spend: personSpend,
        firstOrderAt: orderStat?.firstOrderAt || null,
        lastOrderAt: orderStat?.lastOrderAt || null,
        deliveriesCount,
        deliveryFeesEarned,
        vendorOrdersCount,
        vendorGmv,
      });
    }

    // Sort people by spend desc
    people.sort((a, b) => {
      if (b.spend !== a.spend) return b.spend - a.spend;
      return b.orders - a.orders;
    });

    return { people, ordersPlaced, spend, byType };
  }

  /**
   * Helper: Resolves ecosystem metrics for referred riders and store owners
   */
  private async resolvePersonaEcosystemMetrics(userIds: string[]): Promise<{
    riderDeliveries: number;
    riderFees: number;
    vendorOrders: number;
    vendorGmv: number;
    bookingRevenue: number;
  }> {
    let riderDeliveries = 0;
    let riderFees = 0;
    let vendorOrders = 0;
    let vendorGmv = 0;
    let bookingRevenue = 0;

    if (!userIds.length) {
      return { riderDeliveries, riderFees, vendorOrders, vendorGmv, bookingRevenue };
    }

    const objectIds = userIds.map((id) => new Types.ObjectId(id));

    // Rider Deliveries
    const riderStats = await this.orderModel
      .aggregate([
        {
          $match: {
            errander: { $in: objectIds },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            fees: { $sum: { $ifNull: ['$deliveryFee', 0] } },
          },
        },
      ])
      .exec();
    riderDeliveries = riderStats[0]?.count || 0;
    riderFees = riderStats[0]?.fees || 0;

    // Vendor Stores & Bookings
    const ownedVendors = await this.vendorModel
      .find({ owner: { $in: objectIds } })
      .select('_id')
      .lean()
      .exec();

    if (ownedVendors.length) {
      const vendorIds = ownedVendors.map((v: any) => v._id);
      const vendorStats = await this.orderModel
        .aggregate([
          {
            $match: {
              vendor: { $in: vendorIds },
              status: { $nin: ['cancelled', 'refunded'] },
            },
          },
          { $group: { _id: null, count: { $sum: 1 }, gmv: { $sum: '$total' } } },
        ])
        .exec();
      vendorOrders = vendorStats[0]?.count || 0;
      vendorGmv = vendorStats[0]?.gmv || 0;

      const bookingStats = await this.appointmentModel
        .aggregate([
          { $match: { vendor: { $in: vendorIds }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$price' } } },
        ])
        .exec();
      bookingRevenue = bookingStats[0]?.total || 0;
    }

    return { riderDeliveries, riderFees, vendorOrders, vendorGmv, bookingRevenue };
  }

  /**
   * Retrieves full itemized order and spend history for a specific referred person
   */
  async getReferredPersonOrders(userId: string): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      return { orders: [], user: null, deliveries: [], storeOrders: [] };
    }
    const userObjId = new Types.ObjectId(userId);

    const user: any = await this.userModel
      .findById(userObjId)
      .select('firstName lastName email phone role avatar createdAt points walletBalance referralCode')
      .lean()
      .exec();

    // 1. Paid orders placed as a customer
    const orders = await this.orderModel
      .find({
        customer: userObjId,
        status: { $nin: ['cancelled', 'refunded'] },
      })
      .populate('vendor', 'name logo address phone category')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    const formattedOrders = orders.map((o: any) => ({
      _id: o._id,
      orderNumber: o.orderNumber || String(o._id).substring(18, 24).toUpperCase(),
      storeName: o.vendor?.name || 'Erranders Partner Store',
      orderType: o.orderType || 'delivery',
      status: o.status,
      subtotal: o.subtotal || 0,
      deliveryFee: o.deliveryFee || 0,
      total: o.total || 0,
      promoCode: o.promoCode || o.appliedPromoCode || null,
      itemsCount: Array.isArray(o.items) ? o.items.length : 1,
      items: (o.items || []).map((i: any) => ({
        name: i.name || i.item?.name || 'Item',
        quantity: i.quantity || 1,
        price: i.price || 0,
      })),
      createdAt: o.createdAt,
    }));

    // 2. If Errander, deliveries completed
    let formattedDeliveries: any[] = [];
    if (user?.role === 'errander') {
      const deliveries = await this.orderModel
        .find({
          errander: userObjId,
          status: { $nin: ['cancelled', 'refunded'] },
        })
        .populate('vendor', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
        .exec();

      formattedDeliveries = deliveries.map((d: any) => ({
        _id: d._id,
        orderNumber: d.orderNumber || String(d._id).substring(18, 24).toUpperCase(),
        storeName: d.vendor?.name || 'Erranders Store',
        deliveryFee: d.deliveryFee || 0,
        status: d.status,
        createdAt: d.createdAt,
      }));
    }

    // 3. If Vendor, store orders
    let formattedStoreOrders: any[] = [];
    if (user?.role === 'vendor') {
      const ownedStores = await this.vendorModel.find({ owner: userObjId }).select('_id name').lean().exec();
      const storeIds = ownedStores.map((s: any) => s._id);
      if (storeIds.length) {
        const storeOrders = await this.orderModel
          .find({
            vendor: { $in: storeIds },
            status: { $nin: ['cancelled', 'refunded'] },
          })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
          .exec();

        formattedStoreOrders = storeOrders.map((so: any) => ({
          _id: so._id,
          orderNumber: so.orderNumber || String(so._id).substring(18, 24).toUpperCase(),
          total: so.total || 0,
          status: so.status,
          createdAt: so.createdAt,
        }));
      }
    }

    const totalSpent = formattedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    return {
      user: {
        id: user?._id,
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User',
        email: user?.email,
        phone: user?.phone,
        role: user?.role,
        avatar: user?.avatar,
        joinedAt: (user as any)?.createdAt,
        points: user?.points || 0,
        walletBalance: user?.walletBalance || 0,
      },
      ordersCount: formattedOrders.length,
      totalSpent,
      orders: formattedOrders,
      deliveries: formattedDeliveries,
      storeOrders: formattedStoreOrders,
    };
  }

  /**
   * Platform-wide Summary Metrics across all Ambassador & Referral Channels
   */
  async getOverviewStats(): Promise<any> {
    const [
      facilitatorsCount,
      activeFacilitatorsCount,
      totalReferralDocs,
      completedReferralDocs,
      totalPromos,
      totalRedemptions,
      referralAggregate,
      promoAggregate,
    ] = await Promise.all([
      this.facilitatorModel.countDocuments({}),
      this.facilitatorModel.countDocuments({ isActive: { $ne: false } }),
      this.referralModel.countDocuments({}),
      this.referralModel.countDocuments({ firstOrderCompleted: true }),
      this.promoCodeModel.countDocuments({ isReferralPromo: true }),
      this.promoRedemptionModel.countDocuments({}),
      this.referralModel.aggregate([
        { $group: { _id: '$referredType', count: { $sum: 1 } } },
      ]),
      this.promoRedemptionModel.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$orderTotal', 0] } },
            totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
          },
        },
      ]),
    ]);

    const personaBreakdown = { student: 0, vendor: 0, errander: 0 };
    for (const agg of referralAggregate) {
      const key = String(agg._id || '').toLowerCase();
      if (key in personaBreakdown) personaBreakdown[key as keyof typeof personaBreakdown] = agg.count;
    }

    // Get total spend from all referred users
    const referredUserIds = await this.referralModel.distinct('referred');
    const validUserIds = (referredUserIds || [])
      .filter((id: any) => id && Types.ObjectId.isValid(String(id)))
      .map((id: any) => new Types.ObjectId(id));

    let totalSpendFromReferrals = 0;
    let totalOrdersFromReferrals = 0;
    let payingReferredUsers = 0;

    if (validUserIds.length) {
      const orderStats = await this.orderModel.aggregate([
        {
          $match: {
            customer: { $in: validUserIds },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            uniqueCustomers: { $addToSet: '$customer' },
          },
        },
      ]);

      if (orderStats.length) {
        totalSpendFromReferrals = orderStats[0].totalSpend || 0;
        totalOrdersFromReferrals = orderStats[0].totalOrders || 0;
        payingReferredUsers = (orderStats[0].uniqueCustomers || []).length;
      }
    }

    return {
      totalAmbassadors: facilitatorsCount,
      activeAmbassadors: activeFacilitatorsCount,
      totalReferralSignups: totalReferralDocs,
      firstOrdersCompleted: completedReferralDocs,
      totalReferredPeople: validUserIds.length,
      payingReferredUsers,
      totalOrdersFromReferrals,
      totalSpendFromReferrals,
      totalPromoCodes: totalPromos,
      totalPromoRedemptions: totalRedemptions,
      totalPromoRevenue: promoAggregate[0]?.totalRevenue || 0,
      totalPromoDiscountsGiven: promoAggregate[0]?.totalDiscount || 0,
      personaBreakdown,
      conversionRate: validUserIds.length > 0 ? Math.round((payingReferredUsers / validUserIds.length) * 100) : 0,
    };
  }
}
