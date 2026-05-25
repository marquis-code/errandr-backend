import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Logger, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';
import { OrderStatus } from './schemas/order.schema';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place a new order' })
  create(@CurrentUser() user: User, @Body() body: any) {
    this.logger.log(`create() called by user=${user._id}`);
    return this.ordersService.create((user._id as unknown) as string, body);
  }

  @Get('batch/status')
  @ApiOperation({ summary: 'Get current batch delivery window status' })
  getBatchStatus() {
    this.logger.log(`getBatchStatus() called`);
    return this.ordersService.getBatchStatus();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my orders (as customer)' })
  getMyOrders(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    this.logger.log(`getMyOrders() called by user=${user._id} page=${page} limit=${limit}`);
    return this.ordersService.getCustomerOrders((user._id as unknown) as string, page, limit);
  }

  // @Get('vendor/mine')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Get orders for the logged-in vendor' })
  // async getMyVendorOrders(
  //   @CurrentUser() user: any,
  //   @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
  //   @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  //   @Query('status') status?: OrderStatus,
  //   @Query('vendorId') vendorId?: string,
  // ) {
  //   const ownerId = user._id.toString();
  //   this.logger.log(`getMyVendorOrders() ownerId=${ownerId} status=${status} vendorId=${vendorId} page=${page} limit=${limit}`);

  //   const result = await this.ordersService.findByVendorOwner(ownerId, status, page, limit, vendorId);
  //   this.logger.log(`getMyVendorOrders() returning ${result.total} orders for ownerId=${ownerId}`);
  //   return result;
  // }

  @Get('vendor/mine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Get orders for the logged-in vendor' })
async getMyVendorOrders(
  @CurrentUser() user: any,
  @Query('status') status?: OrderStatus,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
) {
  this.logger.log(`getMyVendorOrders() user=${user._id}`);
  return this.ordersService.findByVendorOwner(user._id.toString(), status, page, limit);
}

  @Get('vendor/:vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get orders for a vendor' })
  getVendorOrders(
    @Param('vendorId') vendorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('status') status?: OrderStatus,
  ) {
    this.logger.log(`getVendorOrders() vendorId=${vendorId} status=${status} page=${page} limit=${limit}`);
    return this.ordersService.getVendorOrders(vendorId, status, page, limit);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available orders for erranders' })
  getAvailableOrders() {
    this.logger.log(`getAvailableOrders() called`);
    return this.ordersService.getAvailableOrders();
  }

  @Get('errander')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get errander delivery history' })
  getErranderOrders(@CurrentUser() user: User) {
    this.logger.log(`getErranderOrders() called by user=${user._id}`);
    return this.ordersService.getErranderOrders((user._id as unknown) as string);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order statistics (admin)' })
  getStats() {
    this.logger.log(`getStats() called`);
    return this.ordersService.getStats();
  }

  @Post(':id/otp/:type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate and send OTP for pickup or delivery' })
  sendOtp(
    @Param('id') id: string, 
    @Param('type') type: 'pickup' | 'delivery',
    @CurrentUser() user: User
  ) {
    this.logger.log(`sendOtp() id=${id} type=${type} user=${user._id}`);
    return this.ordersService.generateAndSendOtp(id, type, user._id.toString());
  }

  @Post(':id/otp/:type/voice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Explicitly send OTP via Voice Call' })
  sendVoiceOtp(
    @Param('id') id: string, 
    @Param('type') type: 'pickup' | 'delivery',
    @CurrentUser() user: User
  ) {
    this.logger.log(`sendVoiceOtp() id=${id} type=${type} user=${user._id}`);
    return this.ordersService.resendOtpWithVoice(id, type, user._id.toString());
  }

  @Post(':id/verify-otp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify OTP for pickup or delivery' })
  async verifyOtp(
    @Param('id') id: string,
    @Body('otp') otp: string,
    @Body('type') type: 'pickup' | 'delivery'
  ) {
    this.logger.log(`verifyOtp() id=${id} type=${type}`);
    const isValid = await this.ordersService.verifyOtp(id, otp, type);
    return { isValid };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details' })
  findById(@Param('id') id: string) {
    this.logger.log(`findById() id=${id}`);
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
    this.logger.log(`updateStatus() id=${id} user=${user._id} status=${body.status}`);
    return this.ordersService.updateStatus(id, body.status, (user._id as unknown) as string, body.note);
  }

  @Put(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept order as errander' })
  acceptOrder(@Param('id') id: string, @CurrentUser() user: User) {
    this.logger.log(`acceptOrder() id=${id} user=${user._id}`);
    return this.ordersService.acceptOrder(id, (user._id as unknown) as string);
  }

  @Put(':id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate an order' })
  rateOrder(
    @Param('id') id: string,
    @Body() body: { 
      vendorRating?: number; 
      vendorReview?: string; 
      erranderRating?: number; 
      erranderReview?: string; 
    },
  ) {
    this.logger.log(`rateOrder() id=${id}`);
    return this.ordersService.rateOrder(id, body);
  }

  @Post(':id/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder a previous order' })
  reorder(@CurrentUser() user: User, @Param('id') id: string) {
    this.logger.log(`reorder() id=${id} user=${user._id}`);
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
    this.logger.log(`cancel() id=${id} user=${user._id} reason=${body.reason}`);
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
    this.logger.log(`completeOrder() id=${id} user=${user._id}`);
    return this.ordersService.completeOrder(id, (user._id as unknown) as string, body.verificationCode);
  }
}