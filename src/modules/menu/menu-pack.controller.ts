import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MenuPackService } from './menu-pack.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { CreateMenuPackDto } from './dto/create-menu-pack.dto';

@ApiTags('Menu – Packs')
@Controller('menu/packs')
export class MenuPackController {
  constructor(private readonly service: MenuPackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a pack (food vendors only)' })
  create(@CurrentUser() user: User, @Body() dto: CreateMenuPackDto) {
    return this.service.create((user._id as unknown) as string, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my packs' })
  async getMine(@CurrentUser() user: User) {
    try {
      return await this.service.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  @Get('promos')
  @ApiOperation({ summary: 'Get all prepaid platform combos (promos)' })
  getPromos() {
    return this.service.getPromos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pack by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get packs by vendor ID' })
  findByVendor(@Param('vendorId') vendorId: string) {
    return this.service.findByVendor(vendorId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a pack' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateMenuPackDto>,
  ) {
    return this.service.update(id, (user._id as unknown) as string, dto);
  }

  @Patch('admin/update/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin update a pack (e.g. prepaid combos, stock limit)' })
  adminUpdate(
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.service.adminUpdate(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a pack' })
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.delete(id, (user._id as unknown) as string);
  }
}
