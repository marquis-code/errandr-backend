import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req,
  UseGuards, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard, CurrentUser, OptionalJwtAuthGuard } from '../../common/decorators';
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

  @Post('bulk-from-catalog')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple products from the global catalog' })
  createBulkFromCatalog(@CurrentUser() user: User, @Body() body: { items: { globalProductId: string, price: number, stockQuantity?: number }[] }) {
    return this.productsService.createBulkFromCatalog((user._id as unknown) as string, body.items);
  }

  // ── Public Index (Handles /products?q=... or /products) ──
  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get products (index / search)' })
  index(
    @Query('q') query?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Req() req?: any,
  ) {
    if (query) {
      return this.productsService.search(query, page, limit, req);
    }
    return this.productsService.getPopular(limit, req);
  }


  // ── Auth-based: get my products ──
  @Get('vendor/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products for the logged-in vendor' })
  async getMyProducts(@CurrentUser() user: User) {
    try {
      return await this.productsService.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
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
  async getMyCategories(@CurrentUser() user: User) {
    try {
      return await this.productsService.getCategoriesByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return [];
      throw e;
    }
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('categories/vendor/:vendorId')
  @ApiOperation({ summary: 'Get product categories by vendor ID' })
  getCategoriesByVendor(@Param('vendorId') vendorId: string, @Req() req?: any) {
    return this.productsService.getCategoriesByVendor(vendorId, req);
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
  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search products' })
  search(
    @Query('q') query: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Req() req?: any,
  ) {
    return this.productsService.search(query, page, limit, req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('popular')
  @ApiOperation({ summary: 'Get popular products' })
  async getPopular(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Req() req?: any,
  ) {
    return this.productsService.getPopular(limit, req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('vendor/:vendorId/top-picks')
  @ApiOperation({ summary: 'Get top picks for a vendor' })
  getTopPicks(@Param('vendorId') vendorId: string, @Req() req?: any) {
    return this.productsService.getTopPicks(vendorId, req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('category/:category')
  @ApiOperation({ summary: 'Get products by category' })
  getByCategory(@Param('category') category: string, @Req() req?: any) {
    return this.productsService.getByCategory(category, req);
  }


  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('all-promos')
  @ApiOperation({ summary: 'Get all platform promos combined' })
  async getAllPromos(@Req() req?: any) {
    return this.productsService.getAllPromos(req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('promos')
  @ApiOperation({ summary: 'Get all prepaid platform products (promos)' })
  getPromos(@Req() req?: any) {
    return this.productsService.getPromos(req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('packs/promos')
  @ApiOperation({ summary: 'Get all prepaid platform packs (promos)' })
  getPackPromos(@Req() req?: any) {
    return this.productsService.getPackPromos(req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('vendor/:vendorId/packs')
  @ApiOperation({ summary: 'Get bundles/packs for a vendor' })
  getPacks(@Param('vendorId') vendorId: string, @Req() req?: any) {
    return this.productsService.getPacks(vendorId, req);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get products by vendor ID' })
  findByVendor(@Param('vendorId') vendorId: string, @Req() req?: any) {
    return this.productsService.findByVendor(vendorId, req);
  }

  // ── Legacy vendorId-based create ──
  @Post(':vendorId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product for a specific vendor' })
  create(@Param('vendorId') vendorId: string, @Body() body: any) {
    return this.productsService.create(vendorId, body);
  }

  // The campus resolver reads req.user BEFORE the X-Institution-Id header, so a
  // route that accepts a token MUST populate req.user or a pinned user could be
  // scoped to another campus just by sending that campus's header.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findById(@Param('id') id: string, @Req() req?: any) {
    return this.productsService.findById(id, req);
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
