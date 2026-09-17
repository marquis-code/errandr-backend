import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WalletsService } from '../modules/wallets/wallets.service';
import { Model } from 'mongoose';
import { Order, OrderStatus, OrderType } from '../modules/orders/schemas/order.schema';
import { Transaction, TransactionType } from '../modules/wallets/schemas/transaction.schema';
import { getModelToken } from '@nestjs/mongoose';

async function bootstrap() {
  console.log('Starting historical errander payouts fix...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const transactionModel = app.get<Model<Transaction>>(getModelToken(Transaction.name));
  const walletsService = app.get<WalletsService>(WalletsService);

  // Find all delivered custom errand orders
  const orders = await orderModel.find({
    type: OrderType.CUSTOM_ERRAND,
    status: OrderStatus.DELIVERED,
    errander: { $exists: true, $ne: null }
  }).exec();

  console.log(`Found ${orders.length} DELIVERED CUSTOM_ERRAND orders.`);

  let fixCount = 0;
  let totalAmountCredited = 0;

  for (const order of orders) {
    try {
      const erranderId = order.errander.toString();
      const orderIdStr = order._id.toString();

      // Check if there's already a credit transaction for this order for this errander's wallet
      const wallet = await walletsService.getOrCreateWallet(erranderId);
      
      const existingTx = await transactionModel.findOne({
        wallet: wallet._id,
        order: orderIdStr,
        type: TransactionType.CREDIT,
        description: { $regex: /Delivery earnings/i }
      }).exec();

      if (!existingTx) {
        // Calculate earnings
        const erranderEarnings = order.erranderPayout || order.deliveryFee || 0;

        if (erranderEarnings > 0) {
          // Check for interception
          const hasInterception = order.interception && (order.interception.status === 'accepted' || order.interception.status === 'completed');
          
          if (hasInterception && order.interception!.secondErrander) {
            const firstShare = erranderEarnings * 0.6;
            const secondShare = erranderEarnings * 0.4;
            
            await walletsService.creditWallet(
              erranderId,
              firstShare,
              `Retroactive delivery earnings (60% Interception) for order ${order.orderNumber}`,
              orderIdStr,
            );
            
            await walletsService.creditWallet(
              order.interception!.secondErrander.toString(),
              secondShare,
              `Retroactive delivery earnings (40% Interception) for order ${order.orderNumber}`,
              orderIdStr,
            );
            console.log(`Fixed order ${order.orderNumber} (Interception): credited ${firstShare} and ${secondShare}`);
          } else {
            await walletsService.creditWallet(
              erranderId,
              erranderEarnings,
              `Retroactive delivery earnings for order ${order.orderNumber}`,
              orderIdStr,
            );
            console.log(`Fixed order ${order.orderNumber}: credited ${erranderEarnings}`);
          }
          
          fixCount++;
          totalAmountCredited += erranderEarnings;
        }
      }
    } catch (e) {
      console.error(`Failed to process order ${order.orderNumber}:`, e.message);
    }
  }

  console.log('--- Migration Complete ---');
  console.log(`Orders fixed: ${fixCount}`);
  console.log(`Total amount credited: ₦${totalAmountCredited}`);

  await app.close();
}

bootstrap();
