import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ── Auth-based: create product for the logged-in vendor ──
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (auto-resolve vendor from token)' })
  createForOwner(@CurrentUser() user: User, @Body() body: any) {
    return this.productsService.createForOwner((user._id as unknown) as string, body);
  }

  // ── Auth-based: get my products ──
  @Get('vendor/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products for the logged-in vendor' })
  getMyProducts(@CurrentUser() user: User) {
    return this.productsService.findByOwner((user._id as unknown) as string);
  }

  // ── Category routes (must be before :id param routes) ──
  @Post('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product category for my store' })
  createCategory(@CurrentUser() user: User, @Body() body: { name: string; description?: string; image?: string }) {
    return this.productsService.createCategoryForOwner((user._id as unknown) as string, body);
  }

  @Get('categories/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my product categories' })
  getMyCategories(@CurrentUser() user: User) {
    return this.productsService.getCategoriesByOwner((user._id as unknown) as string);
  }

  @Get('categories/vendor/:vendorId')
  @ApiOperation({ summary: 'Get product categories by vendor ID' })
  getCategoriesByVendor(@Param('vendorId') vendorId: string) {
    return this.productsService.getCategoriesByVendor(vendorId);
  }

  @Put('categories/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product category' })
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.productsService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product category' })
  deleteCategory(@Param('id') id: string) {
    return this.productsService.deleteCategory(id);
  }

  // ── Public routes ──
  @Get('search')
  @ApiOperation({ summary: 'Search products' })
  search(@Query('q') query: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.productsService.search(query, page, limit);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular products' })
  getPopular(@Query('limit') limit?: number) {
    return this.productsService.getPopular(limit);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get products by category' })
  getByCategory(@Param('category') category: string) {
    return this.productsService.getByCategory(category);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get products by vendor ID' })
  findByVendor(@Param('vendorId') vendorId: string) {
    return this.productsService.findByVendor(vendorId);
  }

  // ── Legacy vendorId-based create ──
  @Post(':vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product for a specific vendor' })
  create(@Param('vendorId') vendorId: string, @Body() body: any) {
    return this.productsService.create(vendorId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.productsService.update(id, body);
  }

  @Put(':id/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product availability' })
  toggleAvailability(@Param('id') id: string) {
    return this.productsService.toggleAvailability(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product' })
  delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
