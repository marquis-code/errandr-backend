import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaystackService } from '../payments/paystack.service';

/**
 * Sends unused safety-buffer money back to the customer's bank, once a day.
 *
 * Buffers accumulate in the wallet during the day, so three errands become one transfer at 23:00
 * rather than three small ones. Only `bufferBalance` is paid — never the wallet balance, which
 * holds money the customer topped up and expects to spend in the app.
 *
 * Runs as a report unless BUFFER_PAYOUT_ENABLED is explicitly 'true'. A job that moves customer
 * money to bank accounts should never begin life able to pay, because a bug here is not a bug you
 * read about — it is one you hear about from someone whose refund went to the wrong place.
 */
@Injectable()
export class BufferPayoutCron implements OnModuleInit {
  private readonly logger = new Logger(BufferPayoutCron.name);
  // Read from settings at run time, not at boot: switching this from the admin must take effect
  // tonight, not at the next deploy.

  constructor(
    @InjectModel('Wallet') private readonly walletModel: Model<any>,
    private readonly paystackService: PaystackService,
    @InjectModel('SystemSetting') private readonly settingModel: Model<any>,
  ) {}

  /** Admin-controlled. Off unless someone has deliberately turned it on. */
  private async config(): Promise<{ enabled: boolean; minimum: number }> {
    try {
      const setting = await this.settingModel.findOne({ key: 'buffer_payout' }).lean().exec();
      const cfg: any = (setting as any)?.value || {};
      return {
        enabled: cfg.enabled === true,
        minimum: Number(cfg.minimumPayout ?? 100),
      };
    } catch {
      return { enabled: false, minimum: 100 };
    }
  }

  onModuleInit(): void {
    this.logger.log(
      'Buffer payout scheduled 23:00 Africa/Lagos — controlled by Settings > buffer payouts',
    );
  }

  @Cron('0 0 23 * * *', { name: 'buffer-payout', timeZone: 'Africa/Lagos' })
  async run(): Promise<void> {
    await this.settle();
  }

  /** Also callable from the admin so the list can be inspected before enabling. */
  async settle(): Promise<{ candidates: number; total: number; paid: number; skipped: number; rows: any[] }> {
    const rows: any[] = [];
    let total = 0;
    let paid = 0;
    let skipped = 0;

    try {
      const { enabled, minimum } = await this.config();
      this.logger.log(`Buffer payout run — ${enabled ? 'LIVE' : 'REPORT ONLY'}, minimum ₦${minimum}`);

      const wallets = await this.walletModel
        .find({ bufferBalance: { $gte: minimum } })
        .populate('owner', 'firstName lastName email phone')
        .lean()
        .exec();

      for (const wallet of wallets as any[]) {
        const owner = wallet.owner;
        const amount = Number(wallet.bufferBalance) || 0;
        if (!owner || amount <= 0) continue;

        const bank =
          (wallet.bankAccounts || []).find((b: any) => b.isActive) ||
          (wallet.bankAccounts || [])[0] ||
          wallet.bankDetails;

        const row: any = {
          customer: `${owner.firstName || ''} ${owner.lastName || ''}`.trim(),
          amount,
          bank: bank ? `${bank.bankName || ''} ${bank.accountNumber || ''}`.trim() : null,
        };

        if (!bank?.accountNumber || !bank?.bankCode) {
          // No account on file: hold the money rather than losing it.
          row.reason = 'no bank account on file';
          rows.push(row);
          skipped += 1;
          continue;
        }

        total += amount;

        if (!enabled) {
          row.reason = 'report only';
          rows.push(row);
          continue;
        }

        const credited = await this.payBank(owner, bank, amount);
        if (credited) {
          // Decrement only after a confirmed transfer, so a failure retries tomorrow rather than
          // silently forgetting it.
          await this.walletModel.updateOne(
            { _id: wallet._id, bufferBalance: { $gte: amount } },
            { $inc: { bufferBalance: -amount } },
          );
          row.reason = 'paid';
          paid += 1;
        } else {
          row.reason = 'transfer failed';
          skipped += 1;
        }
        rows.push(row);
      }

      this.logger.log(
        `Buffer payout: ${rows.length} wallets, ₦${total} queued, ${paid} paid, ${skipped} skipped`,
      );
    } catch (e: any) {
      this.logger.error(`Buffer payout failed: ${e?.message || e}`);
    }

    return { candidates: rows.length, total, paid, skipped, rows };
  }

  private async payBank(owner: any, bank: any, amount: number): Promise<boolean> {
    try {
      const recipient = await this.paystackService.createTransferRecipient({
        name: bank.accountName || `${owner.firstName || ''} ${owner.lastName || ''}`.trim(),
        account_number: bank.accountNumber,
        bank_code: bank.bankCode,
      });

      await this.paystackService.initiateTransfer({
        amount: Math.round(amount * 100),
        reference: `BUFFER-${owner._id}-${Date.now()}`,
        recipient: (recipient as any)?.recipient_code || (recipient as any)?.data?.recipient_code,
        reason: `Erranders unused buffer refund — ${owner.email || owner.phone || ''}`,
      });

      return true;
    } catch (e: any) {
      this.logger.error(`Buffer transfer failed for ${owner?._id}: ${e?.message || e}`);
      return false;
    }
  }
}
