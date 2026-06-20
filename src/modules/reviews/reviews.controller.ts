import { Controller, Post, Get, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('vendor/:vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a review for a vendor' })
  addReview(
    @CurrentUser() user: User,
    @Param('vendorId') vendorId: string,
    @Body() body: { rating: number; comment?: string },
  ) {
    return this.reviewsService.createReview((user._id as unknown) as string, vendorId, body.rating, body.comment);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get reviews for a vendor' })
  getVendorReviews(
    @Param('vendorId') vendorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getVendorReviews(vendorId, Number(page) || 1, Number(limit) || 10);
  }
}
