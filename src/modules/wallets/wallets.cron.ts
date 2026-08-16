import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionStatus, TransactionType } from './schemas/transaction.schema';
import { WalletsService } from './wallets.service';

@Injectable()
export class WalletsCronService {
  private readonly logger = new Logger(WalletsCronService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    private readonly walletsService: WalletsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async processDailyPayouts() {
    this.logger.log('Starting automated daily payout processing...');

    try {
      const pendingWithdrawals = await this.transactionModel.find({
        status: TransactionStatus.PENDING,
        type: TransactionType.DEBIT,
        'metadata.isPayoutRequest': true,
      });

      this.logger.log(`Found ${pendingWithdrawals.length} pending withdrawal requests to process.`);

      let successCount = 0;
      let failureCount = 0;

      for (const transaction of pendingWithdrawals) {
        try {
          await this.walletsService.approvePayoutRequest(transaction._id.toString());
          this.logger.log(`Successfully approved payout for transaction ${transaction._id}`);
          successCount++;
        } catch (error: any) {
          this.logger.error(`Failed to approve payout for transaction ${transaction._id}: ${error.message}`);
          failureCount++;
          // We don't throw here to ensure the loop continues for other transactions
        }
      }

      this.logger.log(`Daily payout processing completed. Success: ${successCount}, Failures: ${failureCount}`);
    } catch (error: any) {
      this.logger.error(`Error during daily payout processing execution: ${error.message}`, error.stack);
    }
  }
}
