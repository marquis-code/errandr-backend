import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AddOnService } from './add-on.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { CreateAddOnDto } from './dto/create-add-on.dto';

@ApiTags('Menu – Add-ons')
@Controller('menu/add-ons')
export class AddOnController {
  constructor(private readonly service: AddOnService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an add-on (food vendors only)' })
  create(@CurrentUser() user: User, @Body() dto: CreateAddOnDto) {
    return this.service.create((user._id as unknown) as string, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my add-ons' })
  async getMine(@CurrentUser() user: User) {
    try {
      return await this.service.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get add-on by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an add-on' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateAddOnDto>,
  ) {
    return this.service.update(id, (user._id as unknown) as string, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an add-on' })
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.delete(id, (user._id as unknown) as string);
  }
}
