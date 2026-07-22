import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCode } from './schemas/promo-code.schema';

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCode>,
  ) {}

  async create(data: any): Promise<PromoCode> {
    const existing = await this.promoCodeModel.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw new BadRequestException('Promo code already exists');
    }
    const promo = new this.promoCodeModel({
      ...data,
      code: data.code.toUpperCase(),
    });
    return promo.save();
  }

  async findAll(): Promise<PromoCode[]> {
    return this.promoCodeModel.find().sort({ createdAt: -1 });
  }

  async findByCode(code: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findOne({ code: code.toUpperCase() });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    return promo;
  }

  async validateCode(code: string, subtotal: number): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findOne({ code: code.toUpperCase() });
    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }
    if (!promo.isActive) {
      throw new BadRequestException('Promo code is not active');
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new BadRequestException('Promo code has expired');
    }
    if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
      throw new BadRequestException(`Order subtotal must be at least ₦${promo.minOrderAmount} to use this code`);
    }
    if (promo.maxUsageCount && promo.usageCount >= promo.maxUsageCount) {
      throw new BadRequestException('Promo code usage limit reached');
    }
    return promo;
  }

  async incrementUsage(code: string) {
    await this.promoCodeModel.updateOne(
      { code: code.toUpperCase() },
      { $inc: { usageCount: 1 } }
    );
  }

  async toggleActive(id: string): Promise<PromoCode> {
    const promo = await this.promoCodeModel.findById(id);
    if (!promo) throw new NotFoundException('Promo code not found');
    promo.isActive = !promo.isActive;
    return promo.save();
  }
}
