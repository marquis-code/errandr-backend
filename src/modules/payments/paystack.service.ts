import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'https';


@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly httpsAgent: https.Agent;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
    if (!this.secretKey) {
      this.logger.error('PAYSTACK_SECRET_KEY is not defined in environment variables');
    }
    
    this.httpsAgent = new https.Agent({
      minVersion: 'TLSv1.2',
      keepAlive: true,
    });
  }


  /**
   * Get list of all Nigerian banks
   * GET https://api.paystack.co/bank
   */
  async getBanks() {
    try {
      const response = await axios.get(`${this.baseUrl}/bank`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        httpsAgent: this.httpsAgent,
        params: {
          country: 'nigeria',
          perPage: 100,
        },
      } as any);

      return (response.data as any)?.data || [];
    } catch (error: any) {
      this.logger.error('Paystack Get Banks Error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Resolve bank account — verify account name
   * GET https://api.paystack.co/bank/resolve?account_number=XXXX&bank_code=XXX
   */
  async resolveAccount(account_number: string, bank_code: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/bank/resolve`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        httpsAgent: this.httpsAgent,
        params: {
          account_number,
          bank_code,
        },
      } as any);

      return (response.data as any)?.data || {};
    } catch (error: any) {
      this.logger.error('Paystack Resolve Account Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Account resolution failed',
      );
    }
  }

  /**
   * Initialize a transaction (Redirect Checkout)
   * POST https://api.paystack.co/transaction/initialize
   */
  async initializeTransaction(data: {
    amount: number;
    email: string;
    reference: string;
    callback_url?: string;
    metadata?: any;
  }) {
    let email = data.email;
    if (email) {
      // Paystack rejects non-standard TLDs like .test in sandbox/test mode
      if (email.endsWith('.test')) {
        email = email.replace(/\.test$/, '.org');
      } else if (email.endsWith('.local')) {
        email = email.replace(/\.local$/, '.com');
      }
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          ...data,
          email,
          amount: Math.round(data.amount * 100), // Paystack expects amount in kobo
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        } as any,

      );
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      this.logger.error(`Paystack Initialize Error: ${errorMessage}`, {
        payload: { ...data, email, amount: Math.round(data.amount * 100) },
        response: error.response?.data
      });
      throw new InternalServerErrorException(
        errorMessage || 'Paystack initialization failed',
      );
    }
  }

  /**
   * Verify a transaction by reference
   * GET https://api.paystack.co/transaction/verify/:reference
   */
  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          httpsAgent: this.httpsAgent,
        } as any,

      );
      const data = (response.data as any).data;
      return {
        status: data.status === 'success' ? 'success' : 'failed',
        amount: data.amount / 100, // Return in Naira
        data,
      };
    } catch (error: any) {
      this.logger.error('Paystack Verify Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Paystack verification failed',
      );
    }
  }

  /**
   * Create a transfer recipient
   * POST https://api.paystack.co/transferrecipient
   */
  async createTransferRecipient(data: {
    name: string;
    account_number: string;
    bank_code: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: data.name,
          account_number: data.account_number,
          bank_code: data.bank_code,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        } as any,


      );
      return (response.data as any).data;
    } catch (error: any) {
      this.logger.error('Paystack Create Recipient Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to create transfer recipient',
      );
    }
  }

  /**
   * Initiate a transfer
   * POST https://api.paystack.co/transfer
   */
  async initiateTransfer(data: {
    amount: number;
    reference: string;
    recipient: string;
    reason?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          amount: Math.round(data.amount * 100), // kobo
          reference: data.reference,
          recipient: data.recipient,
          reason: data.reason,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        } as any,


      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Paystack Transfer Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Paystack transfer failed',
      );
    }
  }

  /**
   * Create a Paystack customer
   * POST https://api.paystack.co/customer
   */
  async createCustomer(data: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  }) {
    let email = data.email;
    // Paystack rejects non-standard TLDs like .test in sandbox/test mode
    if (email.endsWith('.test')) {
      email = email.replace(/\.test$/, '.org');
    } else if (email.endsWith('.local')) {
      email = email.replace(/\.local$/, '.com');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/customer`,
        {
          ...data,
          email,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        } as any,
      );
      return (response.data as any).data;
    } catch (error: any) {
      this.logger.error('Paystack Create Customer Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to create Paystack customer',
      );
    }
  }

  /**
   * Create a Dedicated Virtual Account
   * POST https://api.paystack.co/dedicated_account
   */
  async createDedicatedAccount(data: {
    customer: string;
    preferred_bank?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/dedicated_account`,
        {
          customer: data.customer,
          preferred_bank: data.preferred_bank || 'wema-bank',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: this.httpsAgent,
        } as any,
      );
      return (response.data as any).data;
    } catch (error: any) {
      this.logger.error('Paystack Create Dedicated Account Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to create dedicated virtual account',
      );
    }
  }
}
