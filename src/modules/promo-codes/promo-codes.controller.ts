import { Controller, Get, Post, Body, Param, Put, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromoCodesService } from './promo-codes.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Promo Codes')
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promo code (Admin)' })
  create(@Body() data: any) {
    return this.promoCodesService.create(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all promo codes (Admin)' })
  findAll() {
    return this.promoCodesService.findAll();
  }

  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle promo code active status (Admin)' })
  toggleActive(@Param('id') id: string) {
    return this.promoCodesService.toggleActive(id);
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a promo code for a checkout' })
  validate(@Query('code') code: string, @Query('subtotal') subtotal: string, @Query('vendorId') vendorId: string, @Req() req: any) {
    // In erranders, req.user typically holds the authenticated user object.
    // However, to check orders count, we would ideally need orders service, but we can just pass the user ID and let the service handle it,
    // OR we just pass user orders count if we have it in user. Let's just pass userId and vendorId for now. 
    // The service might need to query the orders collection if we want `userOrdersCount`, but to avoid circular deps we can pass 0 for now or fetch it.
    // We'll pass the user ID and vendor ID.
    return this.promoCodesService.validateCode(code, Number(subtotal) || 0, req.user?._id?.toString(), vendorId);
  }
}
