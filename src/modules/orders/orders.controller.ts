import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';
import { OrderStatus } from './schemas/order.schema';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place a new order' })
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.ordersService.create((user._id as unknown) as string, body);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my orders (as customer)' })
  getMyOrders(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getCustomerOrders((user._id as unknown) as string, page, limit);
  }

  @Get('vendor/:vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get orders for a vendor' })
  getVendorOrders(
    @Param('vendorId') vendorId: string,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getVendorOrders(vendorId, status, page, limit);
  }

  @Get('vendor/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get orders for the logged-in vendor' })
  getMyVendorOrders(
    @CurrentUser() user: User,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findByVendorOwner((user._id as unknown) as string, status, page, limit);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available orders for errandr' })
  getAvailableOrders() {
    return this.ordersService.getAvailableOrders();
  }

  @Get('errander')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander delivery history' })
  getErranderOrders(@CurrentUser() user: User) {
    return this.ordersService.getErranderOrders((user._id as unknown) as string);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order statistics (admin)' })
  getStats() {
    return this.ordersService.getStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details' })
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { status: OrderStatus; note?: string },
  ) {
    return this.ordersService.updateStatus(id, body.status, (user._id as unknown) as string, body.note);
  }

  @Put(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept order as errander' })
  acceptOrder(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.acceptOrder(id, (user._id as unknown) as string);
  }

  @Put(':id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate an order' })
  rateOrder(
    @Param('id') id: string,
    @Body() body: { rating: number; review: string },
  ) {
    return this.ordersService.rateOrder(id, body.rating, body.review);
  }
  @Post(':id/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder a previous order' })
  reorder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.reorder(id, (user._id as unknown) as string);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an order' })
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.ordersService.cancelOrder(id, (user._id as unknown) as string, body.reason);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete order via unique code' })
  completeOrder(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { verificationCode: string },
  ) {
    return this.ordersService.completeOrder(id, (user._id as unknown) as string, body.verificationCode);
  }
}
