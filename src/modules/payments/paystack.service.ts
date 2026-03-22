import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
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
        params: {
          country: 'nigeria',
          perPage: 100,
        },
      });
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
        params: {
          account_number,
          bank_code,
        },
      });
      return (response.data as any)?.data || {};
    } catch (error: any) {
      this.logger.error('Paystack Resolve Account Error:', error.response?.data || error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Account resolution failed',
      );
    }
  }
}
