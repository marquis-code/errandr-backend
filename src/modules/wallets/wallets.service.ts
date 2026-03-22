import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument, PayoutPreference } from './schemas/wallet.schema';
import { Transaction, TransactionDocument, TransactionType, TransactionStatus } from './schemas/transaction.schema';
import { KorapayService } from '../payments/korapay.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @Inject(forwardRef(() => KorapayService)) private korapayService: KorapayService,
  ) {}

  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    let wallet = await this.walletModel.findOne({ owner: userId });
    if (!wallet) {
      wallet = await this.walletModel.create({ owner: userId });
    }
    return wallet;
  }

  async getWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ owner: userId });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getTransactions(userId: string): Promise<TransactionDocument[]> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.transactionModel
      .find({ wallet: wallet._id })
      .sort({ createdAt: -1 })
      .limit(50);
  }

  async creditWallet(
    userId: string,
    amount: number,
    description: string,
    orderId?: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    
    wallet.balance += amount;
    wallet.totalEarned += amount;
    await wallet.save();

    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.CREDIT,
      description,
      order: orderId,
    });
  }

  async debitWallet(
    userId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    wallet.balance -= amount;
    await wallet.save();

    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.DEBIT,
      description,
    });
  }

  async updatePreferences(userId: string, preference: PayoutPreference, bankDetails?: any): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.payoutPreference = preference;
    if (bankDetails) {
      wallet.bankDetails = bankDetails;
    }
    return wallet.save();
  }

  async withdrawFunds(userId: string, amount: number, userEmail: string, userName: string): Promise<void> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance in wallet');
    }

    if (!wallet.bankDetails || !wallet.bankDetails.bankCode || !wallet.bankDetails.accountNumber) {
      throw new Error('Payout preferences not set correctly');
    }

    // Initiate Korapay Disbursement
    const reference = `WD-${uuidv4().slice(0, 8).toUpperCase()}`;
    const payout = await this.korapayService.initiatePayout({
      amount,
      reference,
      bank_account: {
        bank_code: wallet.bankDetails.bankCode,
        account_number: wallet.bankDetails.accountNumber,
      },
      customer: {
        name: userName,
        email: userEmail,
      },
      narration: `Withdrawal from Errandr Wallet - ${reference}`,
    });

    if (payout.status !== 'success') {
      throw new Error(payout.message || 'Payout initiation failed via Korapay');
    }

    // Debit Wallet
    wallet.balance -= amount;
    await wallet.save();

    // Log Transaction
    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.DEBIT,
      status: TransactionStatus.PENDING,
      description: `Withdrawal initiated: ${reference}`,
      metadata: { korapayReference: reference, payoutId: payout.data?.id },
    });
  }

  /**
   * Called by the webhook when a payout succeeds.
   * Marks the pending withdrawal transaction as COMPLETED.
   */
  async updateTransactionStatus(reference: string, status: TransactionStatus): Promise<void> {
    const transaction = await this.transactionModel.findOne({
      'metadata.korapayReference': reference,
    });
    if (transaction) {
      transaction.status = status;
      await transaction.save();
    }
  }

  /**
   * Called by the webhook when a payout fails.
   * Refunds the wallet balance and marks the transaction as FAILED.
   */
  async handleFailedPayout(reference: string): Promise<void> {
    const transaction = await this.transactionModel.findOne({
      'metadata.korapayReference': reference,
    });
    if (!transaction) return;

    // Mark transaction as failed
    transaction.status = TransactionStatus.FAILED;
    transaction.description += ' (FAILED — refunded)';
    await transaction.save();

    // Refund the wallet
    const wallet = await this.walletModel.findById(transaction.wallet);
    if (wallet) {
      wallet.balance += transaction.amount;
      await wallet.save();
    }
  }

  async getAllTransactions(): Promise<TransactionDocument[]> {
    return this.transactionModel
      .find()
      .populate({
        path: 'wallet',
        populate: { path: 'owner', select: 'firstName lastName email' }
      })
      .sort({ createdAt: -1 })
      .limit(100);
  }

  async getGlobalStats() {
    const [totalVolume, totalCommissions] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      this.transactionModel.aggregate([
        { $match: { description: { $regex: /order/i } } }, // Simplifying commission logic for now
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return {
      totalVolume: totalVolume[0]?.total || 0,
      totalCommissions: Math.round((totalVolume[0]?.total || 0) * 0.05), // Calculated 5% platform share
    };
  }
}
