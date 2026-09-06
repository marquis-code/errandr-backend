import { Controller, Get, Post, Body, Param, UseGuards, Req, Put, Delete } from '@nestjs/common';
import { MarketPoolService } from './market-pool.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';
import { MarketPoolOrderStatus } from './schemas/market-pool-order.schema';

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

  @Get('active-campaigns')
  async getActiveCampaigns() {
    const campaigns = await this.marketPoolService.getActiveCampaigns();
    const results: any[] = [];
    for (const campaign of campaigns) {
      const items = await this.marketPoolService.getCampaignItems(campaign._id.toString());
      results.push({ campaign, items });
    }
    return results;
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders')
  async getUserOrders(@Req() req) {
    return this.marketPoolService.getUserOrders(req.user._id.toString());
  }

  @Get('payment-details')
  async getPaymentDetails() {
    return this.marketPoolService.getPaymentDetails();
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req, @Body() body: { campaignId: string, items: { itemId: string, quantity: number }[], deliveryDetails?: any }) {
    return this.marketPoolService.checkout(req.user._id.toString(), body.campaignId, body.items, body.deliveryDetails);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders/:id/proof')
  async uploadProof(@Req() req, @Param('id') orderId: string, @Body('paymentProofUrl') paymentProofUrl: string) {
    return this.marketPoolService.uploadProof(orderId, req.user._id.toString(), paymentProofUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Put('orders/:id/delivery-details')
  async updateDeliveryDetails(
    @Req() req, 
    @Param('id') orderId: string, 
    @Body() body: { deliverySlot?: string, proxyName?: string, proxyPhone?: string }
  ) {
    return this.marketPoolService.updateDeliveryPreference(
      orderId, 
      req.user._id.toString(), 
      body.deliverySlot, 
      body.proxyName, 
      body.proxyPhone
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('orders/:id/verify-payment')
  async verifyPayment(@Param('id') orderId: string, @Body('action') action: 'approve' | 'reject') {
    return this.marketPoolService.verifyPayment(orderId, action);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('campaigns/:id/orders')
  async getCampaignOrders(@Param('id') campaignId: string) {
    return this.marketPoolService.getCampaignOrders(campaignId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('campaigns')
  async getAllCampaigns() {
    return this.marketPoolService.getAllCampaigns();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns')
  async createCampaign(@Body() body: { title: string, startDate: Date, endDate: Date }) {
    return this.marketPoolService.createCampaign(body.title, body.startDate, body.endDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns/:id/close')
  async closeCampaign(@Param('id') campaignId: string) {
    return this.marketPoolService.closeCampaign(campaignId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('campaigns/:id/items')
  async getCampaignItems(@Param('id') campaignId: string) {
    return this.marketPoolService.getCampaignItems(campaignId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('campaigns/:id/items')
  async addItem(@Param('id') campaignId: string, @Body() body: any) {
    return this.marketPoolService.addItem(campaignId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('items/:id')
  async updateItem(@Param('id') itemId: string, @Body() body: any) {
    return this.marketPoolService.updateItem(itemId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/custom-requests')
  async requestCustomItem(@Param('id') campaignId: string, @Req() req, @Body() body: any) {
    return this.marketPoolService.createCustomRequest(req.user._id.toString(), campaignId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('campaigns/:id/custom-requests')
  async getCustomRequests(@Param('id') campaignId: string) {
    return this.marketPoolService.getCustomRequests(campaignId);
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('campaigns/:id/status')
  async updateOrderStatus(@Param('id') campaignId: string, @Body() body: { status: MarketPoolOrderStatus }) {
    await this.marketPoolService.updateOrderStatus(campaignId, body.status);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('items/:id/reviews')
  async addReview(@Param('id') itemId: string, @Req() req, @Body() body: { rating: number, comment: string }) {
    return this.marketPoolService.addReview(itemId, req.user._id.toString(), body.rating, body.comment);
  }

  @Get('categories')
  async getCategories() {
    return this.marketPoolService.getCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('categories')
  async addCategory(@Body() body: { name: string }) {
    return this.marketPoolService.addCategory(body.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() body: { name: string }) {
    return this.marketPoolService.updateCategory(id, body.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    await this.marketPoolService.deleteCategory(id);
    return { success: true };
  }
}
