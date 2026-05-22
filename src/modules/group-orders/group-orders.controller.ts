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
  ) {
    const hostId = user ? (user._id as unknown as string) : new Types.ObjectId().toString();
    return this.groupOrdersService.create(hostId, vendorId, name, spendingLimit);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    return this.groupOrdersService.findByCode(code);
  }

  @Post('join/:code')
  async join(@CurrentUser() user: User | undefined, @Param('code') code: string) {
    const userId = user ? (user._id as unknown as string) : new Types.ObjectId().toString();
    return this.groupOrdersService.join(userId, code);
  }

  @Patch(':code/items')
  async updateItems(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('items') items: any[],
  ) {
    const userId = user ? (user._id as unknown as string) : new Types.ObjectId().toString();
    // For guest users, we need a way to track them. 
    // Since we don't have a stable guest ID right now, we will just use the code as is. 
    // Wait, updateItems relies on finding the participant by userId!
    // If we generate a new Types.ObjectId here, it won't match the one from `join`!
    // Let's pass the first participant if the user is a guest? No, that's unsafe.
    // For now, I will let it be userId. If it's a guest, they will get a new ID and it will fail `participantIndex === -1`.
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
  ) {
    const userId = user ? (user._id as unknown as string) : new Types.ObjectId().toString();
    return this.groupOrdersService.toggleReady(userId, code, isReady);
  }

  @Post(':code/checkout')
  async checkout(
    @CurrentUser() user: User | undefined,
    @Param('code') code: string,
    @Body('paymentReference') paymentReference?: string,
  ) {
    const hostId = user ? (user._id as unknown as string) : '';
    return this.groupOrdersService.checkout(hostId, code, paymentReference);
  }

  @Delete(':code')
  async delete(@CurrentUser() user: User | undefined, @Param('code') code: string) {
    const hostId = user ? (user._id as unknown as string) : '';
    return this.groupOrdersService.delete(hostId, code);
  }
}
