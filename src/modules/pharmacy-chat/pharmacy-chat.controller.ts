import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/decorators';
import { PharmacyChatService } from './pharmacy-chat.service';

@ApiTags('Pharmacy Chat')
@Controller('pharmacy-chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PharmacyChatController {
  constructor(private readonly service: PharmacyChatService) {}

  @Post()
  @ApiOperation({ summary: 'Ask a pharmacist about a medicine' })
  start(
    @Req() req: any,
    @Body() body: { vendorId: string; productId?: string; orderId?: string; message: string },
  ) {
    return this.service.start(req.user._id.toString(), body);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My questions to pharmacies' })
  mine(@Req() req: any) {
    return this.service.listForCustomer(req.user._id.toString());
  }

  @Get('vendor')
  @ApiOperation({ summary: 'Questions sent to my store' })
  forVendor(@Req() req: any, @Query('status') status?: string) {
    return this.service.listForVendor(req.user._id.toString(), status);
  }

  @Get('vendor/review-queue')
  @ApiOperation({ summary: 'What a pharmacist must clear before dispatch' })
  reviewQueue(@Req() req: any) {
    return this.service.reviewQueue(req.user._id.toString());
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply in a pharmacy conversation' })
  reply(@Req() req: any, @Param('id') id: string, @Body() body: { message: string }) {
    return this.service.reply(req.user._id.toString(), req.user.role, id, body.message);
  }
}
