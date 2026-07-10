import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MenuItemService } from './menu-item.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';

@ApiTags('Menu – Items')
@Controller('menu/items')
export class MenuItemController {
  constructor(private readonly service: MenuItemService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu item (food vendors only)' })
  create(@CurrentUser() user: User, @Body() dto: CreateMenuItemDto) {
    return this.service.create((user._id as unknown) as string, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my menu items (fully populated)' })
  async getMine(@CurrentUser() user: User) {
    try {
      return await this.service.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get menu items by vendor ID' })
  getByVendor(
    @Param('vendorId') vendorId: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    return this.service.findByVendor(vendorId, { category, tag });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get menu item by ID (fully populated)' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post(':id/notify-restock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request to be notified when item is restocked' })
  notifyRestock(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.notifyRestock(id, (user._id as unknown) as string);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu item' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateMenuItemDto>,
  ) {
    return this.service.update(id, (user._id as unknown) as string, dto);
  }

  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle menu item publish status' })
  togglePublish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.togglePublish(id, (user._id as unknown) as string);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a menu item' })
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.delete(id, (user._id as unknown) as string);
  }
}
