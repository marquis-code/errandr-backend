const fs = require('fs');

// 1. Controller
const cPath = './src/modules/orders/orders.controller.ts';
let cCode = fs.readFileSync(cPath, 'utf8');

const controllerInject = `
  @Post(':id/custom/topup/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Errander requests top-up for custom errand' })
  requestCustomTopup(@Param('id') id: string, @CurrentUser() user: User, @Body() body: { amount: number }) {
    return this.ordersService.requestCustomTopup(id, user._id.toString(), body.amount);
  }

  @Post(':id/custom/topup/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer pays requested top-up for custom errand' })
  payCustomTopup(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.payCustomTopup(id, user._id.toString());
  }

  @Post(':id/custom/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Errander cancels custom errand due to unavailability' })
  cancelCustomErrand(@Param('id') id: string, @CurrentUser() user: User, @Body() body: { reason: string }) {
    return this.ordersService.cancelCustomErrand(id, user._id.toString(), body.reason);
  }
`;

if (!cCode.includes('requestCustomTopup')) {
  cCode = cCode.replace(/@Put\(':id\/custom\/accept'\)/, controllerInject + "\n  @Put(':id/custom/accept')");
  fs.writeFileSync(cPath, cCode);
  console.log('Injected into controller');
}

// 2. Service
const sPath = './src/modules/orders/orders.service.ts';
let sCode = fs.readFileSync(sPath, 'utf8');

const serviceInject = `
  async requestCustomTopup(orderId: string, erranderId: string, amount: number): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('customer');
    if (!order) throw new NotFoundException('Order not found');
    if (order.type !== OrderType.CUSTOM_ERRAND) throw new BadRequestException('Not a custom errand');
    if (order.errander?.toString() !== erranderId && order.errander?.toString() !== (await this.erranderModel.findOne({user: erranderId}))?._id.toString()) {
      throw new BadRequestException('Only assigned errander can request top-up');
    }
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    order.pendingTopupAmount = amount;
    await order.save();

    // Notify customer
    const customerId = order.customer?._id || order.customer;
    this.notificationsGateway.sendToUser(customerId.toString(), {
      type: 'CUSTOM_ERRAND_TOPUP_REQUEST',
      title: 'Action Required: Top-up Needed',
      body: \`Your Errander needs an extra ₦\${amount.toLocaleString()} to complete your errand.\`,
      data: { orderId: order._id, amount }
    });

    return order;
  }

  async payCustomTopup(orderId: string, customerId: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.type !== OrderType.CUSTOM_ERRAND) throw new BadRequestException('Not a custom errand');
    if ((order.customer?._id || order.customer)?.toString() !== customerId) throw new BadRequestException('Unauthorized');
    if (!order.pendingTopupAmount || order.pendingTopupAmount <= 0) throw new BadRequestException('No top-up pending');

    const amount = order.pendingTopupAmount;

    // Debit Wallet
    await this.walletsService.forceDebitWallet(
      customerId,
      amount,
      \`Top-up for custom errand #\${order.orderNumber}\`
    );

    // Update order
    order.pendingTopupAmount = 0;
    if (order.customDetails) {
      order.customDetails.estimatedItemCost = (order.customDetails.estimatedItemCost || 0) + amount;
    }
    order.subtotal = (order.subtotal || 0) + amount;
    order.totalAmount = (order.totalAmount || 0) + amount;
    await order.save();

    // Notify errander
    const erranderProfile = await this.erranderModel.findById(order.errander);
    if (erranderProfile) {
      this.notificationsGateway.sendToUser(erranderProfile.user.toString(), {
        type: 'CUSTOM_ERRAND_TOPUP_PAID',
        title: 'Top-up Received',
        body: \`The customer paid the extra ₦\${amount.toLocaleString()}. You can now buy the item.\`,
        data: { orderId: order._id }
      });
    }

    return order;
  }

  async cancelCustomErrand(orderId: string, erranderId: string, reason: string): Promise<Order> {
    const order = await this.orderModel.findById(orderId).populate('customer');
    if (!order) throw new NotFoundException('Order not found');
    if (order.type !== OrderType.CUSTOM_ERRAND) throw new BadRequestException('Not a custom errand');
    if (order.errander?.toString() !== erranderId && order.errander?.toString() !== (await this.erranderModel.findOne({user: erranderId}))?._id.toString()) {
      throw new BadRequestException('Only assigned errander can cancel');
    }

    // Refund Customer (Total Amount - platform processing fee, maybe refund processing fee too?)
    const refundAmount = order.totalAmount;
    const customerId = (order.customer?._id || order.customer)?.toString();
    
    await this.walletsService.creditWallet(
      customerId,
      refundAmount,
      \`Refund: Custom errand #\${order.orderNumber} cancelled by Errander (\${reason})\`,
      order._id.toString()
    );

    // Mark Cancelled
    order.status = OrderStatus.CANCELLED;
    await order.save();

    // Free errander
    const erranderProfile = await this.erranderModel.findOne({ $or: [{ user: erranderId }, { _id: erranderId }] });
    if (erranderProfile) {
      if (erranderProfile.currentOrder?.toString() === orderId) {
        (erranderProfile as any).currentOrder = null;
        erranderProfile.status = ErranderStatus.AVAILABLE;
        await erranderProfile.save();
      }
    }

    // Notify customer
    this.notificationsGateway.sendToUser(customerId, {
      type: 'ORDER_CANCELLED',
      title: 'Errand Cancelled',
      body: \`Your Errander cancelled the errand: \${reason}. You have been fully refunded ₦\${refundAmount.toLocaleString()}.\`,
      data: { orderId: order._id }
    });

    return order;
  }
`;

if (!sCode.includes('requestCustomTopup')) {
  sCode = sCode.replace(/async acceptCustomErrand/, serviceInject + "\n  async acceptCustomErrand");
  fs.writeFileSync(sPath, sCode);
  console.log('Injected into service');
}
