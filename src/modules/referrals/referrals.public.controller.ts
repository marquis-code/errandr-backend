import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';

@ApiTags('Public Referrals')
@Controller('referrals')
export class ReferralsPublicController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('validate-code/:code')
  @ApiOperation({ summary: 'Validate a referral code publicly' })
  validateCode(@Param('code') code: string) {
    return this.referralsService.validateCode(code.toUpperCase());
  }
}
