import { Controller, Get, Post, Body, Query, UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../../common/decorators';
import { OrdersService } from '../orders/orders.service';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionStatus } from '../wallets/schemas/transaction.schema';
import { OrderStatus } from '../orders/schemas/order.schema';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WalletsService)) private readonly walletsService: WalletsService,
  ) {}

  @Get('banks')
  @ApiOperation({ summary: 'Get supported banks (via Paystack)' })
  getBanks() {
    return this.paystackService.getBanks();
  }

  @Post('resolve-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve bank account (via Paystack)' })
  resolveAccount(@Body() body: { account_number: string; bank_code: string }) {
    return this.paystackService.resolveAccount(body.account_number, body.bank_code);
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment reference (via Paystack)' })
  async verify(@Query('reference') reference: string) {
    return this.paystackService.verifyTransaction(reference);
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Paystack payment' })
  async initialize(@Body() body: { 
    amount: number; 
    email?: string;
    customer?: { name: string; email: string }; 
    metadata?: any;
    callback_url?: string;
    redirect_url?: string;
  }) {
    const reference = `ERR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const callbackUrl = body.callback_url || body.redirect_url || this.configService.get('PAYSTACK_CALLBACK_URL') || 'https://www.errandr.shop/cart';
    
    return this.paystackService.initializeTransaction({
      amount: body.amount,
      email: body.email || body.customer?.email || '',
      reference,
      callback_url: callbackUrl,
      metadata: body.metadata,
    });
  }

  @Post('paystack/webhook')
  @ApiOperation({ summary: 'Paystack Webhook Handler' })
  async handleWebhook(@Body() body: any) {
    this.logger.log(`Paystack Webhook Received: ${body.event}`);
    
    const { event, data } = body;

    try {
      switch (event) {
        case 'charge.success': {
          const orderId = data.metadata?.orderId;
          if (orderId) {
            this.logger.log(`Charge success for order: ${orderId}`);
            const updatedOrder = await this.ordersService.updateStatus(
              orderId,
              OrderStatus.CONFIRMED,
              'SYSTEM',
              'Payment confirmed via Paystack webhook',
            );
            // Broadcast to all erranders that a new paid order is available
            await this.ordersService.broadcastNewOrderToErranders(updatedOrder);
            this.logger.log(`Broadcasted order ${orderId} to all erranders after payment`);
          }
          break;
        }

        case 'transfer.success': {
          const reference = data.reference;
          if (reference) {
            this.logger.log(`Transfer success: ${reference}`);
            await this.walletsService.updateTransactionStatus(
              reference,
              TransactionStatus.COMPLETED,
            );
          }
          break;
        }

        case 'transfer.failed':
        case 'transfer.reversed': {
          const failedRef = data.reference;
          if (failedRef) {
            this.logger.warn(`Transfer failed/reversed: ${failedRef} — Reason: ${data.reason || 'Unknown'}`);
            await this.walletsService.handleFailedPayout(failedRef);
          }
          break;
        }

        default:
          this.logger.warn(`Unhandled Paystack event: ${event}`);
      }
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
    }

    return { status: 'success' };
  }
}
