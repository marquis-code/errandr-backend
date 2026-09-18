import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument, PayoutPreference } from './schemas/wallet.schema';
import { Transaction, TransactionDocument, TransactionType, TransactionStatus } from './schemas/transaction.schema';
import { PaystackService } from '../payments/paystack.service';
import { EmailService } from '../email/email.service';
import { User } from '../users/schemas/user.schema';
import { Order } from '../orders/schemas/order.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Vendor.name) private vendorModel: Model<any>,
    @InjectModel(SystemSetting.name) private systemSettingModel: Model<SystemSetting>,
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
      await this.vendorModel.updateOne({ owner: new Types.ObjectId(userId) }, { $set: { bankDetails } }, { runValidators: false });
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

    const setting = await this.systemSettingModel.findOne({ key: 'errander_minimum_payout' });
    let minPayout = setting?.value?.amount ? Number(setting.value.amount) : 1000; // default 1000
    let processingFee = 0;

    if (isInstant || wallet.payoutPreference === PayoutPreference.DAILY) {
      minPayout = Math.max(minPayout, 5000); // Higher threshold for daily/instant
      processingFee = 50; // Flat fee for daily/instant sweeps
    } else if (wallet.payoutPreference === PayoutPreference.MONTHLY) {
      minPayout = 100; // Lower threshold for monthly
    }

    if (amount < minPayout) {
      throw new Error(`Minimum payout amount for this settlement frequency is ₦${minPayout}`);
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance in wallet');
    }

    const transferAmount = amount - processingFee;
    if (transferAmount <= 0) {
      throw new Error('Withdrawal amount is too low to cover the processing fee');
    }

    const targetBankCode = selectedBankAccount?.bankCode || wallet.bankDetails?.bankCode;
    const targetAccountNumber = selectedBankAccount?.accountNumber || wallet.bankDetails?.accountNumber;

    if (!targetBankCode || !targetAccountNumber) {
      throw new Error('Payout preferences not set correctly');
    }

    // Generate a reference
    const reference = `WD-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Debit Wallet to lock full amount (transfer + fee)
    wallet.balance -= amount;
    await wallet.save();
    await this.userModel.findByIdAndUpdate(userId, { $inc: { walletBalance: -amount } });

    // Log the fee transaction if applicable
    if (processingFee > 0) {
      await this.transactionModel.create({
        wallet: wallet._id,
        amount: processingFee,
        type: TransactionType.DEBIT,
        status: TransactionStatus.COMPLETED,
        description: isInstant ? 'Instant withdrawal processing fee' : 'Daily settlement processing fee',
        reference: `FEE-${reference}`,
      });
    }

    // Log Transaction for the net payout (Queued for automated processing)
    const transaction = await this.transactionModel.create({
      wallet: wallet._id,
      amount: transferAmount,
      type: TransactionType.DEBIT,
      status: TransactionStatus.PENDING,
      description: isInstant ? `Instant withdrawal request: ${reference}` : `Withdrawal request: ${reference}`,
      reference,
      metadata: { 
        isPayoutRequest: true,
        isInstant: !!isInstant,
        userName,
        userEmail,
        bankCode: targetBankCode, 
        accountNumber: targetAccountNumber,
        feeDeducted: processingFee
      },
    });

    if (userEmail) {
      await this.emailService.sendWithdrawalRequested(userEmail, transferAmount, reference).catch(e => console.warn(`Failed to send withdrawal requested email: ${e.message}`));
    }

    if (isInstant) {
      try {
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
          await this.emailService.sendPayoutFailed(userEmail, amount, error.message || 'Processing failed').catch(e => console.warn(`Failed to send payout failed email: ${e.message}`));
        }

        throw error;
      }
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
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to fetch image, status code: ${res.statusCode}`));
          }
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
        const brandBlue = '#0D1B2A'; // A dark navy blue for text
        const lightGray = '#9CA3AF';
        const borderGray = '#E5E7EB';

        // --- Logo & Top Right Element ---
        if (logoBuffer && logoBuffer.length > 0) {
          doc.image(logoBuffer, 50, 40, { width: 140 });
        } else {
          doc.fillColor(brandColor).fontSize(28).font('Helvetica-Bold').text('Erranders', 50, 45);
        }

        // Top right decorative slash and text
        doc.moveTo(480, 40).lineTo(440, 90).lineWidth(4).strokeColor(brandColor).stroke();
        doc.fillColor(brandColor).fontSize(10).font('Helvetica-Bold').text('more than logistics', 460, 80, { width: 100 });

        // --- Title ---
        doc.fillColor(brandBlue)
           .fontSize(24)
           .font('Helvetica-Bold')
           .text('Transaction Receipt', 0, 130, { align: 'center', width: 595 });

        // --- Subtitle ---
        const generationDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
        doc.fillColor(lightGray)
           .fontSize(10)
           .font('Helvetica')
           .text(`Generated from Erranders on ${generationDate}`, 0, 160, { align: 'center', width: 595 });

        // --- Helper for Rows ---
        let currentY = 200;
        const leftX = 80;
        const rightX = 250;
        
        const drawRow = (label: string, value: string | string[], valueColor: string = brandBlue) => {
          doc.fillColor(brandColor).fontSize(11).font('Helvetica-Bold').text(label, leftX, currentY);
          
          doc.fillColor(valueColor).fontSize(11).font('Helvetica');
          if (Array.isArray(value)) {
            value.forEach((v, index) => {
              if (index === 0) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
              doc.text(v, rightX, currentY + (index * 15));
            });
            currentY += (value.length * 15) + 15;
          } else {
            doc.text(value, rightX, currentY, { width: 280 });
            currentY += doc.heightOfString(value, { width: 280 }) + 15;
          }
          
          doc.moveTo(leftX, currentY - 5).lineTo(515, currentY - 5).lineWidth(0.5).strokeColor(borderGray).stroke();
          currentY += 15;
        };

        // --- Data Extraction ---
        const txDate = new Date((transaction as any).createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');
        
        const walletOwner: any = transaction.wallet && (transaction.wallet as any).owner;
        const userName = walletOwner ? `${walletOwner.firstName} ${walletOwner.lastName}` : (transaction.metadata?.userName || 'Erranders User');
        
        const isDebit = transaction.type === 'debit';
        const sender = isDebit ? userName : 'Erranders Inc.';
        
        let beneficiary: string | string[] = isDebit ? 'Erranders Inc.' : userName;
        
        // If it's a payout to a bank, show bank details
        if (transaction.metadata?.isPayoutRequest) {
          beneficiary = [
            userName,
            transaction.metadata.accountNumber || '',
            transaction.metadata.bankCode ? `Bank Code: ${transaction.metadata.bankCode}` : ''
          ].filter(Boolean);
        }

        // --- Draw Rows ---
        drawRow('Transaction Amount', `N${transaction.amount.toLocaleString()}`);
        drawRow('Transaction Type', transaction.type.toUpperCase());
        drawRow('Transaction Date', txDate);
        drawRow('Sender', sender);
        drawRow('Beneficiary', beneficiary);
        drawRow('Remark', transaction.description || 'Wallet Transaction');
        drawRow('Transaction Reference', transaction.reference || transaction._id.toString());
        drawRow('Transaction Status', transaction.status.toUpperCase(), transaction.status === TransactionStatus.COMPLETED ? brandBlue : '#ef4444');

        // --- Footer ---
        currentY += 20;
        doc.fillColor(lightGray).fontSize(9).font('Helvetica')
           .text('If you have any questions or would like more information, please call our 24-hour Contact Centre on ', leftX, currentY, { continued: true })
           .fillColor(brandBlue).text('0700 000 0000', { continued: true })
           .fillColor(lightGray).text(' or send an email to ')
           .fillColor(brandBlue).text('support@erranders.com', { underline: true });
           
        doc.fillColor(lightGray).text('Thank you for choosing Erranders.', leftX, currentY + 30);
        
        doc.fillColor(borderGray).text('Logistics | Delivery | Escrow | Food', leftX, currentY + 60);

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
