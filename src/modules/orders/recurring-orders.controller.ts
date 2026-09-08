import { Controller, Post, Get, Put, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { RecurringOrdersService } from './recurring-orders.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@Controller('recurring-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringOrdersController {
  constructor(private readonly recurringOrdersService: RecurringOrdersService) {}

  @Post()
  async createRecurringOrder(@Req() req: any, @Body() createDto: any) {
    return this.recurringOrdersService.create(req.user._id, createDto);
  }

  @Get('vendor-forecast')
  @Roles(UserRole.VENDOR)
  async getVendorForecast(@Req() req: any) {
    // Assuming req.user contains the vendor's _id
    return this.recurringOrdersService.getVendorForecasts(req.user._id);
  }

  @Get()
  async getMyRecurringOrders(@Req() req: any) {
    return this.recurringOrdersService.findByUser(req.user._id);
  }

  @Get(':id')
  async getRecurringOrderById(@Param('id') id: string) {
    return this.recurringOrdersService.findById(id);
  }

  @Put(':id')
  async updateRecurringOrder(@Req() req: any, @Param('id') id: string, @Body() updateDto: any) {
    return this.recurringOrdersService.update(id, req.user._id, updateDto);
  }

  @Patch(':id/cancel')
  async cancelRecurringOrder(@Req() req: any, @Param('id') id: string) {
    return this.recurringOrdersService.cancel(id, req.user._id);
  }
}
