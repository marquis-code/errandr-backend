import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { PayoutPreference } from './schemas/wallet.schema';

@ApiTags('Wallets')
@Controller('wallets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Get my wallet balance and details' })
  getWallet(@CurrentUser() user: User) {
    return this.walletsService.getOrCreateWallet((user._id as unknown) as string);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get my transaction history' })
  getTransactions(@CurrentUser() user: User) {
    return this.walletsService.getTransactions((user._id as unknown) as string);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update payout preferences and bank details' })
  updatePreferences(
    @CurrentUser() user: User,
    @Body() body: { preference: PayoutPreference; bankDetails?: any; bankAccounts?: any[]; metadata?: any },
  ) {
    return this.walletsService.updatePreferences((user._id as unknown) as string, body.preference, body.bankDetails, body.metadata, body.bankAccounts);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request a withdrawal via Paystack' })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body() body: { amount: number; bankAccount?: { accountNumber: string, bankCode: string } },
  ) {
    await this.walletsService.withdrawFunds(
      (user._id as unknown) as string,
      body.amount,
      user.email,
      `${user.firstName} ${user.lastName}`,
      body.bankAccount
    );
    return { success: true, message: 'Withdrawal initiated via Paystack' };
  }

  @Get('all')
  // @UseGuards(RolesGuard) // Assuming RolesGuard is correctly set up
  @ApiOperation({ summary: 'Get all transactions (admin)' })
  getAllTransactions() {
    return this.walletsService.getAllTransactions();
  }

  @Get('global-stats')
  @ApiOperation({ summary: 'Get global wallet stats (admin)' })
  getGlobalStats() {
    return this.walletsService.getGlobalStats();
  }
}
