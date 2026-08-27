import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument, PayoutPreference } from './schemas/wallet.schema';
import { Transaction, TransactionDocument, TransactionType, TransactionStatus } from './schemas/transaction.schema';
import { PaystackService } from '../payments/paystack.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { Order } from '../orders/schemas/order.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Order.name) private orderModel: Model<any>,
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
      // Check for cooldown to avoid spamming the paystack api if it fails
      const lastErrorAt = wallet.metadata?.virtualAccountLastErrorAt;
      const cooldownHours = 24;
      const shouldAttempt = !lastErrorAt || (new Date().getTime() - new Date(lastErrorAt).getTime()) > cooldownHours * 60 * 60 * 1000;
      
      if (shouldAttempt) {
        // Async fire-and-forget to avoid blocking the initial wallet load
        this.generateVirtualAccount(wallet).catch(err => {
          console.error('Failed to generate virtual account for wallet:', err.message);
        });
      }
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
      wallet.metadata = wallet.metadata || {};
      wallet.metadata.virtualAccountLastErrorAt = new Date().toISOString();
      await wallet.save();
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
    actionType: string = 'automatic',
    actionBy?: string,
    proofOfTransaction?: string,
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
    
    // Sync with User model for profile retrieval
    await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } });

    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.CREDIT,
      description,
      order: orderId,
      reference,
      status: TransactionStatus.COMPLETED,
      actionType,
      actionBy,
      proofOfTransaction
    });

    // Send Top-up Email if this is a top-up
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('top-up') || lowerDesc.includes('funded') || lowerDesc.includes('virtual account transfer') || lowerDesc.includes('deposit')) {
      try {
        const user = await this.userModel.findById(userId);
        if (user && user.email) {
          await this.emailService.sendWalletFundingSuccess(user.email, amount, description);
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
    actionType: string = 'automatic',
    actionBy?: string,
    proofOfTransaction?: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    wallet.balance -= amount;
    await wallet.save();

    // Sync with User model for profile retrieval
    await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: -amount } });

    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.DEBIT,
      description,
      actionType,
      actionBy,
      proofOfTransaction
    });

    if (actionType === 'manual') {
      try {
        const user = await this.userModel.findById(userId);
        if (user && user.email) {
          await this.emailService.sendManualPayoutReceipt(user.email, amount, description, proofOfTransaction);
        }
      } catch (e) {
        console.error(`Failed to send manual payout receipt to user ${userId}:`, e);
      }
    }
  }

  async forceDebitWallet(
    userId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    
    wallet.balance -= amount;
    await wallet.save();

    await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: -amount } });

    await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.DEBIT,
      description,
      actionType: 'automatic',
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
    await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: -amount } });

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
      if (userEmail) {
        await this.emailService.sendWithdrawalRequested(userEmail, amount, reference);
      }
      await this.approvePayoutRequest(transaction._id.toString());
    } catch (error: any) {
      // Rollback if instant payout fails
      wallet.balance += amount;
      await wallet.save();
      await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } });
      transaction.status = TransactionStatus.FAILED;
      transaction.description = `Instant withdrawal failed: ${error.message}`;
      await transaction.save();

      if (userEmail) {
        await this.emailService.sendPayoutFailed(userEmail, amount, error.message || 'Processing failed');
      }

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
    const transaction = await this.transactionModel.findById(transactionId).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });
    
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

    // Aggressively ensure payout sends an email
    const owner = (transaction.wallet as any)?.owner;
    if (owner && owner.email) {
      await this.emailService.sendPayoutSuccessful(owner.email, transaction.amount, transaction.reference || transactionId);
    }
  }

  async rejectPayoutRequest(transactionId: string): Promise<void> {
    const transaction = await this.transactionModel.findById(transactionId).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });
    
    if (!transaction || transaction.type !== TransactionType.DEBIT || transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Invalid or already processed payout request');
    }

    // Mark transaction as failed/rejected
    transaction.status = TransactionStatus.FAILED;
    transaction.description = `Withdrawal rejected: ${transaction.reference}`;
    transaction.metadata = { ...transaction.metadata, rejectedAt: new Date().toISOString() };
    await transaction.save();

    // Refund the wallet
    const wallet = await this.walletModel.findById((transaction.wallet as any)._id || transaction.wallet);
    if (wallet) {
      wallet.balance += transaction.amount;
      await wallet.save();
    }

    const owner = (transaction.wallet as any)?.owner;
    if (owner && owner.email) {
      await this.emailService.sendPayoutFailed(owner.email, transaction.amount, 'Rejected by Administration');
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
    }).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });
    
    if (transaction) {
      transaction.status = status;
      await transaction.save();

      if (status === TransactionStatus.COMPLETED) {
        const owner = (transaction.wallet as any)?.owner;
        if (owner && owner.email) {
          await this.emailService.sendPayoutSuccessful(owner.email, transaction.amount, transaction.reference || reference);
        }
      }
    }
  }

  /**
   * Called by the webhook when a payout fails.
   * Refunds the wallet balance and marks the transaction as FAILED.
   */
  async handleFailedPayout(reference: string): Promise<void> {
    const transaction = await this.transactionModel.findOne({
      'metadata.paystackReference': reference,
    }).populate({
      path: 'wallet',
      populate: { path: 'owner' }
    });
    if (!transaction) return;

    // Mark transaction as failed
    transaction.status = TransactionStatus.FAILED;
    transaction.description += ' (FAILED — refunded)';
    await transaction.save();

    // Refund the wallet
    const wallet = await this.walletModel.findById((transaction.wallet as any)._id || transaction.wallet);
    if (wallet) {
      wallet.balance += transaction.amount;
      await wallet.save();
    }

    const owner = (transaction.wallet as any)?.owner;
    if (owner && owner.email) {
      await this.emailService.sendPayoutFailed(owner.email, transaction.amount, 'Transfer failed at provider');
    }
  }

  async getAllTransactions(
    page: number = 1,
    limit: number = 50,
    startDate?: string,
    endDate?: string,
    status?: string,
    search?: string,
    sortBy?: string,
    sortOrder?: string,
    exportAsCsv?: boolean,
    type?: string,
    category?: string,
    userRole?: string,
    userId?: string
  ): Promise<{ transactions: any[], total: number, page: number, limit: number } | string> {
    const query: any = {};

    if (userId) {
      const wallet = await this.walletModel.findOne({ owner: userId }).select('_id');
      if (wallet) {
        query.wallet = wallet._id;
      } else {
        // If user has no wallet, return empty result
        query.wallet = null;
      }
    } else if (userRole && userRole !== 'all') {
      const users = await this.userModel.find({ role: userRole }).select('_id');
      const userIds = users.map(u => u._id);
      const wallets = await this.walletModel.find({ owner: { $in: userIds } }).select('_id');
      const walletIds = wallets.map(w => w._id);
      query.wallet = { $in: walletIds };
    }

    if (type) {
      query.type = type;
    }

    if (category === 'payout_requests') {
      query.type = 'debit';
      query['metadata.isPayoutRequest'] = true;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    let sort: any = { createdAt: -1 };
    if (sortBy) {
      // mapping frontend sortKeys to DB fields
      let dbSortKey = sortBy;
      if (sortBy === 'amount') dbSortKey = 'amount';
      else if (sortBy === 'date') dbSortKey = 'createdAt';
      else if (sortBy === 'type') dbSortKey = 'type';
      else if (sortBy === 'status') dbSortKey = 'status';
      
      sort = {};
      sort[dbSortKey] = sortOrder === 'asc' ? 1 : -1;
    }

    if (exportAsCsv) {
      const transactions = await this.transactionModel
        .find(query)
        .populate({
          path: 'wallet',
          populate: { path: 'owner', select: 'firstName lastName email role' }
        })
        .sort(sort);

      const header = ['ID', 'Date', 'Amount', 'Type', 'Status', 'Description', 'Reference', 'User Name', 'User Email'].join(',');
      const rows = transactions.map(t => {
        const owner = (t.wallet as any)?.owner;
        return [
          t._id.toString(),
          (t as any).createdAt ? (t as any).createdAt.toISOString() : '',
          t.amount,
          t.type,
          t.status,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.reference || '',
          owner ? `"${owner.firstName} ${owner.lastName}"` : '',
          owner ? owner.email : ''
        ].join(',');
      });

      return [header, ...rows].join('\n');
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(query)
        .populate({
          path: 'wallet',
          populate: { path: 'owner', select: 'firstName lastName email role' }
        })
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.transactionModel.countDocuments(query)
    ]);

    return { transactions, total, page, limit };
  }

  async getGlobalStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const [walletAccruals, transactionStats, highestSpender, todaysVol, yesterdaysVol, orderStats, highestPoints, topVendor, topErrander] = await Promise.all([
      // 1. Wallet Accruals by Role (Total Earned / Balances)
      this.walletModel.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerDoc'
          }
        },
        { $unwind: { path: '$ownerDoc', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$ownerDoc.role',
            totalAccrued: { $sum: '$totalEarned' },
            currentBalance: { $sum: '$balance' }
          }
        }
      ]),
      
      // 2. Transaction Stats by Role and Type (Funding, Usage, Payouts)
      this.transactionModel.aggregate([
        { $match: { status: TransactionStatus.COMPLETED } },
        {
          $lookup: {
            from: 'wallets',
            localField: 'wallet',
            foreignField: '_id',
            as: 'walletDoc'
          }
        },
        { $unwind: { path: '$walletDoc', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'users',
            localField: 'walletDoc.owner',
            foreignField: '_id',
            as: 'ownerDoc'
          }
        },
        { $unwind: { path: '$ownerDoc', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { role: '$ownerDoc.role', type: '$type' },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      
      // 3. Highest Spender
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.DEBIT, status: TransactionStatus.COMPLETED } },
        { $group: { _id: '$wallet', totalSpent: { $sum: '$amount' } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 1 },
        {
          $lookup: { from: 'wallets', localField: '_id', foreignField: '_id', as: 'wallet' }
        },
        { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
        {
          $lookup: { from: 'users', localField: 'wallet.owner', foreignField: '_id', as: 'owner' }
        },
        { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, totalSpent: 1, owner: { firstName: 1, lastName: 1, email: 1, avatar: 1 } } }
      ]),
      
      // 4. Today's Volume (Total successful credits)
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT, status: TransactionStatus.COMPLETED, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 5. Yesterday's Volume
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.CREDIT, status: TransactionStatus.COMPLETED, createdAt: { $gte: startOfYesterday, $lt: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      // 6. Platform Share directly from Orders
      this.orderModel.aggregate([
        { $match: { status: 'delivered' } }, // Only count completed orders
        {
          $group: {
            _id: '$type', // 'marketplace' or 'custom_errand'
            totalPlatformShare: { $sum: '$platformShare' }
          }
        }
      ]),
      
      // 7. Highest Points Student
      this.userModel.find({ role: 'student' }).sort({ points: -1 }).limit(1).select('firstName lastName email avatar points totalOrders').lean(),

      // 8. Top Vendor (by total earned)
      this.walletModel.aggregate([
        { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner' } },
        { $unwind: '$owner' },
        { $match: { 'owner.role': 'vendor' } },
        { $sort: { totalEarned: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, totalEarned: 1, owner: { firstName: 1, lastName: 1, email: 1, avatar: 1 } } }
      ]),

      // 9. Top Errander (by total earned)
      this.walletModel.aggregate([
        { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner' } },
        { $unwind: '$owner' },
        { $match: { 'owner.role': { $in: ['errander', 'dispatcher'] } } },
        { $sort: { totalEarned: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, totalEarned: 1, owner: { firstName: 1, lastName: 1, email: 1, avatar: 1 } } }
      ])
    ]);

    // Parse the results
    let vendorAccrued = 0;
    let dispatcherAccrued = 0;
    
    walletAccruals.forEach(stat => {
      if (stat._id === 'vendor') vendorAccrued = stat.totalAccrued;
      if (stat._id === 'errander' || stat._id === 'dispatcher') dispatcherAccrued = stat.totalAccrued;
    });

    let studentFunding = 0;
    let studentUsage = 0;
    let totalPaidOut = 0; // Withdrawals by vendors/dispatchers
    let vendorPaidOut = 0;
    let dispatcherPaidOut = 0;

    transactionStats.forEach(stat => {
      const role = stat._id.role;
      const type = stat._id.type;
      
      if (role === 'user' || role === 'student') {
        if (type === TransactionType.CREDIT) studentFunding += stat.totalAmount;
        if (type === TransactionType.DEBIT) studentUsage += stat.totalAmount;
      }
      
      if (role === 'vendor' && type === TransactionType.DEBIT) {
        vendorPaidOut += stat.totalAmount;
        totalPaidOut += stat.totalAmount;
      }
      
      if ((role === 'errander' || role === 'dispatcher') && type === TransactionType.DEBIT) {
        dispatcherPaidOut += stat.totalAmount;
        totalPaidOut += stat.totalAmount;
      }
    });

    // Total Volume = Total Funding
    const totalVolume = studentFunding;
    
    // Platform Revenue = From Orders
    let platformMarketplace = 0;
    let platformCustomErrands = 0;
    
    orderStats.forEach((stat: any) => {
      if (stat._id === 'marketplace' || stat._id === 'regular') platformMarketplace = stat.totalPlatformShare || 0;
      if (stat._id === 'custom_errand') platformCustomErrands = stat.totalPlatformShare || 0;
    });

    const totalCommissions = platformMarketplace + platformCustomErrands;

    return {
      totalVolume,
      totalCommissions,
      platformMarketplace,
      platformCustomErrands,
      vendorAccrued,
      dispatcherAccrued,
      totalPaidOut,
      vendorPaidOut,
      dispatcherPaidOut,
      studentFunding,
      studentUsage,
      highestPurchaseUser: highestSpender[0] || null,
      highestPointsUser: highestPoints[0] || null,
      topVendor: topVendor[0] || null,
      topErrander: topErrander[0] || null,
      todaysRevenue: todaysVol[0]?.total || 0,
      yesterdaysRevenue: yesterdaysVol[0]?.total || 0,
    };
  }

  async fundWalletByAdmin(userId: string, amount: number, description?: string): Promise<{ wallet: WalletDocument, transaction: TransactionDocument }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Make sure wallet exists
    const wallet = await this.getOrCreateWallet(userId);

    // Create a new transaction for the credit
    const transaction = await this.transactionModel.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.CREDIT,
      status: TransactionStatus.COMPLETED,
      description: description || 'Funded by Admin',
      reference: `admin_fund_${uuidv4()}`,
    });

    // Update wallet balance safely
    const updatedWallet = await this.walletModel.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: amount, totalEarned: amount } },
      { new: true }
    );

    // Send email notification to user
    if (user.email) {
      await this.emailService.sendWalletFundingSuccess(
        user.email,
        amount,
        description || 'Funded by Admin'
      );
    }

    return { wallet: updatedWallet as WalletDocument, transaction };
  }
}
