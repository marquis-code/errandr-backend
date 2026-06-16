import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body,
  UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Admin Referrals')
@Controller('admin/referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // ─── Referral Stats ────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get referral system statistics' })
  getStats() {
    return this.referralsService.getAdminReferralStats();
  }

  // ─── All Referrals ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get all referrals with pagination' })
  getAllReferrals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.referralsService.getAllReferrals({ page, limit, status, type });
  }

  // ─── Leaderboard ───────────────────────────────────────────────

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get referral leaderboard' })
  getLeaderboard(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.referralsService.getReferralLeaderboard(limit);
  }

  // ─── Referrals by User ────────────────────────────────────────

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get referrals by a specific user' })
  getReferralsByUser(@Param('userId') userId: string) {
    return this.referralsService.getReferralsByUser(userId);
  }

  // ─── Facilitator CRUD ──────────────────────────────────────────

  @Get('facilitators')
  @ApiOperation({ summary: 'List all facilitators' })
  getFacilitators(
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.referralsService.getFacilitators({ isActive, search });
  }

  @Post('facilitators')
  @ApiOperation({ summary: 'Create a new facilitator' })
  createFacilitator(
    @Body() body: {
      name: string;
      email: string;
      matricNumber?: string;
      skill?: string;
      referralCode?: string;
      sendWelcomeEmail?: boolean;
    },
  ) {
    return this.referralsService.createFacilitator(body);
  }

  @Get('facilitators/:id')
  @ApiOperation({ summary: 'Get facilitator details' })
  getFacilitator(@Param('id') id: string) {
    return this.referralsService.getFacilitator(id);
  }

  @Put('facilitators/:id')
  @ApiOperation({ summary: 'Update a facilitator' })
  updateFacilitator(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.referralsService.updateFacilitator(id, body);
  }

  @Delete('facilitators/:id')
  @ApiOperation({ summary: 'Deactivate a facilitator' })
  deactivateFacilitator(@Param('id') id: string) {
    return this.referralsService.deactivateFacilitator(id);
  }

  @Get('facilitators/:id/referrals')
  @ApiOperation({ summary: 'Get referrals by a facilitator' })
  getFacilitatorReferrals(@Param('id') id: string) {
    return this.referralsService.getFacilitatorReferrals(id);
  }

  @Post('facilitators/:id/resend-email')
  @ApiOperation({ summary: 'Resend welcome email to facilitator' })
  resendWelcomeEmail(@Param('id') id: string) {
    return this.referralsService.resendFacilitatorWelcomeEmail(id);
  }

  // ─── Seed ──────────────────────────────────────────────────────

  @Post('facilitators/seed')
  @ApiOperation({ summary: 'Bulk seed facilitators' })
  seedFacilitators(
    @Body() body: { facilitators: Array<{ name: string; email: string; matricNumber?: string; skill?: string }> },
  ) {
    return this.referralsService.seedFacilitators(body.facilitators);
  }
}
