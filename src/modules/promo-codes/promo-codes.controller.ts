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
  @ApiOperation({ summary: 'Create a new promo code' })
  create(@Body() data: any) {
    return this.promoCodesService.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing promo code' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.promoCodesService.update(id, data);
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

  @Get('preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview a promo code eligibility without applying it' })
  preview(
    @Query('code') code: string, 
    @Query('subtotal') subtotal: string, 
    @Query('vendorId') vendorId: string, 
    @Query('isGroupOrder') isGroupOrder: string,
    @Query('locationType') locationType: string,
    @Query('isCustomErrand') isCustomErrand: string,
    @Req() req: any
  ) {
    const orderContext = {
      isGroupOrder: isGroupOrder === 'true',
      locationType: locationType,
      isCustomErrand: isCustomErrand === 'true'
    };
    return this.promoCodesService.previewCode(code, Number(subtotal) || 0, req.user?._id?.toString(), vendorId, undefined, orderContext);
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a promo code for a checkout' })
  validate(
    @Query('code') code: string, 
    @Query('subtotal') subtotal: string, 
    @Query('vendorId') vendorId: string, 
    @Query('isGroupOrder') isGroupOrder: string,
    @Query('locationType') locationType: string,
    @Query('isCustomErrand') isCustomErrand: string,
    @Req() req: any
  ) {
    // In erranders, req.user typically holds the authenticated user object.
    const orderContext = {
      isGroupOrder: isGroupOrder === 'true',
      locationType: locationType,
      isCustomErrand: isCustomErrand === 'true'
    };
    return this.promoCodesService.validateCode(code, Number(subtotal) || 0, req.user?._id?.toString(), vendorId, undefined, orderContext);
  }
}
