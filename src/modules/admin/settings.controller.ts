import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
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
  ) {}

  @Get('errands/custom')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get custom errand pricing settings' })
  async getCustomErrandSettings() {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      // Seed default settings if not exists
      setting = await this.settingModel.create({
        key: 'custom_errand',
        value: { baseFee: 450, expressFee: 850, convenienceFee: 50, commissionFlatFee: 50, customErrandCommissionPercentage: 20, customErrandSafetyBufferPercentage: 20, platformProcessingFee: 500, platformServiceFeePercentage: 5, foodMarkupPercentage: 5, minOutsideCampusFee: 450, minCampusEnvironsFee: 350, minCustomErrandFee: 400 },
      });
    }
    return setting.value;
  }

  @Put('errands/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update custom errand pricing settings (admin only)' })
  async updateCustomErrandSettings(@Body() body: { baseFee: number; expressFee: number; convenienceFee?: number; commissionFlatFee?: number; customErrandCommissionPercentage?: number; customErrandSafetyBufferPercentage?: number; platformProcessingFee?: number; platformServiceFeePercentage?: number; foodMarkupPercentage?: number; minOutsideCampusFee?: number; minCampusEnvironsFee?: number; minCustomErrandFee?: number }) {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'custom_errand' });
    }
    setting.value = {
      baseFee: Number(body.baseFee || 450),
      expressFee: Number(body.expressFee || 850),
      convenienceFee: Number(body.convenienceFee ?? 50),
      commissionFlatFee: Number(body.commissionFlatFee ?? 50),
      customErrandCommissionPercentage: Number(body.customErrandCommissionPercentage ?? 20),
      platformProcessingFee: Number(body.platformProcessingFee ?? 500),
      platformServiceFeePercentage: Number(body.platformServiceFeePercentage ?? 5),
      foodMarkupPercentage: Number(body.foodMarkupPercentage ?? 5),
      minOutsideCampusFee: Number(body.minOutsideCampusFee ?? 450),
      minCampusEnvironsFee: Number(body.minCampusEnvironsFee ?? 350),
      minCustomErrandFee: Number(body.minCustomErrandFee ?? 400),
      customErrandSafetyBufferPercentage: Number(body.customErrandSafetyBufferPercentage ?? 20),
    };
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
    let setting = await this.settingModel.findOne({ key: 'advert' }).exec();
    if (!setting) {
      setting = await this.settingModel.create({
        key: 'advert',
        value: {
          enabled: true,
          intervalMinutes: 15,
          autoCloseSeconds: 0,
          contentType: 'dynamic',
          customAd: {
            title: '',
            description: '',
            imageUrl: '',
            ctaText: '',
            ctaLink: '',
          }
        },
      });
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
    setting.value = {
      enabled: body.enabled ?? true,
      intervalMinutes: Number(body.intervalMinutes ?? 15),
      autoCloseSeconds: Number(body.autoCloseSeconds ?? 0),
      contentType: body.contentType || 'dynamic',
      customAd: body.customAd || {
        title: '',
        description: '',
        imageUrl: '',
        ctaText: '',
        ctaLink: '',
      }
    };
    setting.markModified('value');
    await setting.save();
    return setting.value;
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
}
