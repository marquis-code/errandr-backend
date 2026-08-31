import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { MarketPoolService } from './market-pool.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@Controller('market-pool')
export class MarketPoolController {
  constructor(private readonly marketPoolService: MarketPoolService) {}

  @Get('active')
  async getActiveCampaign() {
    const campaign = await this.marketPoolService.getActiveCampaign();
    if (!campaign) return null;
    const items = await this.marketPoolService.getCampaignItems(campaign._id.toString());
    return { campaign, items };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req, @Body() body: { campaignId: string, items: { itemId: string, quantity: number }[] }) {
    return this.marketPoolService.checkout(req.user._id.toString(), body.campaignId, body.items);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns')
  async createCampaign(@Body() body: { title: string, startDate: Date, endDate: Date }) {
    return this.marketPoolService.createCampaign(body.title, body.startDate, body.endDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns/:id/items')
  async addItem(@Param('id') campaignId: string, @Body() body: any) {
    return this.marketPoolService.addItem(campaignId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('campaigns/:id/aggregation')
  async getAggregation(@Param('id') campaignId: string) {
    return this.marketPoolService.getAggregation(campaignId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns/:id/refund-item')
  async refundItem(@Param('id') campaignId: string, @Body() body: { itemId: string }) {
    await this.marketPoolService.refundItem(campaignId, body.itemId);
    return { success: true };
  }
}
