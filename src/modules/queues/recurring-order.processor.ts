import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RecurringOrdersService } from '../orders/recurring-orders.service';
import { OrdersService } from '../orders/orders.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecurringOrderStatus } from '../orders/schemas/recurring-order.schema';

@Processor('recurring-orders-queue')
export class RecurringOrderProcessor {
  private readonly logger = new Logger(RecurringOrderProcessor.name);

  constructor(
    private readonly recurringOrdersService: RecurringOrdersService,
    private readonly ordersService: OrdersService,
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('process-recurring-order')
  async handleProcessRecurringOrder(job: Job<{ recurringOrderId: string }>) {
    this.logger.debug(`Processing recurring order job: ${job.id}`);
    const { recurringOrderId } = job.data;

    try {
      const recurringOrder = await this.recurringOrdersService.findById(recurringOrderId);
      if (!recurringOrder || recurringOrder.status !== RecurringOrderStatus.ACTIVE) {
        this.logger.debug(`Recurring order ${recurringOrderId} is not active or deleted. Skipping.`);
        return;
      }

      const customerId = recurringOrder.customer.toString();
      const totalAmount = recurringOrder.total;

      // 1. Payment Deduction
      if (recurringOrder.paymentMethod === 'wallet') {
        try {
          await this.walletsService.debitWallet(
            customerId,
            totalAmount,
            `Automated charge for recurring order`,
            'automatic',
            'system'
          );
        } catch (error: any) {
          if (error.message.includes('Insufficient balance')) {
            this.logger.warn(`Insufficient balance for user ${customerId} on recurring order ${recurringOrderId}. Pausing order.`);
            
            // Pause the subscription
            await this.recurringOrdersService.update(recurringOrderId, customerId, { status: RecurringOrderStatus.PAUSED });
            
            // Notify User
            await this.notificationsService.sendNotification(customerId, {
              title: 'Recurring Order Failed',
              body: 'Your scheduled order failed due to insufficient wallet balance. We have paused it. Please top up and resume your schedule.',
              type: 'WALLET_ALERT',
              skipSms: false
            });
            return;
          }
          throw error; // Re-throw other errors to let Bull retry
        }
      } else {
        // Fallback for saved cards not implemented yet. Just throw for now.
        throw new Error(`Payment method ${recurringOrder.paymentMethod} not supported yet for recurring orders.`);
      }

      // 2. Create the actual order
      const orderData = {
        vendor: recurringOrder.vendor?.toString(),
        type: recurringOrder.type,
        locationType: recurringOrder.locationType,
        items: recurringOrder.items,
        menuItems: recurringOrder.menuItems,
        packs: recurringOrder.packs,
        customDetails: recurringOrder.customDetails,
        subtotal: recurringOrder.subtotal,
        deliveryFee: recurringOrder.deliveryFee,
        serviceFee: recurringOrder.serviceFee,
        packagingFee: recurringOrder.packagingFee,
        total: recurringOrder.total,
        deliveryOption: recurringOrder.deliveryOption,
        deliveryMode: recurringOrder.deliveryMode,
        recipientName: recurringOrder.recipientName,
        recipientPhone: recurringOrder.recipientPhone,
        specificAddress: recurringOrder.specificAddress,
        deliveryAddress: recurringOrder.deliveryAddress,
        deliveryLocation: recurringOrder.deliveryLocation,
        vendorNote: recurringOrder.vendorNote,
        deliveryNotes: recurringOrder.deliveryNotes,
        paymentMethod: 'wallet', 
        paymentStatus: 'paid'
      };

      const newOrder = await this.ordersService.create(customerId, orderData);
      
      this.logger.log(`Successfully generated Order ${newOrder.orderNumber} from RecurringOrder ${recurringOrderId}`);

      // 3. Notify user of success
      await this.notificationsService.sendNotification(customerId, {
        title: 'Automated Order Placed! 🚀',
        body: `Your scheduled order ${newOrder.orderNumber} has been placed successfully and paid via your wallet.`,
        type: 'ORDER_PLACED',
        skipSms: true
      });

    } catch (error) {
      this.logger.error(`Error processing recurring order ${recurringOrderId}: ${error.message}`);
      throw error;
    }
  }
}
