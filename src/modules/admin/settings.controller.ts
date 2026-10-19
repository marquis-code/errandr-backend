import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from './schemas/system-setting.schema';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(
    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,
  ) { }

  @Get('errands/custom')
  @ApiOperation({ summary: 'Get custom errand pricing settings' })
  async getCustomErrandSettings() {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      // Seed default settings if not exists
      setting = await this.settingModel.create({
        key: 'custom_errand',
        value: {
          baseFee: 450,
          expressFee: 850,
          roomDeliveryFee: 350,
          dropoffServiceFee: 300,
          platformFee: 100,
          convenienceFee: 100,
          commissionFlatFee: 50,
          customErrandCommissionPercentage: 20,
          customErrandSafetyBufferPercentage: 20,
          platformProcessingFee: 100,
          platformServiceFeePercentage: 5,
          foodMarkupPercentage: 5,
          minOutsideCampusFee: 450,
          minCampusEnvironsFee: 350,
          minCustomErrandFee: 300,
          enableTransferFee: false,
          interceptionEnabled: true,
          interceptionFirstErranderPercentage: 60,
          interceptionSecondErranderPercentage: 40,
        },
      });
    }

    const val = { ...(setting.value || {}) };
    const feeVal = val.convenienceFee !== undefined && val.convenienceFee !== null
      ? Number(val.convenienceFee)
      : (val.platformFee !== undefined && val.platformFee !== null ? Number(val.platformFee) : 150);

    val.convenienceFee = feeVal;
    val.platformFee = feeVal;
    val.platformProcessingFee = val.platformProcessingFee !== undefined && val.platformProcessingFee !== null
      ? Number(val.platformProcessingFee)
      : 0;
    val.platformServiceFeePercentage = val.platformServiceFeePercentage !== undefined && val.platformServiceFeePercentage !== null
      ? Number(val.platformServiceFeePercentage)
      : 0;
    val.commissionFlatFee = (val.commissionFlatFee !== undefined && val.commissionFlatFee !== null && !isNaN(Number(val.commissionFlatFee)))
      ? Math.max(0, Math.min(50, Number(val.commissionFlatFee)))
      : 0;
    val.foodMarkupPercentage = (val.foodMarkupPercentage !== undefined && val.foodMarkupPercentage !== null && !isNaN(Number(val.foodMarkupPercentage)))
      ? Number(val.foodMarkupPercentage)
      : 0;
    val.customErrandSafetyBufferPercentage = (val.customErrandSafetyBufferPercentage !== undefined && val.customErrandSafetyBufferPercentage !== null && !isNaN(Number(val.customErrandSafetyBufferPercentage)))
      ? Number(val.customErrandSafetyBufferPercentage)
      : 0;
    val.roomDeliveryFee = (val.roomDeliveryFee !== undefined && val.roomDeliveryFee !== null && !isNaN(Number(val.roomDeliveryFee)))
      ? Number(val.roomDeliveryFee)
      : 300;
    val.dropoffServiceFee = (val.dropoffServiceFee !== undefined && val.dropoffServiceFee !== null && !isNaN(Number(val.dropoffServiceFee)))
      ? Number(val.dropoffServiceFee)
      : 300;
    val.interceptionEnabled = val.interceptionEnabled !== false;
    val.interceptionFirstErranderPercentage = Number(val.interceptionFirstErranderPercentage ?? 60);
    val.interceptionSecondErranderPercentage = Number(val.interceptionSecondErranderPercentage ?? 40);
    return val;
  }

  @Put('errands/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update custom errand pricing settings (admin only)' })
  async updateCustomErrandSettings(@Body() body: {
    baseFee: number;
    expressFee: number;
    roomDeliveryFee?: number;
    dropoffServiceFee?: number;
    platformFee?: number;
    convenienceFee?: number;
    commissionFlatFee?: number;
    customErrandCommissionPercentage?: number;
    customErrandSafetyBufferPercentage?: number;
    platformProcessingFee?: number;
    platformServiceFeePercentage?: number;
    foodMarkupPercentage?: number;
    minOutsideCampusFee?: number;
    minCampusEnvironsFee?: number;
    minCustomErrandFee?: number;
    enableTransferFee?: boolean;
    interceptionEnabled?: boolean;
    interceptionFirstErranderPercentage?: number;
    interceptionSecondErranderPercentage?: number;
  }) {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'custom_errand' });
    }

    const targetServiceFee = body.convenienceFee !== undefined && body.convenienceFee !== null
      ? Number(body.convenienceFee)
      : (body.platformFee !== undefined && body.platformFee !== null ? Number(body.platformFee) : (setting.value?.convenienceFee ?? 150));

    const rawCommission = body.commissionFlatFee !== undefined && body.commissionFlatFee !== null ? body.commissionFlatFee : (setting.value?.commissionFlatFee ?? 0);
    const resolvedCommissionFlatFee = Math.min(Math.max(0, Number(rawCommission)), 50);

    let firstPct = body.interceptionFirstErranderPercentage !== undefined
      ? Math.max(0, Math.min(100, Number(body.interceptionFirstErranderPercentage)))
      : (setting.value?.interceptionFirstErranderPercentage ?? 60);
    let secondPct = body.interceptionSecondErranderPercentage !== undefined
      ? Math.max(0, Math.min(100, Number(body.interceptionSecondErranderPercentage)))
      : (setting.value?.interceptionSecondErranderPercentage ?? (100 - firstPct));

    if (firstPct + secondPct !== 100) {
      secondPct = Math.max(0, 100 - firstPct);
    }

    const newValue = {
      baseFee: Number(body.baseFee ?? 450),
      expressFee: Number(body.expressFee ?? 850),
      roomDeliveryFee: Number(body.roomDeliveryFee ?? 300),
      dropoffServiceFee: Number(body.dropoffServiceFee ?? 300),
      platformFee: targetServiceFee,
      convenienceFee: targetServiceFee,
      commissionFlatFee: resolvedCommissionFlatFee,
      customErrandCommissionPercentage: Number(body.customErrandCommissionPercentage ?? 20),
      platformProcessingFee: Number(body.platformProcessingFee ?? 0),
      platformServiceFeePercentage: Number(body.platformServiceFeePercentage ?? 0),
      foodMarkupPercentage: Number(body.foodMarkupPercentage ?? 0),
      minOutsideCampusFee: Number(body.minOutsideCampusFee ?? 450),
      minCampusEnvironsFee: Number(body.minCampusEnvironsFee ?? 450),
      minCustomErrandFee: Number(body.minCustomErrandFee ?? 400),
      customErrandSafetyBufferPercentage: Number(body.customErrandSafetyBufferPercentage ?? 0),
      enableTransferFee: Boolean(body.enableTransferFee),
      interceptionEnabled: body.interceptionEnabled ?? (setting.value?.interceptionEnabled !== false),
      interceptionFirstErranderPercentage: firstPct,
      interceptionSecondErranderPercentage: secondPct,
    };

    const updated = await this.settingModel.findOneAndUpdate(
      { key: 'custom_errand' },
      { $set: { value: newValue } },
      { upsert: true, new: true }
    ).exec();

    return updated.value;
  }

  @Get('market-pool/bank')
  @ApiOperation({ summary: 'Get market pool bank settings' })
  async getMarketPoolBankSettings() {
    let setting = await this.settingModel.findOne({ key: 'market_pool_bank_account' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'market_pool_bank_account',
        value: { bankName: '', accountNumber: '', accountName: '' },
      });
    }
    return setting.value;
  }

  @Put('market-pool/bank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update market pool bank settings (admin only)' })
  async updateMarketPoolBankSettings(@Body() body: { bankName: string; accountNumber: string; accountName: string }) {
    let setting = await this.settingModel.findOne({ key: 'market_pool_bank_account' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'market_pool_bank_account' });
    }
    setting.value = { ...setting.value, ...body };
    await setting.save();
    return setting.value;
  }

  @Get('market-pool/config')
  @ApiOperation({ summary: 'Get market pool general config (slots, fees)' })
  async getMarketPoolConfig() {
    let setting = await this.settingModel.findOne({ key: 'market_pool_config' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'market_pool_config',
        value: { slots: ['Morning (8am - 12pm)', 'Afternoon (1pm - 5pm)'], feeType: 'flat', feeValue: 500 },
      });
    }
    return setting.value;
  }

  @Put('market-pool/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update market pool config (admin only)' })
  async updateMarketPoolConfig(@Body() body: { slots: string[]; feeType: 'flat' | 'percentage'; feeValue: number }) {
    let setting = await this.settingModel.findOne({ key: 'market_pool_config' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'market_pool_config' });
    }
    setting.value = { ...setting.value, ...body };
    await setting.save();
    return setting.value;
  }

  @Get('negotiation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get negotiation platform fee settings' })
  async getNegotiationSettings() {
    let setting = await this.settingModel.findOne({ key: 'negotiation_settings' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'negotiation_settings',
        value: { feeType: 'flat', amount: 50 },
      });
    }
    return setting.value;
  }

  @Put('negotiation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update negotiation platform fee settings (admin only)' })
  async updateNegotiationSettings(@Body() body: { feeType: 'flat' | 'percentage'; amount: number }) {
    let setting = await this.settingModel.findOne({ key: 'negotiation_settings' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'negotiation_settings' });
    }
    setting.value = {
      feeType: body.feeType || 'flat',
      amount: Number(body.amount ?? 50),
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('communications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get global communications settings' })
  async getCommunicationsSettings() {
    let setting = await this.settingModel.findOne({ key: 'communications' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'communications',
        value: { emailsEnabled: true, pushNotificationsEnabled: true },
      });
    }
    return setting.value;
  }

  @Put('communications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update global communications settings (admin only)' })
  async updateCommunicationsSettings(@Body() body: { emailsEnabled: boolean; pushNotificationsEnabled: boolean }) {
    let setting = await this.settingModel.findOne({ key: 'communications' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'communications' });
    }
    setting.value = {
      emailsEnabled: body.emailsEnabled ?? true,
      pushNotificationsEnabled: body.pushNotificationsEnabled ?? true,
    };
    // Mark modified for mixed type objects in mongoose
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('advert/public')
  @ApiOperation({ summary: 'Get global advert settings for frontend' })
  async getAdvertSettingsPublic() {
    const DEFAULT_CUSTOM_ADS = [
      {
        id: 'ad-waris-kitchen',
        title: 'Waris Kitchen Weekend Special',
        description: 'Smoky Jollof rice, peppered turkey & chilled Chapman delivered directly to your hostel block.',
        badgeText: '🔥 20% Student Discount',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
        ctaText: 'Order from Waris',
        ctaLink: '/vendors',
        advertiserName: 'Waris Kitchen',
        isActive: true,
        placement: 'both',
        impressions: 142,
        clicks: 28,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad-erranders-barter',
        title: 'Trade Unused Items on Barter',
        description: 'Swap textbooks, gadgets, calculators, and room appliances safely with students on campus.',
        badgeText: '🔄 Erranders Barter',
        imageUrl: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?auto=format&fit=crop&w=800&q=80',
        ctaText: 'Start Trading on Barter',
        ctaLink: 'https://decluttered.erranders.org',
        advertiserName: 'Erranders Barter',
        isActive: true,
        placement: 'both',
        impressions: 310,
        clicks: 54,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad-errand-ninja-custom',
        title: 'Need an Off-Campus Errand Handled?',
        description: 'Market runs, pharmacy pickups, or parcel drops at the campus gate. Request an Errand Ninja in seconds.',
        badgeText: '⚡ Lightning Fast',
        imageUrl: 'https://images.unsplash.com/photo-1586880244406-556ebe35f282?auto=format&fit=crop&w=800&q=80',
        ctaText: 'Book Custom Errand',
        ctaLink: '/errands/custom',
        advertiserName: 'Erranders Logistics',
        isActive: true,
        placement: 'both',
        impressions: 285,
        clicks: 63,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad-campus-tech-care',
        title: 'Screen Broken? Instant Tech Fix',
        description: 'Certified campus technicians for iPhone, Samsung, and laptops. Screen repairs with 30-day student warranty.',
        badgeText: '🛠️ 15% Student Discount',
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
        ctaText: 'Request Tech Errand',
        ctaLink: '/errands/custom',
        advertiserName: 'Campus Tech Care',
        isActive: true,
        placement: 'both',
        impressions: 198,
        clicks: 37,
        createdAt: new Date().toISOString(),
      },
    ];

    let setting = await this.settingModel.findOne({ key: 'advert' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'advert',
        value: {
          enabled: true,
          intervalMinutes: 15,
          autoCloseSeconds: 0,
          contentType: 'custom',
          customAds: DEFAULT_CUSTOM_ADS,
          customAd: DEFAULT_CUSTOM_ADS[0],
        },
      });
    } else {
      let modified = false;
      if (!setting.value) {
        setting.value = {};
        modified = true;
      }
      if (!setting.value.customAds || !Array.isArray(setting.value.customAds) || setting.value.customAds.length === 0) {
        setting.value.customAds = DEFAULT_CUSTOM_ADS;
        setting.value.customAd = DEFAULT_CUSTOM_ADS[0];
        modified = true;
      }
      if (modified) {
        setting.markModified('value');
        await setting.save();
      }
    }
    return setting.value;
  }

  @Get('advert')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get global advert settings' })
  async getAdvertSettings() {
    return this.getAdvertSettingsPublic();
  }

  @Put('advert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update global advert settings (admin only)' })
  async updateAdvertSettings(@Body() body: any) {
    let setting = await this.settingModel.findOne({ key: 'advert' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'advert' });
    }
    const customAds = Array.isArray(body.customAds) ? body.customAds : (setting.value?.customAds || []);
    const firstActive = customAds.find((a: any) => a.isActive !== false) || customAds[0] || body.customAd || {
      title: '',
      description: '',
      imageUrl: '',
      ctaText: '',
      ctaLink: '',
    };

    setting.value = {
      enabled: body.enabled ?? true,
      intervalMinutes: Number(body.intervalMinutes ?? 15),
      autoCloseSeconds: Number(body.autoCloseSeconds ?? 0),
      contentType: body.contentType || 'custom',
      customAds: customAds,
      customAd: firstActive,
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Post('advert/:id/impression')
  @ApiOperation({ summary: 'Record an advert impression (public)' })
  async trackAdvertImpression(@Param('id') id: string) {
    const setting = await this.settingModel.findOne({ key: 'advert' }).exec();
    if (setting && setting.value?.customAds && Array.isArray(setting.value.customAds)) {
      const ad = setting.value.customAds.find((a: any) => a.id === id);
      if (ad) {
        ad.impressions = (ad.impressions || 0) + 1;
        setting.markModified('value');
        await setting.save();
        return { success: true, impressions: ad.impressions };
      }
    }
    return { success: false };
  }

  @Post('advert/:id/click')
  @ApiOperation({ summary: 'Record an advert CTA click (public)' })
  async trackAdvertClick(@Param('id') id: string) {
    const setting = await this.settingModel.findOne({ key: 'advert' }).exec();
    if (setting && setting.value?.customAds && Array.isArray(setting.value.customAds)) {
      const ad = setting.value.customAds.find((a: any) => a.id === id);
      if (ad) {
        ad.clicks = (ad.clicks || 0) + 1;
        setting.markModified('value');
        await setting.save();
        return { success: true, clicks: ad.clicks };
      }
    }
    return { success: false };
  }

  @Get('exam-brethren/public')
  @ApiOperation({ summary: 'Get exam brethren campaign status for frontend' })
  async getExamBrethrenSettingsPublic() {
    let setting = await this.settingModel.findOne({ key: 'exam_brethren_campaign' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'exam_brethren_campaign',
        value: {
          isActive: false,
        },
      });
    }
    return setting.value;
  }

  @Put('exam-brethren')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update exam brethren campaign status (admin only)' })
  async updateExamBrethrenSettings(@Body() body: { isActive: boolean }) {
    let setting = await this.settingModel.findOne({ key: 'exam_brethren_campaign' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'exam_brethren_campaign' });
    }
    setting.value = {
      isActive: body.isActive ?? false,
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('exam-promo/public')
  @ApiOperation({ summary: 'Get exam promo banner settings for frontend' })
  async getExamPromoSettingsPublic() {
    let setting = await this.settingModel.findOne({ key: 'exam_promo_banner' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'exam_promo_banner',
        value: {
          enabled: true,
          text: 'We are running exam combo from your Favorite vendors: 1. Iya Waris Kitchen 2. Chijoke Kithcen 3. HVIP Kitchen 4. Motee Chips 5. Aunty Iyabo Kitchen. We are giving 1000 off form any purchease from these stores. Limited Offers available and offer runs through out the exam duraton'
        },
      });
    }
    return setting.value;
  }

  @Put('exam-promo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update exam promo banner settings (admin only)' })
  async updateExamPromoSettings(@Body() body: { enabled: boolean; text: string }) {
    let setting = await this.settingModel.findOne({ key: 'exam_promo_banner' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'exam_promo_banner' });
    }
    setting.value = {
      enabled: body.enabled ?? false,
      text: body.text ?? ''
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('erranders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get global errander settings' })
  async getErranderSettings() {
    let setting = await this.settingModel.findOne({ key: 'errander_settings' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'errander_settings',
        value: { maxConcurrentOrders: 0 },
      });
    }
    return setting.value;
  }

  @Put('erranders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update global errander settings (admin only)' })
  async updateErranderSettings(@Body() body: { maxConcurrentOrders: number }) {
    let setting = await this.settingModel.findOne({ key: 'errander_settings' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'errander_settings' });
    }
    setting.value = {
      maxConcurrentOrders: Number(body.maxConcurrentOrders ?? 0),
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('payout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander minimum payout settings' })
  async getPayoutSettings() {
    let setting = await this.settingModel.findOne({ key: 'errander_minimum_payout' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'errander_minimum_payout',
        value: { amount: 1000 },
      });
    }
    return setting.value;
  }

  @Put('payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update errander minimum payout amount (admin only)' })
  async updatePayoutSettings(@Body() body: { amount: number }) {
    let setting = await this.settingModel.findOne({ key: 'errander_minimum_payout' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'errander_minimum_payout' });
    }
    setting.value = {
      amount: Number(body.amount ?? 1000),
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }

  @Get('platform-status/public')
  @ApiOperation({ summary: 'Get per-app platform closed status for frontends' })
  async getPlatformStatusPublic() {
    let setting = await this.settingModel.findOne({ key: 'platform_status' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'platform_status',
        value: {
          isStudentAppClosed: false,
          isVendorAppClosed: false,
          isDispatchAppClosed: false,
        },
      });
    }
    // Migrate legacy single-toggle format
    const val = setting.value as any;
    const isStudentAppClosed = val.isStudentAppClosed ?? val.isClosed ?? false;
    const isVendorAppClosed = val.isVendorAppClosed ?? val.isClosed ?? false;
    const isDispatchAppClosed = val.isDispatchAppClosed ?? val.isClosed ?? false;
    return {
      isStudentAppClosed,
      isVendorAppClosed,
      isDispatchAppClosed,
      // Backward compat: true if ANY app is closed
      isClosed: isStudentAppClosed || isVendorAppClosed || isDispatchAppClosed,
    };
  }

  @Put('platform-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update per-app platform closed status (admin only)' })
  async updatePlatformStatus(@Body() body: { isStudentAppClosed?: boolean; isVendorAppClosed?: boolean; isDispatchAppClosed?: boolean; isClosed?: boolean }) {
    let setting = await this.settingModel.findOne({ key: 'platform_status' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'platform_status' });
    }
    // Support legacy single-toggle callers: if only isClosed is sent, apply to all
    if (body.isClosed !== undefined && body.isStudentAppClosed === undefined && body.isVendorAppClosed === undefined && body.isDispatchAppClosed === undefined) {
      setting.value = {
        isStudentAppClosed: body.isClosed,
        isVendorAppClosed: body.isClosed,
        isDispatchAppClosed: body.isClosed,
      };
    } else {
      setting.value = {
        isStudentAppClosed: body.isStudentAppClosed ?? false,
        isVendorAppClosed: body.isVendorAppClosed ?? false,
        isDispatchAppClosed: body.isDispatchAppClosed ?? false,
      };
    }
    setting.markModified('value');
    await setting.save();
    return setting.value;
  }
}
