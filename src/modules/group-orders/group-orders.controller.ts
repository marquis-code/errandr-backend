import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { GroupOrdersService } from './group-orders.service';
import { OptionalJwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { Types } from 'mongoose';

@Controller('group-orders')
@UseGuards(OptionalJwtAuthGuard)
export class GroupOrdersController {
  constructor(private readonly groupOrdersService: GroupOrdersService) {}

  @Post()
  async create(
    @CurrentUser() user: User | undefined,
    @Body('vendorId') vendorId: string,
    @Body('name') name?: string,
    @Body('spendingLimit') spendingLimit?: number,
    @Body('guestId') guestId?: string,
  ) {
    const hostId = user ? (user._id as unknown as string) : (guestId || new Types.ObjectId().toString());
    return this.groupOrdersService.create(hostId, vendorId, name, spendingLimit);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: User | undefined,
    @Query('guestId') guestId?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : guestId;
    if (!userId) return []; // If unauthenticated and no guestId, return empty history
    return this.groupOrdersService.getUserHistory(userId);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    return this.groupOrdersService.findByCode(code);
  }

  @Post('join/:code')
  async joinGroupOrder(
    @Param('code') code: string,
    @CurrentUser() user: User | undefined,
    @Body('guestId') guestId?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : guestId;
    if (!userId) throw new BadRequestException('User ID is required');
    return this.groupOrdersService.join(userId, code);
  }

  @Post('leave/:code')
  async leaveGroupOrder(
    @Param('code') code: string,
    @CurrentUser() user: User | undefined,
    @Body('guestId') guestId?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : guestId;
    if (!userId) throw new BadRequestException('User ID is required');
    return this.groupOrdersService.leave(userId, code);
  }

  @Patch(':code/items')
  async updateItems(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('items') items: any[],
    @Body('guestId') guestId?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : (guestId || new Types.ObjectId().toString());
    return this.groupOrdersService.updateItems(userId, code, items);
  }

  @Patch(':code/status')
  async updateStatus(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('status') status: string,
  ) {
    const hostId = user ? (user._id as unknown as string) : '';
    return this.groupOrdersService.updateStatus(hostId, code, status);
  }

  @Patch(':code/toggle-ready')
  async toggleReady(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('isReady') isReady: boolean,
    @Body('guestId') guestId?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : (guestId || new Types.ObjectId().toString());
    return this.groupOrdersService.toggleReady(userId, code, isReady);
  }

  @Post(':code/checkout-initiate')
  async initiateCheckout(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('splitType') splitType: string,
    @Body('guestId') guestId?: string,
  ) {
    const hostId = user ? (user._id as unknown as string) : guestId;
    if (!hostId) throw new BadRequestException('Host ID is required');
    return this.groupOrdersService.initiateCheckout(hostId, code, splitType);
  }

  @Post(':code/checkout')
  async checkout(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('guestId') guestId?: string,
    @Body('paymentReference') paymentReference?: string,
  ) {
    const userId = user ? (user._id as unknown as string) : guestId;
    if (!userId) throw new BadRequestException('User ID is required');
    return this.groupOrdersService.checkout(userId, code, paymentReference, guestId);
  }

  @Delete(':code')
  async delete(@CurrentUser() user: User | undefined, @Param('code') code: string) {
    const hostId = user ? (user._id as unknown as string) : '';
    return this.groupOrdersService.delete(hostId, code);
  }
}
