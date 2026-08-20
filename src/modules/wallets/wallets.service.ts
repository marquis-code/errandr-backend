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
    if (wallet && !wallet.virtualAccount) {
      // Async fire-and-forget to avoid blocking the initial wallet load
      this.generateVirtualAccount(wallet).catch(err => {
        console.error('Failed to generate virtual account for wallet:', err.message);
      });
    }

    return wallet as WalletDocument;
  }

  async generateVirtualAccount(wallet: WalletDocument): Promise<void> {
    if (wallet.virtualAccount) return; // Already exists

    const user = await this.userModel.findById(wallet.owner);
    if (!user) return;

    try {
      let customerId = wallet.paystackCustomerId;
      
      if (!customerId) {
        // 1. Create Customer
        const customer = await this.paystackService.createCustomer({
          email: user.email || `${user._id}@erranders.org`,
          first_name: user.firstName || 'Errander',
          last_name: user.lastName || 'User',
          phone: user.phone || '00000000000'
        });
        customerId = customer.customer_code;
        wallet.paystackCustomerId = customerId;
        await wallet.save();
      }

      // 2. Create Dedicated Virtual Account
      const dva = await this.paystackService.createDedicatedAccount({
        customer: customerId as string,
        preferred_bank: 'wema-bank'
      });

      // 3. Save to wallet
      wallet.virtualAccount = {
        bankName: dva.bank.name,
        accountNumber: dva.account_number,
        accountName: dva.account_name
      };
      await wallet.save();
    } catch (error: any) {
      console.error(`Error generating virtual account for ${user._id}:`, error.message);
      throw error;
    }
  }

  async getWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({ owner: userId });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async subscribeToPrime(userId: string): Promise<void> {
    const fee = 1500;
    await this.debitWallet(userId, fee, 'Campus Prime Subscription - 30 Days');
    
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    await this.userModel.findByIdAndUpdate(userId, {
      campusPrimeActive: true,
      campusPrimeExpiry: expiry,
    });
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
    
    // Check if we already processed this order payout to prevent double-crediting
    if (orderId) {
      const existing = await this.transactionModel.findOne({
        wallet: wallet._id,
        order: orderId,
        type: TransactionType.CREDIT,
      });
      if (existing) {
        return; 
      }
    }
    
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

  async updatePreferences(userId: string, preference: PayoutPreference, bankDetails?: any, metadata?: any, bankAccounts?: any[]): Promise<WalletDocument> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.payoutPreference = preference;
    if (bankDetails !== undefined) {
      wallet.bankDetails = bankDetails;
    }
    if (bankAccounts !== undefined) {
      wallet.bankAccounts = bankAccounts;
    }
    if (metadata !== undefined) {
      wallet.metadata = { ...wallet.metadata, ...metadata };
      wallet.markModified('metadata');
    }
    wallet.markModified('bankAccounts');
    return wallet.save();
  }

  async withdrawFunds(userId: string, amount: number, userEmail: string, userName: string, selectedBankAccount?: { accountNumber: string, bankCode: string }, isInstant?: boolean): Promise<void> {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance in wallet');
    }

    const targetBankCode = selectedBankAccount?.bankCode || wallet.bankDetails?.bankCode;
    const targetAccountNumber = selectedBankAccount?.accountNumber || wallet.bankDetails?.accountNumber;

    if (!targetBankCode || !targetAccountNumber) {
      throw new Error('Payout preferences not set correctly');
    }

    // Generate a reference
    const reference = `WD-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Debit Wallet to lock funds
    wallet.balance -= amount;
    await wallet.save();

    // Log Transaction as PENDING (Queued for automated processing)
    const transaction = await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.DEBIT,
      status: TransactionStatus.PENDING,
      description: `Withdrawal request: ${reference}`,
      reference,
      metadata: { 
        isPayoutRequest: true,
        isInstant: true,
        userName,
        userEmail,
        bankCode: targetBankCode, 
        accountNumber: targetAccountNumber 
      },
    });

    // Process immediately for all users
    try {
      await this.approvePayoutRequest(transaction._id.toString());
    } catch (error: any) {
      // Rollback if instant payout fails
      wallet.balance += amount;
      await wallet.save();
      transaction.status = TransactionStatus.FAILED;
      transaction.description = `Instant withdrawal failed: ${error.message}`;
      await transaction.save();
      throw error;
    }
  }

  async approvePayoutRequest(transactionId: string): Promise<void> {
    const transaction = await this.transactionModel.findById(transactionId).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });

    if (!transaction || transaction.type !== TransactionType.DEBIT || transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Invalid or already processed payout request');
    }

    if (!transaction.metadata?.bankCode || !transaction.metadata?.accountNumber) {
      throw new Error('Missing bank details in transaction metadata');
    }

    const isTestKey = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test');
    const useMock = Boolean(isTestKey || process.env.USE_MOCK_PAYOUT === 'true');

    if (useMock) {
      transaction.status = TransactionStatus.COMPLETED;
      transaction.description = `Withdrawal (Mock): ${transaction.reference}`;
      transaction.metadata = { ...transaction.metadata, mock: true, approvedAt: new Date().toISOString() };
      await transaction.save();
      return;
    }

    // Resolve bank account first to get account name if needed, then create recipient
    const recipient = await this.paystackService.createTransferRecipient({
      name: transaction.metadata.userName || 'Erranders User',
      account_number: transaction.metadata.accountNumber,
      bank_code: transaction.metadata.bankCode,
    });

    const isInstant = transaction.metadata.isInstant === true;
    const payoutAmount = isInstant ? Math.round(transaction.amount * 0.99) : transaction.amount;

    // Initiate Paystack Transfer
    const transfer = await this.paystackService.initiateTransfer({
      amount: payoutAmount,
      reference: transaction.reference as string,
      recipient: recipient.recipient_code,
      reason: `Withdrawal from Erranders Wallet - ${transaction.reference}`,
    });

    if ((transfer as any).status !== true && (transfer as any).status !== 'success') {
      throw new Error((transfer as any).message || 'Transfer initiation failed via Paystack');
    }

    transaction.metadata = { 
      ...transaction.metadata, 
      paystackReference: transaction.reference, 
      transferCode: (transfer as any).data?.transfer_code,
      approvedAt: new Date().toISOString()
    };
    // Keep it pending until webhook confirms, but update metadata
    await transaction.save();
  }

  async markPayoutAsPaid(transactionId: string): Promise<void> {
    const transaction = await this.transactionModel.findById(transactionId);
    
    if (!transaction || transaction.type !== TransactionType.DEBIT || transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Invalid or already processed payout request');
    }

    transaction.status = TransactionStatus.COMPLETED;
    transaction.description = transaction.description + ' (Manual Completion)';
    transaction.metadata = { 
      ...transaction.metadata, 
      manualCompletion: true,
      approvedAt: new Date().toISOString()
    };
    
    await transaction.save();
  }

  async rejectPayoutRequest(transactionId: string): Promise<void> {
    const transaction = await this.transactionModel.findById(transactionId);
    
    if (!transaction || transaction.type !== TransactionType.DEBIT || transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Invalid or already processed payout request');
    }

    // Mark transaction as failed/rejected
    transaction.status = TransactionStatus.FAILED;
    transaction.description = `Withdrawal rejected: ${transaction.reference}`;
    transaction.metadata = { ...transaction.metadata, rejectedAt: new Date().toISOString() };
    await transaction.save();

    // Refund the wallet
    const wallet = await this.walletModel.findById(transaction.wallet);
    if (wallet) {
      wallet.balance += transaction.amount;
      await wallet.save();
    }
  }

  /**
   * Generates a PDF receipt for a transaction.
   */
  async generateReceipt(transactionId: string): Promise<Buffer> {
    const transaction = await this.transactionModel.findById(transactionId).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const PDFDocument = require('pdfkit');
    const https = require('https');

    // Fetch the Erranders logo
    const fetchImage = (url: string): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        https.get(url, (res: any) => {
          const data: Buffer[] = [];
          res.on('data', (chunk: Buffer) => data.push(chunk));
          res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
      });
    };

    let logoBuffer: Buffer | null = null;
    try {
      logoBuffer = await fetchImage('https://res.cloudinary.com/marquis/image/upload/v1784062203/logo-light_pyjwmn-removebg-preview_y3jvvg.png');
    } catch (e) {
      console.error('Failed to fetch logo for receipt', e);
    }
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const brandColor = '#FF5C1A';
        const darkGray = '#111827';
        const lightGray = '#6b7280';
        const borderGray = '#e5e7eb';
        const bgGray = '#f9fafb';

        // --- Header Section ---
        doc.rect(0, 0, 595, 140).fill(bgGray);
        
        // Logo
        if (logoBuffer) {
          doc.image(logoBuffer, 50, 45, { width: 140 });
        } else {
          doc.fillColor(brandColor).fontSize(28).font('Helvetica-Bold').text('Erranders', 50, 50);
        }

        // Receipt Title
        doc.fillColor(darkGray)
           .fontSize(32)
           .font('Helvetica-Bold')
           .text('RECEIPT', 0, 50, { align: 'right', width: 545 });

        // Receipt Date & Reference
        doc.fillColor(lightGray)
           .fontSize(10)
           .font('Helvetica')
           .text(`Date: ${new Date((transaction as any).createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 0, 90, { align: 'right', width: 545 })
           .text(`Reference: ${transaction.reference || transaction._id.toString()}`, 0, 105, { align: 'right', width: 545 });

        // --- Divider ---
        doc.moveTo(50, 140).lineTo(545, 140).lineWidth(2).strokeColor(brandColor).stroke();

        // --- Customer / User Info ---
        doc.moveDown(4);
        const userInfoY = 180;
        const walletOwner: any = transaction.wallet && (transaction.wallet as any).owner;
        const userName = walletOwner ? `${walletOwner.firstName} ${walletOwner.lastName}` : (transaction.metadata?.userName || 'Erranders User');
        const userEmail = walletOwner ? walletOwner.email : (transaction.metadata?.userEmail || '');

        doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('BILLED TO / USER:', 50, userInfoY);
        doc.fillColor(darkGray).fontSize(14).text(userName, 50, userInfoY + 15);
        if (userEmail) {
          doc.fillColor(lightGray).fontSize(10).font('Helvetica').text(userEmail, 50, userInfoY + 32);
        }

        // Company Info
        doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('FROM:', 350, userInfoY);
        doc.fillColor(darkGray).fontSize(14).text('Erranders Inc.', 350, userInfoY + 15);
        doc.fillColor(lightGray).fontSize(10).font('Helvetica').text('Logistics & Delivery Platform', 350, userInfoY + 32);
        doc.text('support@erranders.com', 350, userInfoY + 47);

        // --- Main Details Table ---
        const tableTop = 300;
        doc.rect(50, tableTop, 495, 30).fill(brandColor);
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
        doc.text('DESCRIPTION', 70, tableTop + 10);
        doc.text('TYPE', 350, tableTop + 10);
        doc.text('STATUS', 450, tableTop + 10);

        doc.rect(50, tableTop + 30, 495, 50).fill('#FFFFFF').strokeColor(borderGray).lineWidth(1).stroke();
        doc.fillColor(darkGray).fontSize(10).font('Helvetica');
        
        doc.text(transaction.description || 'Wallet Transaction', 70, tableTop + 45, { width: 270 });
        doc.text(transaction.type.toUpperCase(), 350, tableTop + 45);
        doc.text(transaction.status.toUpperCase(), 450, tableTop + 45);

        // --- Amount Box ---
        const amountY = tableTop + 120;
        doc.rect(345, amountY, 200, 70).fill(bgGray).strokeColor(borderGray).lineWidth(1).stroke();
        doc.fillColor(lightGray).fontSize(10).font('Helvetica-Bold').text('TOTAL AMOUNT', 360, amountY + 15);
        
        const amountPrefix = transaction.type === 'debit' ? '-' : '+';
        const amountColor = transaction.type === 'debit' ? '#ef4444' : '#10b981'; // Red for debit, Green for credit
        doc.fillColor(amountColor).fontSize(20).text(`${amountPrefix} N${transaction.amount.toLocaleString()}`, 360, amountY + 35);

        // --- Footer ---
        doc.moveTo(50, 700).lineTo(545, 700).lineWidth(1).strokeColor(borderGray).stroke();
        doc.fillColor(lightGray).fontSize(10).font('Helvetica').text('Thank you for using Erranders!', 50, 720, { align: 'center', width: 495 });
        doc.text('This is an electronically generated receipt and does not require a signature.', 50, 735, { align: 'center', width: 495 });
           
        doc.end();
      } catch (err) {
        reject(err);
      }
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

  async getAllTransactions(page: number = 1, limit: number = 50): Promise<{ transactions: any[], total: number, page: number, limit: number }> {
    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find()
        .populate({
          path: 'wallet',
          populate: { path: 'owner', select: 'firstName lastName email' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.transactionModel.countDocuments()
    ]);

    return { transactions, total, page, limit };
  }

  async getGlobalStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const [totalVolume, totalCommissions, highestSpender, todaysVol, yesterdaysVol] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      this.transactionModel.aggregate([
        { $match: { description: { $regex: /order/i } } }, // Simplifying commission logic for now
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.DEBIT } },
        { $group: { _id: '$wallet', totalSpent: { $sum: '$amount' } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'wallets',
            localField: '_id',
            foreignField: '_id',
            as: 'wallet'
          }
        },
        { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'wallet.owner',
            foreignField: '_id',
            as: 'owner'
          }
        },
        { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, totalSpent: 1, owner: { firstName: 1, lastName: 1, email: 1, avatar: 1 } } }
      ]),
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT, createdAt: { $gte: startOfYesterday, $lt: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    return {
      totalVolume: totalVolume[0]?.total || 0,
      totalCommissions: Math.round((totalVolume[0]?.total || 0) * 0.05), // Calculated 5% platform share
      highestPurchaseUser: highestSpender[0] || null,
      todaysRevenue: todaysVol[0]?.total || 0,
      yesterdaysRevenue: yesterdaysVol[0]?.total || 0,
    };
  }
}
