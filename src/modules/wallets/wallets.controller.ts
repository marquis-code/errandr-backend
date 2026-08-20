import { Controller, Get, Post, Put, Body, UseGuards, Param, Res, StreamableFile, Query } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

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

  @Post('subscribe-prime')
  @ApiOperation({ summary: 'Subscribe to Campus Prime via Wallet Deduction' })
  async subscribePrime(@CurrentUser() user: User) {
    await this.walletsService.subscribeToPrime((user._id as unknown) as string);
    return { success: true, message: 'Campus Prime subscription successful.' };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update payout preferences and bank details' })
  updatePreferences(
    @CurrentUser() user: User,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.walletsService.updatePreferences((user._id as unknown) as string, body.preference, body.bankDetails, body.metadata, body.bankAccounts);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request a withdrawal via Paystack' })
  async requestWithdrawal(
    @CurrentUser() user: User,
    @Body() body: { amount: number; bankAccount?: { accountNumber: string, bankCode: string }; isInstant?: boolean },
  ) {
    await this.walletsService.withdrawFunds(
      (user._id as unknown) as string,
      body.amount,
      user.email,
      `${user.firstName} ${user.lastName}`,
      body.bankAccount,
      body.isInstant
    );
    return { success: true, message: 'Withdrawal initiated via Paystack' };
  }

  @Get('all')
  // @UseGuards(RolesGuard) // Assuming RolesGuard is correctly set up
  @ApiOperation({ summary: 'Get all transactions (admin)' })
  getAllTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.walletsService.getAllTransactions(Number(page), Number(limit));
  }

  @Get('global-stats')
  @ApiOperation({ summary: 'Get global wallet stats (admin)' })
  getGlobalStats() {
    return this.walletsService.getGlobalStats();
  }

  @Put('transactions/:id/approve')
  @ApiOperation({ summary: 'Approve a payout request (admin)' })
  async approvePayoutRequest(@Param('id') id: string) {
    await this.walletsService.approvePayoutRequest(id);
    return { success: true, message: 'Payout approved and processing via Paystack' };
  }

  @Put('transactions/:id/reject')
  @ApiOperation({ summary: 'Reject a payout request (admin)' })
  async rejectPayoutRequest(@Param('id') id: string) {
    await this.walletsService.rejectPayoutRequest(id);
    return { success: true, message: 'Payout rejected and refunded' };
  }

  @Put('transactions/:id/mark-paid')
  @ApiOperation({ summary: 'Mark a payout request as paid manually (admin)' })
  async markPayoutAsPaid(@Param('id') id: string) {
    await this.walletsService.markPayoutAsPaid(id);
    return { success: true, message: 'Payout marked as completed manually' };
  }

  @Get('transactions/:id/receipt')
  @ApiOperation({ summary: 'Download transaction receipt' })
  async downloadReceipt(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.walletsService.generateReceipt(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${id}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
