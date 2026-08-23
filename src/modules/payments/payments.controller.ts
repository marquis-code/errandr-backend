import { Controller, Get, Post, Body, Query, UseGuards, Logger, Inject, forwardRef, Headers, Req } from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../../common/decorators';
import { OrdersService } from '../orders/orders.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { WalletsService } from '../wallets/wallets.service';
import { TransactionStatus } from '../wallets/schemas/transaction.schema';
import { OrderStatus, PaymentStatus, OrderType } from '../orders/schemas/order.schema';
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
    @Inject(forwardRef(() => AppointmentsService)) private readonly appointmentsService: AppointmentsService,
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
        const isCustomErrand = data.metadata?.type === 'custom_errand' || data.metadata?.isCustomErrand;
        const idsToProcess = orderIds || (orderId ? [orderId] : []);

        for (const id of idsToProcess) {
          const order = await this.ordersService.findById(id);
          if (!order) continue;

          // Custom errand initial payment: mark PAID but keep status as PENDING (awaiting rider)
          // Also handle awaiting_payment status for custom errand bid acceptance payment
          if (order.type === OrderType.CUSTOM_ERRAND || isCustomErrand) {
            if (order.paymentStatus !== PaymentStatus.PAID) {
              await (this.ordersService as any).orderModel.updateOne(
                { _id: id },
                { $set: { paymentStatus: PaymentStatus.PAID, paymentReference: reference } }
              );
              this.logger.log(`Custom errand ${id}: payment marked PAID, status stays ${order.status}`);
            }

            // If the order was awaiting_payment (bid accepted), confirm it via payForCustomErrand logic
            if (order.status === OrderStatus.AWAITING_PAYMENT) {
              try {
                await this.ordersService.payForCustomErrand(id, order.customer.toString(), reference);
                this.logger.log(`Custom errand ${id}: awaiting_payment → confirmed via verify`);
              } catch (e: any) {
                this.logger.warn(`Custom errand ${id} payForCustomErrand failed (may already be processed): ${e.message}`);
              }
            } else if (order.status === OrderStatus.PENDING) {
              // Initial creation payment — broadcast to erranders so riders can see it
              await this.ordersService.broadcastNewOrderToErranders(order);
              this.logger.log(`Custom errand ${id}: broadcasted to erranders after payment verification`);
            }
            continue;
          }

          if (order.status !== OrderStatus.CONFIRMED || order.paymentStatus !== PaymentStatus.PAID) {
            // Set payment status to PAID
            await (this.ordersService as any).orderModel.updateOne({ _id: id }, { $set: { paymentStatus: PaymentStatus.PAID } });

            const updatedOrder = await this.ordersService.updateStatus(id, OrderStatus.CONFIRMED, 'SYSTEM', `Payment confirmed via Verify (Ref: ${reference})`);
            
            // Payout vendor now that payment is confirmed
            await this.ordersService.processVendorPayout(updatedOrder);
            
            // Broadcast to all erranders
            await this.ordersService.broadcastNewOrderToErranders(updatedOrder);

            // Notify Vendor
            const vendorObj = await (this.ordersService as any).vendorModel.findById(updatedOrder.vendor).populate('owner');
            if (vendorObj) {
              (this.ordersService as any).notificationsService.notifyVendor(vendorObj, updatedOrder).catch(e => {
                this.logger.error(`Vendor notification cascade failed from verify: ${e.message}`);
              });
            }
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
    const callbackUrl = body.callback_url || body.redirect_url || this.configService.get('PAYSTACK_CALLBACK_URL') || 'https://www.erranders.org/cart';
    
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

          // Virtual Account Top-ups (DVA)
          if (data.channel === 'dedicated_nuban') {
            const customerEmail = data.customer?.email;
            const amount = data.amount / 100;
            if (customerEmail) {
              const user = await this.userModel.findOne({ email: customerEmail });
              if (user) {
                await this.walletsService.creditWallet(
                  user._id.toString(),
                  amount,
                  `Virtual Account Transfer (Ref: ${reference})`,
                  undefined,
                  reference,
                );
                this.logger.log(`Wallet credited successfully for user via DVA: ${user._id}`);
              }
            }
          } else if (type === 'wallet_topup') {
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
          } else if (data.metadata?.appointmentId) {
            const reference = data.reference;
            const appointmentId = data.metadata.appointmentId;
            this.logger.log(`Charge success for appointment: ${appointmentId} (Ref: ${reference})`);
            try {
               await this.appointmentsService.verifyPayment(reference);
            } catch (err: any) {
               this.logger.error(`Failed to verify appointment payment ${appointmentId} from webhook: ${err.message}`);
            }
          } else {
            const orderId = data.metadata?.orderId;
            const orderIds = data.metadata?.orderIds; // New: support for multi-vendor checkout
            const isCustomErrand = data.metadata?.type === 'custom_errand' || data.metadata?.isCustomErrand;
            
            const idsToProcess = orderIds || (orderId ? [orderId] : []);

            // Strict Amount Verification
            let expectedTotal = 0;
            const ordersToProcess: any[] = [];
            for (const id of idsToProcess) {
              const order = await this.ordersService.findById(id);
              if (order) {
                expectedTotal += order.total;
                ordersToProcess.push(order);
              }
            }

            const amountPaid = data.amount / 100; // Paystack sends in kobo
            if (amountPaid < expectedTotal - 5) {
              this.logger.error(`Webhook amount mismatch for Ref: ${reference}. Paid: ${amountPaid}, Expected: ${expectedTotal}. Attempted hack!`);
              return { status: 'error', message: 'Amount mismatch' };
            }

            for (const order of ordersToProcess) {
              const id = order._id.toString();
              try {
                // Custom errand: mark payment, handle status appropriately
                if (order.type === OrderType.CUSTOM_ERRAND || isCustomErrand) {
                  if (order.paymentStatus !== PaymentStatus.PAID) {
                    await (this.ordersService as any).orderModel.updateOne(
                      { _id: id },
                      { $set: { paymentStatus: PaymentStatus.PAID, paymentReference: reference } }
                    );
                    this.logger.log(`Webhook: Custom errand ${id} payment marked PAID, status stays ${order.status}`);
                  }
                  if (order.status === OrderStatus.AWAITING_PAYMENT) {
                    try {
                      await this.ordersService.payForCustomErrand(id, order.customer.toString(), reference);
                      this.logger.log(`Webhook: Custom errand ${id}: awaiting_payment → confirmed`);
                    } catch (e: any) {
                      this.logger.warn(`Webhook: Custom errand ${id} payForCustomErrand skipped: ${e.message}`);
                    }
                  } else if (order.status === OrderStatus.PENDING) {
                    await this.ordersService.broadcastNewOrderToErranders(order);
                    this.logger.log(`Webhook: Custom errand ${id} broadcasted to erranders`);
                  }
                  continue;
                }

                // Idempotency: Check if order is already confirmed
                if (order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.PAID) {
                  this.logger.log(`Order ${id} already confirmed and paid, skipping webhook logic.`);
                  continue;
                }

                this.logger.log(`Charge success for order: ${id} (Ref: ${reference})`);
                
                // Set payment status to PAID
                await (this.ordersService as any).orderModel.updateOne({ _id: id }, { $set: { paymentStatus: PaymentStatus.PAID } });

                const updatedOrder = await this.ordersService.updateStatus(
                  id,
                  OrderStatus.CONFIRMED,
                  'SYSTEM',
                  `Payment confirmed via Webhook (Ref: ${reference})`,
                );
                
                // Payout vendor now that payment is confirmed
                await this.ordersService.processVendorPayout(updatedOrder);
                
                // Broadcast to all erranders
                await this.ordersService.broadcastNewOrderToErranders(updatedOrder);

                // Notify Vendor
                const vendorObj = await (this.ordersService as any).vendorModel.findById(updatedOrder.vendor).populate('owner');
                if (vendorObj) {
                  (this.ordersService as any).notificationsService.notifyVendor(vendorObj, updatedOrder).catch(e => {
                    this.logger.error(`Vendor notification cascade failed from webhook: ${e.message}`);
                  });
                }
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
