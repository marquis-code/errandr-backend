import { Controller, Get, Post, Body, Query, UseGuards, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KorapayService } from './korapay.service';
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
    private readonly korapayService: KorapayService,
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
  @ApiOperation({ summary: 'Verify payment reference' })
  async verify(@Query('reference') reference: string) {
    return this.korapayService.verifyCharge(reference);
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Korapay payment' })
  async initialize(@Body() body: { 
    amount: number; 
    customer: { name: string; email: string }; 
    metadata?: any;
    redirect_url?: string;
  }) {
    const reference = `ERR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const webhookUrl = this.configService.get('KORAPAY_WEBHOOK_URL') || 'http://localhost:3000/api/v1/payments/korapay/webhook';
    return this.korapayService.initializeCharge({
      ...body,
      reference,
      notification_url: webhookUrl,
    });
  }

  @Post('korapay/webhook')
  @ApiOperation({ summary: 'Korapay Webhook Handler' })
  async handleWebhook(@Body() body: any) {
    this.logger.log(`Korapay Webhook Received: ${body.event}`);
    
    const { event, data } = body;

    try {
      switch (event) {
        case 'charge.success': {
          const orderId = data.metadata?.orderId;
          if (orderId) {
            this.logger.log(`Charge success for order: ${orderId}`);
            await this.ordersService.updateStatus(
              orderId,
              OrderStatus.CONFIRMED,
              'SYSTEM',
              'Payment confirmed via Korapay webhook',
            );
          }
          break;
        }

        case 'transfer.success':
        case 'payout.success': {
          const reference = data.reference;
          if (reference) {
            this.logger.log(`Payout success: ${reference}`);
            await this.walletsService.updateTransactionStatus(
              reference,
              TransactionStatus.COMPLETED,
            );
          }
          break;
        }

        case 'transfer.failed':
        case 'payout.failed': {
          const failedRef = data.reference;
          if (failedRef) {
            this.logger.warn(`Payout failed: ${failedRef} — Reason: ${data.message || 'Unknown'}`);
            await this.walletsService.handleFailedPayout(failedRef);
          }
          break;
        }

        default:
          this.logger.warn(`Unhandled webhook event: ${event}`);
      }
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
    }

    return { status: 'success' };
  }
}
