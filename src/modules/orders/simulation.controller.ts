import { Controller, Post, Param, Body, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/decorators';

@ApiTags('Simulation')
@Controller('simulation')
export class SimulationController {
  private readonly logger = new Logger(SimulationController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post('mock-order')
  @ApiOperation({ summary: 'Create a fully populated mock order for testing' })
  async createMockOrder(@Body() body: { vendorId: string; customerId: string }) {
    this.logger.log(`createMockOrder() called for vendor=${body.vendorId}`);
    return this.ordersService.create(body.customerId, {
      vendor: body.vendorId,
      items: [
        { name: 'Mock Jollof Rice', price: 1500, quantity: 2, subtotal: 3000 },
        { name: 'Mock Chilled Zobo', price: 500, quantity: 1, subtotal: 500 }
      ],
      deliveryAddress: 'Hostel B, Room 101 (Simulation)',
      status: 'AWAITING_PAYMENT'
    });
  }

  @Post('mock-payment/:orderId')
  @ApiOperation({ summary: 'Simulate a successful Paystack webhook for an order' })
  async simulatePayment(@Param('orderId') orderId: string) {
    this.logger.log(`simulatePayment() for order=${orderId}`);
    // This replicates the logic in PaymentsController webhook
    const order = await this.ordersService.updateStatus(orderId, 'confirmed' as any, 'system', 'Mock Payment Success');
    return { message: 'Payment simulated successfully', order };
  }

  @Post('mock-status/:orderId')
  @ApiOperation({ summary: 'Simulate a status transition' })
  async simulateStatus(@Param('orderId') orderId: string, @Body('status') status: any) {
    return this.ordersService.updateStatus(orderId, status, 'system', 'Simulation Update');
  }
}
