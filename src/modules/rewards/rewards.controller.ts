import { Controller, Get, Post, UseGuards, Body, Query } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('ping')
  async ping() {
    return { message: 'Rewards API reachable' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-points')
  async getMyPoints(@CurrentUser() user: any) {
    const userId = user._id;
    const points = await this.rewardsService.getUserPoints(userId);
    return { points };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-rewards')
  async getMyRewards(@CurrentUser() user: any) {
    const userId = user._id;
    return this.rewardsService.getMyRewards(userId);
  }

  @Post('spin-the-wheel')
  async spinWheel(
    @CurrentUser() user: any,
    @Body() body: { deviceId?: string }
  ) {
    // If not logged in, we use a placeholder or null for userId in the service
    // The service handles deviceId-based win tracking aggressively
    const userId = user?._id;
    return this.rewardsService.spinWheel(userId, body.deviceId);
  }

  @Get('referral-code')
  async getReferralCode(@CurrentUser() user: any) {
    const userId = user._id;
    const code = await this.rewardsService.generateReferralCode(userId);
    return { code };
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('type') type: 'orders' | 'deliveries' | 'points') {
    return this.rewardsService.getLeaderboard(type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('quests')
  async getQuests(@CurrentUser() user: any) {
    const userId = user._id;
    return this.rewardsService.getMyQuests(userId);
  }

  @Post('convert-airtime')
  async convertAirtime(
    @CurrentUser() user: any,
    @Body() body: { points: number; phoneNumber: string }
  ) {
    const userId = user._id;
    return this.rewardsService.convertToAirtime(userId, body.points, body.phoneNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Post('redeem-discount')
  async redeemDiscount(
    @CurrentUser() user: any,
    @Body() body: { points: number }
  ) {
    const userId = user._id;
    return this.rewardsService.redeemDiscount(userId, body.points);
  }

  @UseGuards(JwtAuthGuard)
  @Post('redeem-free-delivery')
  async redeemFreeDelivery(@CurrentUser() user: any) {
    const userId = user._id;
    return this.rewardsService.redeemFreeDelivery(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('redeem-pro')
  async redeemPro(@CurrentUser() user: any) {
    const userId = user._id;
    return this.rewardsService.redeemProStatus(userId);
  }
}
