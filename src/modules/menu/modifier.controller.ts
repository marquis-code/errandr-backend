import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ModifierService } from './modifier.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { CreateModifierDto } from './dto/create-modifier.dto';

@ApiTags('Menu – Modifiers')
@Controller('menu/modifiers')
export class ModifierController {
  constructor(private readonly service: ModifierService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a modifier (food vendors only)' })
  create(@CurrentUser() user: User, @Body() dto: CreateModifierDto) {
    return this.service.create((user._id as unknown) as string, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my modifiers' })
  async getMine(@CurrentUser() user: User) {
    try {
      return await this.service.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get modifier by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a modifier' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<CreateModifierDto>,
  ) {
    return this.service.update(id, (user._id as unknown) as string, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a modifier' })
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.delete(id, (user._id as unknown) as string);
  }
}
