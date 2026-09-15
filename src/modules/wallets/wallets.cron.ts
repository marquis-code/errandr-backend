import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionStatus, TransactionType } from './schemas/transaction.schema';
import { Wallet, PayoutPreference } from './schemas/wallet.schema';
import { WalletsService } from './wallets.service';

@Injectable()
export class WalletsCronService {
  private readonly logger = new Logger(WalletsCronService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    private readonly walletsService: WalletsService,
  ) {}

  @Cron('0 23 * * *') // 11:00 PM Every Day
  async triggerDailySweeps() {
    this.logger.log('Triggering automated daily sweeps...');
    await this.triggerSweepsForPreference(PayoutPreference.DAILY);
  }

  @Cron('0 23 * * 0') // 11:00 PM Every Sunday
  async triggerWeeklySweeps() {
    this.logger.log('Triggering automated weekly sweeps...');
    await this.triggerSweepsForPreference(PayoutPreference.WEEKLY);
  }

  private async triggerSweepsForPreference(preference: PayoutPreference) {
    try {
      const wallets = await this.walletModel.find({
        payoutPreference: preference,
        balance: { $gt: 0 },
        isActive: true,
      }).populate('owner');

      this.logger.log(`Found ${wallets.length} wallets eligible for ${preference} sweep.`);

      let sweepCount = 0;
      for (const wallet of wallets) {
        try {
          const owner = wallet.owner as any;
          if (!owner) continue;

          const activeBank = (wallet.bankAccounts && wallet.bankAccounts.find(b => b.isActive)) 
            || (wallet.bankAccounts && wallet.bankAccounts[0]) 
            || wallet.bankDetails;

          if (!activeBank || !activeBank.accountNumber || !activeBank.bankCode) {
            this.logger.warn(`Wallet ${wallet._id} has no valid bank details for automated sweep. Skipping.`);
            continue;
          }

          const userName = `${owner.firstName || 'Vendor'} ${owner.lastName || ''}`.trim();
          
          await this.walletsService.withdrawFunds(
            owner._id.toString(),
            wallet.balance,
            owner.email || '',
            userName,
            { accountNumber: activeBank.accountNumber, bankCode: activeBank.bankCode },
            false // isInstant = false for scheduled sweeps
          );
          sweepCount++;
        } catch (err: any) {
          this.logger.error(`Failed to trigger sweep for wallet ${wallet._id}: ${err.message}`);
        }
      }
      this.logger.log(`Triggered ${sweepCount} ${preference} sweep withdrawals.`);
    } catch (err: any) {
      this.logger.error(`Error finding wallets for ${preference} sweep: ${err.message}`, err.stack);
    }
  }

  @Cron('30 23 * * *') // 11:30 PM Every Day
  async processPendingWithdrawals() {
    this.logger.log('Starting execution of pending withdrawal requests...');

    try {
      const pendingWithdrawals = await this.transactionModel.find({
        status: TransactionStatus.PENDING,
        type: TransactionType.DEBIT,
        'metadata.isPayoutRequest': true,
      });

      this.logger.log(`Found ${pendingWithdrawals.length} pending withdrawal requests to execute.`);

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

      this.logger.log(`Pending withdrawals execution completed. Success: ${successCount}, Failures: ${failureCount}`);
    } catch (error: any) {
      this.logger.error(`Error during pending withdrawals execution: ${error.message}`, error.stack);
    }
  }
}
