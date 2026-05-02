import { Controller, Get, Post, Body, Query, UseGuards, Logger, Inject, forwardRef, Headers, Req } from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../../common/decorators';
import { OrdersService } from '../orders/orders.service';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionStatus } from '../wallets/schemas/transaction.schema';
import { OrderStatus } from '../orders/schemas/order.schema';
import { User } from '../users/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailService } from '../email/email.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paystackService: PaystackService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => WalletsService)) private readonly walletsService: WalletsService,
    private readonly emailService: EmailService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
  async verify(@Query('reference') reference: string, @Req() req: any) {
    this.logger.log(`External verification request for Ref: ${reference} from User: ${req.user?._id}`);
    const verification = await this.paystackService.verifyTransaction(reference);
    
    if (verification.status === 'success') {
      // PROACTIVELY PROCESS SUCCESS (In case webhook is delayed or missed)
      const data = verification.data;
      const type = data.metadata?.type;
      const amount = data.amount / 100;

      if (type === 'wallet_topup') {
        const userId = data.metadata?.userId;
        await this.walletsService.creditWallet(userId, amount, `Wallet Top-up (Ref: ${reference})`, undefined, reference);
      } else {
        const orderId = data.metadata?.orderId;
        const orderIds = data.metadata?.orderIds;
        const idsToProcess = orderIds || (orderId ? [orderId] : []);

        for (const id of idsToProcess) {
          const order = await this.ordersService.findById(id);
          if (order && order.status !== OrderStatus.CONFIRMED) {
            await this.ordersService.updateStatus(id, OrderStatus.CONFIRMED, 'SYSTEM', `Payment confirmed via Verify (Ref: ${reference})`);
            // Note: Email and Broadcast might happen in updateStatus or should be added if not.
          }
        }
      }
    }

    return verification;
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Paystack payment' })
  async initialize(
    @Req() req: any,
    @Body() body: { 
      amount: number; 
      email?: string;
      customer?: { name: string; email: string }; 
      metadata?: any;
      callback_url?: string;
      redirect_url?: string;
    }
  ) {
    const userId = req.user._id.toString();
    const reference = `ERR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const callbackUrl = body.callback_url || body.redirect_url || this.configService.get('PAYSTACK_CALLBACK_URL') || 'https://www.errandr.shop/cart';
    
    // Security: Enforce userId in metadata to be the logged-in user
    const sanitizedMetadata = {
      ...(body.metadata || {}),
      userId: userId,
    };

    return this.paystackService.initializeTransaction({
      amount: body.amount,
      email: body.email || body.customer?.email || req.user.email || '',
      reference,
      callback_url: callbackUrl,
      metadata: sanitizedMetadata,
    });
  }

  @Post('wallet/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay for an order using wallet balance' })
  async payWithWallet(@Req() req: any, @Body() body: { orderId: string }) {
    return this.ordersService.payWithWallet(body.orderId, req.user._id.toString());
  }

  @Post('paystack/webhook')
  @ApiOperation({ summary: 'Paystack Webhook Handler' })
  async handleWebhook(@Body() body: any, @Headers('x-paystack-signature') signature: string) {
    // 1. Verify HMAC Signature
    const secret = this.configService.get('PAYSTACK_SECRET_KEY');
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) {
      this.logger.error('Invalid Paystack Webhook Signature — Potential Spoofing Attempt');
      return { status: 'error', message: 'Invalid signature' };
    }

    this.logger.log(`Paystack Webhook Verified: ${body.event}`);
    const { event, data } = body;

    try {
      switch (event) {
        case 'charge.success': {
          const type = data.metadata?.type;
          const reference = data.reference;

          if (type === 'wallet_topup') {
            const userId = data.metadata?.userId;
            const amount = data.amount / 100; // Paystack sends in kobo
            this.logger.log(`Wallet top-up success for user: ${userId} (Ref: ${reference}, Amount: ${amount})`);
            await this.walletsService.creditWallet(
              userId,
              amount,
              `Wallet Top-up (Ref: ${reference})`,
              undefined,
              reference,
            );
            this.logger.log(`Wallet credited successfully for user: ${userId}`);
          } else {
            const orderId = data.metadata?.orderId;
            const orderIds = data.metadata?.orderIds; // New: support for multi-vendor checkout
            
            const idsToProcess = orderIds || (orderId ? [orderId] : []);

            for (const id of idsToProcess) {
              try {
                // Idempotency: Check if order is already confirmed
                const order = await this.ordersService.findById(id);
                if (order.status === OrderStatus.CONFIRMED) {
                  this.logger.log(`Order ${id} already confirmed, skipping webhook logic.`);
                  continue;
                }

                this.logger.log(`Charge success for order: ${id} (Ref: ${reference})`);
                const updatedOrder = await this.ordersService.updateStatus(
                  id,
                  OrderStatus.CONFIRMED,
                  'SYSTEM',
                  `Payment confirmed via Webhook (Ref: ${reference})`,
                );
                
                // Broadcast to all erranders
                await this.ordersService.broadcastNewOrderToErranders(updatedOrder);
              } catch (err: any) {
                this.logger.error(`Failed to process order ${id} from webhook: ${err.message}`);
              }
            }
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
