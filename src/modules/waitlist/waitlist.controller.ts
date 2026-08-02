import { Controller, Post, Body, Get, Query, UseGuards, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { WaitlistStatus } from './schemas/waitlist.schema';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @ApiOperation({ summary: 'Join waitlist for a specific slot' })
  joinWaitlist(@Body() body: any) {
    return this.waitlistService.join(body);
  }

  @Get('vendor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get waitlist for logged in vendor' })
  getWaitlist(@CurrentUser() vendor: any, @Query() query: any) {
    return this.waitlistService.getWaitlistForVendor((vendor._id as unknown) as string, query);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update waitlist status' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() vendor: any,
    @Body('status') status: WaitlistStatus
  ) {
    return this.waitlistService.updateStatus(id, (vendor._id as unknown) as string, status);
  }
}
