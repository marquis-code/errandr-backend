import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class KorapayService {
  private readonly logger = new Logger(KorapayService.name);
  private readonly baseUrl = 'https://api.korapay.com/merchant/api/v1';
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('KORAPAY_SECRET_KEY')!;
    this.publicKey = this.configService.get<string>('KORAPAY_PUBLIC_KEY')!;
  }

  /**
   * Initialize a charge (Checkout Redirect)
   */
  async initializeCharge(data: {
    amount: number;
    reference: string;
    customer: { name: string; email: string };
    notification_url?: string;
    redirect_url?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/charges/initialize`,
        {
          ...data,
          currency: 'NGN',
          merchant_bears_cost: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Korapay Initialize Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(error.response?.data?.message || 'Korapay initialization failed');
    }
  }

  /**
   * Verify a charge by reference
   */
  async verifyCharge(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/charges/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );
      return response.data as any;
    } catch (error: any) {
      this.logger.error('Korapay Verify Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(error.response?.data?.message || 'Korapay verification failed');
    }
  }

  /**
   * Get supported banks in Nigeria
   */
  async getBanks() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/miscellaneous/banks?countryCode=NG`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );
      return (response.data as any).data;
    } catch (error: any) {
      this.logger.error('Korapay Get Banks Error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Resolve a bank account (Verify owner name)
   */
  async resolveAccount(account_number: string, bank_code: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/miscellaneous/banks/resolve`,
        { account_number, bank_code },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return (response.data as any).data;
    } catch (error: any) {
      this.logger.error('Korapay Resolve Account Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(error.response?.data?.message || 'Account resolution failed');
    }
  }

  /**
   * Initiate a single payout (Disbursement)
   */
  async initiatePayout(data: {
    amount: number;
    reference: string;
    bank_account: {
      bank_code: string;
      account_number: string;
    };
    customer: {
      name: string;
      email: string;
    };
    narration?: string;
  }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transactions/disburse`,
        {
          ...data,
          currency: 'NGN',
          destination: {
            type: 'bank_account',
            amount: data.amount,
            currency: 'NGN',
            bank_account: data.bank_account,
            customer: data.customer,
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data as any;
    } catch (error: any) {
      this.logger.error('Korapay Payout Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(error.response?.data?.message || 'Payout initiation failed');
    }
  }
}
