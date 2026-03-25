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
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@Controller('group-orders')
@UseGuards(JwtAuthGuard)
export class GroupOrdersController {
  constructor(private readonly groupOrdersService: GroupOrdersService) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body('vendorId') vendorId: string,
    @Body('name') name?: string,
    @Body('spendingLimit') spendingLimit?: number,
  ) {
    return this.groupOrdersService.create((user._id as unknown) as string, vendorId, name, spendingLimit);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    return this.groupOrdersService.findByCode(code);
  }

  @Post('join/:code')
  async join(@CurrentUser() user: User, @Param('code') code: string) {
    return this.groupOrdersService.join((user._id as unknown) as string, code);
  }

  @Patch(':code/items')
  async updateItems(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body('items') items: any[],
  ) {
    return this.groupOrdersService.updateItems((user._id as unknown) as string, code, items);
  }

  @Patch(':code/status')
  async updateStatus(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body('status') status: string,
  ) {
    return this.groupOrdersService.updateStatus((user._id as unknown) as string, code, status);
  }

  @Patch(':code/toggle-ready')
  async toggleReady(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body('isReady') isReady: boolean,
  ) {
    return this.groupOrdersService.toggleReady((user._id as unknown) as string, code, isReady);
  }

  @Post(':code/checkout')
  async checkout(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body('paymentReference') paymentReference?: string,
  ) {
    return this.groupOrdersService.checkout((user._id as unknown) as string, code, paymentReference);
  }

  @Delete(':code')
  async delete(@CurrentUser() user: User, @Param('code') code: string) {
    return this.groupOrdersService.delete((user._id as unknown) as string, code);
  }
}
