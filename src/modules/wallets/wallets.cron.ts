import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionStatus, TransactionType } from './schemas/transaction.schema';
import { Wallet, PayoutPreference } from './schemas/wallet.schema';
import { User } from '../users/schemas/user.schema';
import { WalletsService } from './wallets.service';

@Injectable()
export class WalletsCronService {
  private readonly logger = new Logger(WalletsCronService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly walletsService: WalletsService,
  ) {}

  @Cron('0 23 * * *', { timeZone: 'Africa/Lagos' }) // 11:00 PM Every Day (WAT)
  async triggerDailySweeps() {
    this.logger.log('Triggering automated daily sweeps...');
    await this.triggerSweepsForPreference(PayoutPreference.DAILY);
  }

  @Cron('0 23 * * 0', { timeZone: 'Africa/Lagos' }) // 11:00 PM Every Sunday (WAT)
  async triggerWeeklySweeps() {
    this.logger.log('Triggering automated weekly sweeps...');
    await this.triggerSweepsForPreference(PayoutPreference.WEEKLY);
  }

  @Cron('0 23 28 * *', { timeZone: 'Africa/Lagos' }) // 11:00 PM on the 28th of every month (WAT)
  async triggerMonthlySweeps() {
    this.logger.log('Triggering automated monthly sweeps...');
    await this.triggerSweepsForPreference(PayoutPreference.MONTHLY);
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

  /**
   * 12:00 Midnight Automated Payout Processing (Nigeria WAT)
   * Paystack customer balances and daily settlements update at 12 Midnight,
   * providing sufficient funding for vendor settlements and Errand Ninja payouts.
   */
  @Cron('0 0 * * *', { timeZone: 'Africa/Lagos' })
  async processMidnightPayouts() {
    this.logger.log('🕛 [Midnight Cron] Starting 12:00 Midnight Automated Payout Processing...');

    // 1. Specifically handle Smoothie Daddi (once at 12 midnight, as requested)
    await this.processSmoothieDaddiMidnightPayout();

    // 2. Process all pending withdrawal requests for vendors & errand ninjas
    await this.processPendingWithdrawals();
  }

  /**
   * Safety retry at 12:05 AM in case of any settlement propagation lag
   */
  @Cron('5 0 * * *', { timeZone: 'Africa/Lagos' })
  async retryMidnightPendingWithdrawals() {
    this.logger.log('🕛 [Midnight Cron Retry] Running 12:05 AM verification & retry for pending payouts...');
    await this.processPendingWithdrawals();
  }

  /**
   * One-time midnight payout executor for Smoothie Daddi
   * Guarantees that the payout runs once at 12:00 Midnight after Paystack funds refresh,
   * and dispatches the official payment receipt directly to their WhatsApp.
   */
  async processSmoothieDaddiMidnightPayout() {
    const targetEmail = 'smoothiedaddi@luth.com';
    try {
      this.logger.log(`[Midnight Cron] Checking scheduled midnight payout for ${targetEmail}...`);

      // 1. Guard: Check if already completed
      const alreadyCompleted = await this.transactionModel.findOne({
        'metadata.userEmail': targetEmail,
        status: TransactionStatus.COMPLETED,
        'metadata.midnightCronExecuted': true,
      });

      if (alreadyCompleted) {
        this.logger.log(`[Midnight Cron] Payout for ${targetEmail} was already completed on ${alreadyCompleted.metadata?.executedAtMidnight}. Skipping.`);
        return;
      }

      // 2. Check for an existing PENDING payout transaction for Smoothie Daddi
      let pendingTx = await this.transactionModel.findOne({
        'metadata.userEmail': targetEmail,
        status: TransactionStatus.PENDING,
        type: TransactionType.DEBIT,
        'metadata.isPayoutRequest': true,
      });

      // 3. If no pending transaction exists, check if wallet has balance to initiate it
      if (!pendingTx) {
        const user = await this.userModel.findOne({ email: targetEmail });
        if (user) {
          const wallet = await this.walletModel.findOne({ owner: user._id });
          if (wallet && wallet.balance >= 34250) {
            this.logger.log(`[Midnight Cron] Initiating withdrawal of ₦${Math.min(wallet.balance, 34300)} for ${targetEmail}...`);
            const bank = (wallet.bankAccounts && wallet.bankAccounts[0]) || wallet.bankDetails;
            if (bank?.accountNumber && bank?.bankCode) {
              await this.walletsService.withdrawFunds(
                user._id.toString(),
                Math.min(wallet.balance, 34300),
                user.email,
                'Smoothie Daddi',
                { accountNumber: bank.accountNumber, bankCode: bank.bankCode },
                false, // queued as PENDING
              );

              pendingTx = await this.transactionModel.findOne({
                wallet: wallet._id,
                status: TransactionStatus.PENDING,
                type: TransactionType.DEBIT,
                'metadata.isPayoutRequest': true,
              }).sort({ createdAt: -1 });
            }
          }
        }
      }

      // 4. If pending transaction exists, approve and trigger transfer
      if (pendingTx) {
        this.logger.log(`[Midnight Cron] Executing payout for ${targetEmail} (Tx: ${pendingTx._id}, Ref: ${pendingTx.reference}, Amount: ₦${pendingTx.amount})...`);
        await this.walletsService.approvePayoutRequest(pendingTx._id.toString());

        await this.transactionModel.updateOne(
          { _id: pendingTx._id },
          {
            $set: {
              'metadata.midnightCronExecuted': true,
              'metadata.executedAtMidnight': new Date().toISOString(),
            },
          },
        );
        this.logger.log(`[Midnight Cron] Successfully approved payout for ${targetEmail}. Receipt delivered to WhatsApp.`);
      } else {
        this.logger.log(`[Midnight Cron] No pending payout or eligible balance found for ${targetEmail}.`);
      }
    } catch (error: any) {
      this.logger.error(`[Midnight Cron] Error executing payout for ${targetEmail}: ${error.message}`, error.stack);
    }
  }

  /**
   * Processes all pending withdrawal requests for vendors and Errand Ninjas.
   * Each successful approval triggers WhatsApp and Email receipts automatically.
   */
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
          this.logger.log(`Successfully approved payout for transaction ${transaction._id} (Ref: ${transaction.reference})`);
          successCount++;
        } catch (error: any) {
          this.logger.error(`Failed to approve payout for transaction ${transaction._id}: ${error.message}`);
          failureCount++;
          // Loop continues for other transactions
        }
      }

      this.logger.log(`Pending withdrawals execution completed. Success: ${successCount}, Failures: ${failureCount}`);
    } catch (error: any) {
      this.logger.error(`Error during pending withdrawals execution: ${error.message}`, error.stack);
    }
  }
}
