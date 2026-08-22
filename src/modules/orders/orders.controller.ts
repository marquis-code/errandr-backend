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

  @Get('calculate-fee')
  @ApiOperation({ summary: 'Calculate delivery fee dynamically using Mapbox' })
  async calculateFee(
    @Query('vendorId') vendorId: string,
    @Query('deliveryAddress') deliveryAddress: string,
    @Query('customerId') customerId?: string,
    @Query('deliveryLocation') deliveryLocation?: string,
  ) {
    this.logger.log(`calculateFee() vendorId=${vendorId} deliveryAddress=${deliveryAddress}`);
    const fee = await this.ordersService.calculateDynamicFee(vendorId, customerId || '', deliveryAddress, deliveryLocation);
    return { success: true, deliveryFee: fee };
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
  @ApiOperation({ summary: 'Get order by id' })
  async getOrderById(@Param('id') id: string) {
    this.logger.log(`getOrderById() id=${id}`);
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000));
      const order = await Promise.race([
        this.ordersService.findById(id),
        timeout
      ]);
      console.log(`--- GET /orders/${id} OUTPUT ---`, JSON.stringify(order, null, 2));
      return order;
    } catch (error) {
      console.error(`--- GET /orders/${id} FAILED, RETURNING FALLBACK ---`, error.message);
      return {
        _id: id,
        status: 'pending',
        customer: { firstName: 'Network', lastName: 'Error' },
        vendor: { storeName: 'Unable to load data' },
        items: [],
        total: 0,
        deliveryFee: 0,
        whatsappLinks: { customer: null, vendor: null, errander: null }
      };
    }
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
  @ApiOperation({ summary: 'Accept order as errander (Marketplace)' })
  acceptOrder(@Param('id') id: string, @CurrentUser() user: User) {
    this.logger.log(`acceptOrder() id=${id} user=${user._id}`);
    return this.ordersService.acceptOrder(id, (user._id as unknown) as string);
  }

  @Put(':id/custom/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept custom errand as errander' })
  acceptCustomErrand(@Param('id') id: string, @CurrentUser() user: User) {
    this.logger.log(`acceptCustomErrand() id=${id} user=${user._id}`);
    return this.ordersService.acceptCustomErrand(id, (user._id as unknown) as string);
  }

  @Post(':id/custom/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize payment for custom errand' })
  payForCustomErrand(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { paymentReference: string },
  ) {
    this.logger.log(`payForCustomErrand() id=${id} user=${user._id}`);
    return this.ordersService.payForCustomErrand(id, (user._id as unknown) as string, body.paymentReference);
  }

  @Put(':id/custom/fee')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Increase fee for custom errand' })
  updateErrandFee(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { newFee: number },
  ) {
    this.logger.log(`updateErrandFee() id=${id} user=${user._id} newFee=${body.newFee}`);
    return this.ordersService.updateErrandFee(id, (user._id as unknown) as string, body.newFee);
  }

  @Post(':id/custom/bid')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place a counter-offer bid for a custom errand' })
  placeBid(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { amount: number },
  ) {
    this.logger.log(`placeBid() id=${id} user=${user._id} amount=${body.amount}`);
    return this.ordersService.placeBid(id, (user._id as unknown) as string, body.amount);
  }

  @Put(':id/custom/bid/:bidId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a counter-offer bid for a custom errand' })
  acceptBid(
    @Param('id') id: string,
    @Param('bidId') bidId: string,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`acceptBid() id=${id} bidId=${bidId} user=${user._id}`);
    return this.ordersService.acceptBid(id, bidId, (user._id as unknown) as string);
  }

  @Put(':id/custom/bid/:bidId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a counter-offer bid for a custom errand' })
  rejectBid(
    @Param('id') id: string,
    @Param('bidId') bidId: string,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`rejectBid() id=${id} bidId=${bidId} user=${user._id}`);
    return this.ordersService.rejectBid(id, bidId, (user._id as unknown) as string);
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
  @ApiOperation({ summary: 'Complete order via Delivery PIN' })
  completeOrder(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { verificationCode: string },
  ) {
    this.logger.log(`completeOrder() id=${id} user=${user._id}`);
    return this.ordersService.completeOrder(id, (user._id as unknown) as string, body.verificationCode);
  }

  @Post(':id/complete-contactless')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete order via Contactless Drop-off (Photo)' })
  completeOrderContactless(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { imageUrl: string },
  ) {
    this.logger.log(`completeOrderContactless() id=${id} user=${user._id}`);
    return this.ordersService.bypassDeliveryPinWithPhoto(id, (user._id as unknown) as string, body.imageUrl);
  }

  @Get('track/guest')
  @ApiOperation({ summary: 'Track order by orderNumber and email' })
  trackOrder(@Query('orderNumber') orderNumber: string, @Query('email') email: string) {
    return this.ordersService.trackOrder(orderNumber, email);
  }

  @Put('track/cancel')
  @ApiOperation({ summary: 'Cancel tracked order by orderNumber and email' })
  cancelTrackedOrder(@Body() body: { orderNumber: string; email: string }) {
    return this.ordersService.cancelTrackedOrder(body.orderNumber, body.email);
  }

  @Put(':id/reconcile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Errander submits actual item cost for reconciliation' })
  submitReconciliation(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { actualItemCost: number; receiptImage?: string; note?: string },
  ) {
    this.logger.log(`submitReconciliation() id=${id} user=${user._id} actualCost=${body.actualItemCost}`);
    return this.ordersService.submitReconciliation(id, (user._id as unknown) as string, body);
  }

  @Put(':id/reconcile/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer approves reconciliation (auto-refund if overpaid)' })
  approveReconciliation(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    this.logger.log(`approveReconciliation() id=${id} user=${user._id}`);
    return this.ordersService.approveReconciliation(id, (user._id as unknown) as string);
  }

  // --- ERRAND POOLING (CUSTOM ERRANDS) ---

  @Get('pool/open')
  @ApiOperation({ summary: 'Get all open pooled errands' })
  getOpenPools() {
    return this.ordersService.getOpenPools();
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record that a rider has viewed a custom errand' })
  recordOrderView(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.recordOrderView(id, (user._id as unknown) as string);
  }

  @Post(':id/pool/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn a custom errand into an open pool' })
  createErrandPool(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { title: string; maxParticipants?: number },
  ) {
    return this.ordersService.createErrandPool(id, (user._id as unknown) as string, body.title, body.maxParticipants);
  }

  @Post(':id/pool/:poolId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join an existing errand pool with a new custom errand' })
  joinErrandPool(
    @Param('id') id: string,
    @Param('poolId') poolId: string,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.joinPool(poolId, id, (user._id as unknown) as string);
  }

  @Put('pool/:poolId/lock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lock a pool early' })
  lockErrandPool(
    @Param('poolId') poolId: string,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.lockPool(poolId, (user._id as unknown) as string);
  }

  @Post(':id/feedback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit feedback for an abandoned or pending order' })
  submitOrderFeedback(
    @Param('id') id: string,
    @Body() body: { feedback: string },
  ) {
    return this.ordersService.submitFeedback(id, body.feedback);
  }

  @Post(':id/admin-assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin manually assigns an errander to an order' })
  adminAssignOrder(
    @Param('id') id: string,
    @Body() body: { erranderId: string }
  ) {
    this.logger.log(`Admin assigning order=${id} to errander=${body.erranderId}`);
    // isAdmin = true bypasses normal tier/load constraints
    return this.ordersService.acceptOrder(id, body.erranderId, true);
  }
}