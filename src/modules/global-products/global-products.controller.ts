import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GlobalProductsService } from './global-products.service';
import { JwtAuthGuard } from '../../common/decorators';

@ApiTags('Global Products')
@Controller('global-products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GlobalProductsController {
  constructor(private readonly service: GlobalProductsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search the global product catalog' })
  search(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.search(query, categoryId);
  }

  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get global products by category' })
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.service.findByCategory(categoryId);
  }
}
