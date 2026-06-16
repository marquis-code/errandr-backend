import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument, PayoutPreference } from './schemas/wallet.schema';
import { Transaction, TransactionDocument, TransactionType, TransactionStatus } from './schemas/transaction.schema';
import { PaystackService } from '../payments/paystack.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => PaystackService)) private paystackService: PaystackService,
    private emailService: EmailService,
  ) {}

  async getOrCreateWallet(userId: string): Promise<WalletDocument> {
    let wallet = await this.walletModel.findOne({ owner: userId });
    if (!wallet) {
      try {
        wallet = await this.walletModel.create({ owner: userId });
      } catch (error: any) {
        if (error.code === 11000) {
          wallet = await this.walletModel.findOne({ owner: userId });
        } else {
          throw error;
        }
      }
    }
    return wallet as WalletDocument;
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
    reference?: string,
  ): Promise<void> {
    // 1. Idempotency Check: Don't process the same reference twice
    if (reference) {
      const existing = await this.transactionModel.findOne({ reference });
      if (existing) return; 
    }

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
      reference,
      status: TransactionStatus.COMPLETED
    });

    // Send Top-up Email if this is a top-up
    if (description.toLowerCase().includes('top-up') || description.toLowerCase().includes('funded')) {
      try {
        const user = await this.userModel.findById(userId);
        if (user && user.email) {
          await this.emailService.sendPaymentReceipt(user.email, amount, reference || 'WALLET_UPDATE', 'wallet_topup');
        }
      } catch (e) {
        console.error('Failed to send wallet credit email:', e.message);
      }
    }
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

  async updatePreferences(userId: string, preference: PayoutPreference, bankDetails?: any, metadata?: any): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.payoutPreference = preference;
    if (bankDetails !== undefined) {
      wallet.bankDetails = bankDetails;
    }
    if (metadata !== undefined) {
      wallet.metadata = { ...wallet.metadata, ...metadata };
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

    // Check if we should use Mock Payout
    const isTestKey = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test');
    const useMock = Boolean(isTestKey || process.env.USE_MOCK_PAYOUT === 'true');

    if (useMock) {
      const reference = `MOCK-WD-${uuidv4().slice(0, 8).toUpperCase()}`;
      wallet.balance -= amount;
      await wallet.save();

      await this.transactionModel.create({
        wallet: wallet._id,
        amount,
        type: TransactionType.DEBIT,
        status: TransactionStatus.COMPLETED,
        description: `Withdrawal (Mock): ${reference}`,
        reference,
        metadata: {
          mock: true,
          bankCode: wallet.bankDetails.bankCode,
          accountNumber: wallet.bankDetails.accountNumber
        }
      });

      return;
    }

    // Resolve bank account first to get account name if needed, then create recipient
    const recipient = await this.paystackService.createTransferRecipient({
      name: userName,
      account_number: wallet.bankDetails.accountNumber,
      bank_code: wallet.bankDetails.bankCode,
    });

    // Initiate Paystack Transfer
    const reference = `WD-${uuidv4().slice(0, 8).toUpperCase()}`;
    const transfer = await this.paystackService.initiateTransfer({
      amount,
      reference,
      recipient: recipient.recipient_code,
      reason: `Withdrawal from Erranders Wallet - ${reference}`,
    });

    if ((transfer as any).status !== true && (transfer as any).status !== 'success') {
      throw new Error((transfer as any).message || 'Transfer initiation failed via Paystack');
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
      metadata: { paystackReference: reference, transferCode: (transfer as any).data?.transfer_code },
    });
  }

  /**
   * Called by the webhook when a payout succeeds.
   * Marks the pending withdrawal transaction as COMPLETED.
   */
  async updateTransactionStatus(reference: string, status: TransactionStatus): Promise<void> {
    const transaction = await this.transactionModel.findOne({
      'metadata.paystackReference': reference,
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
      'metadata.paystackReference': reference,
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
