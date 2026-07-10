import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MenuCategoryService } from './menu-category.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';

@ApiTags('Menu – Categories')
@Controller('menu/categories')
export class MenuCategoryController {
  constructor(private readonly service: MenuCategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu category (food vendors only)' })
  create(@CurrentUser() user: User, @Body() dto: CreateMenuCategoryDto) {
    return this.service.create((user._id as unknown) as string, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my menu categories' })
  async getMine(@CurrentUser() user: User) {
    try {
      return await this.service.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get menu categories by vendor ID' })
  getByVendor(@Param('vendorId') vendorId: string) {
    return this.service.findByVendor(vendorId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu category' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateMenuCategoryDto>,
  ) {
    return this.service.update(id, (user._id as unknown) as string, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a menu category' })
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.delete(id, (user._id as unknown) as string);
  }
}
