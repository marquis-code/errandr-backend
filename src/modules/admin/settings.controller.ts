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
        value: { baseFee: 450, expressFee: 850 },
      });
    }
    return setting.value;
  }

  @Put('errands/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update custom errand pricing settings (admin only)' })
  async updateCustomErrandSettings(@Body() body: { baseFee: number; expressFee: number }) {
    let setting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'custom_errand' });
    }
    setting.value = {
      baseFee: Number(body.baseFee || 450),
      expressFee: Number(body.expressFee || 850),
    };
    await setting.save();
    return setting.value;
  }
}
