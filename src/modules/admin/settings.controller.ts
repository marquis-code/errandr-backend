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
        value: { baseFee: 450, expressFee: 850, convenienceFee: 50, commissionPercentage: 10, platformProcessingFee: 500, platformServiceFeePercentage: 5 },
      });
    }
    return setting.value;
  }

  @Put('errands/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update custom errand pricing settings (admin only)' })
  async updateCustomErrandSettings(@Body() body: { baseFee: number; expressFee: number; convenienceFee?: number; commissionPercentage?: number; platformProcessingFee?: number; platformServiceFeePercentage?: number }) {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'custom_errand' });
    }
    setting.value = {
      baseFee: Number(body.baseFee || 450),
      expressFee: Number(body.expressFee || 850),
      convenienceFee: Number(body.convenienceFee ?? 50),
      commissionPercentage: Number(body.commissionPercentage ?? 10),
      platformProcessingFee: Number(body.platformProcessingFee ?? 500),
      platformServiceFeePercentage: Number(body.platformServiceFeePercentage ?? 5),
    };
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
}
