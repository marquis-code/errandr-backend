import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

/**
 * Who referred whom, and what those referrals have been worth.
 *
 * An ambassador programme is only manageable if the person running it can answer three
 * questions without asking an engineer: who signed up, what have they ordered, and how much
 * money passed through. This assembles all three from the referral records rather than from
 * a hand-maintained spreadsheet.
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
  ) {}

  /** Every ambassador, with their referrals and what those referrals spent. */
  async overview(): Promise<any> {
    const facilitators = await this.facilitatorModel.find({}).lean().exec();

    const rows = await Promise.all(
      facilitators.map((f: any) => this.buildRow(f)),
    );

    // An ambassador with no referrals still belongs in the list — that is a person to follow up.
    return rows.sort((a, b) => b.spend - a.spend);
  }

  private async buildRow(facilitator: any): Promise<any> {
    const referrals = await this.referralModel
      .find({
        $or: [
          { facilitatorReferrer: facilitator._id },
          { referralCode: facilitator.referralCode },
        ],
      })
      .lean()
      .exec();

    const referredIds = referrals
      .map((r: any) => r.referred)
      .filter(Boolean)
      .map((id: any) => String(id));

    const uniqueIds = Array.from(new Set(referredIds)).filter((id) => Types.ObjectId.isValid(id));

    const byType = { student: 0, vendor: 0, errander: 0 };
    for (const r of referrals) {
      const key = String(r.referredType || '').toLowerCase();
      if (key in byType) byType[key as keyof typeof byType] += 1;
    }

    let ordersPlaced = 0;
    let spend = 0;
    const people: any[] = [];

    if (uniqueIds.length) {
      const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

      const users = await this.userModel
        .find({ _id: { $in: objectIds } })
        .select('firstName lastName email role createdAt')
        .lean()
        .exec();

      // Orders count as spend only when they were actually paid for; a cancelled order is a
      // referral that produced nothing, and mixing the two makes the numbers meaningless.
      const orderStats = await this.orderModel
        .aggregate([
          {
            $match: {
              customer: { $in: objectIds },
              status: { $nin: ['cancelled', 'refunded'] },
            },
          },
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
        ])
        .exec();

      ordersPlaced = orderStats[0]?.count || 0;
      spend = orderStats[0]?.total || 0;

      const perPerson = await this.orderModel
        .aggregate([
          {
            $match: {
              customer: { $in: objectIds },
              status: { $nin: ['cancelled', 'refunded'] },
            },
          },
          { $group: { _id: '$customer', count: { $sum: 1 }, total: { $sum: '$total' } } },
        ])
        .exec();

      const statMap = new Map(perPerson.map((s: any) => [String(s._id), s]));

      for (const u of users) {
        const stat: any = statMap.get(String(u._id));
        people.push({
          id: String(u._id),
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unnamed',
          email: u.email,
          role: u.role,
          joinedAt: u.createdAt,
          orders: stat?.count || 0,
          spend: stat?.total || 0,
        });
      }
    }

    // Promo redemptions on a code carrying this ambassador's name.
    let promoRedemptions = 0;
    let promoDiscountGiven = 0;
    if (facilitator.referralCode) {
      const promos = await this.promoCodeModel
        .find({ code: { $regex: `^${facilitator.referralCode}$`, $options: 'i' } })
        .select('_id')
        .lean()
        .exec();

      if (promos.length) {
        const promoIds = promos.map((p: any) => p._id);
        const redemptions = await this.promoRedemptionModel
          .find({ promoId: { $in: promoIds } })
          .lean()
          .exec();
        promoRedemptions = redemptions.length;
        promoDiscountGiven = redemptions.reduce(
          (sum: number, r: any) => sum + Number(r.discountAmount || r.amount || 0),
          0,
        );
      }
    }

    return {
      id: String(facilitator._id),
      name: facilitator.name || 'Unnamed ambassador',
      email: facilitator.email,
      phone: facilitator.phone,
      referralCode: facilitator.referralCode,
      tier: facilitator.tier,
      isActive: facilitator.isActive !== false,
      joinedAt: facilitator.createdAt,
      totalReferrals: referrals.length,
      referred: byType,
      activeReferrals: people.filter((p) => p.orders > 0).length,
      ordersPlaced,
      spend,
      promoRedemptions,
      promoDiscountGiven,
      people: people.sort((a, b) => b.spend - a.spend),
    };
  }
}
