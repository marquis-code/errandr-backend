import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Logger, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';
import { VendorCategory } from './schemas/vendor.schema';

@ApiTags('Vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as vendor' })
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.vendorsService.create((user._id as unknown) as string, body);
  }

  @Get()
  @ApiOperation({ summary: 'List all approved vendors' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    @Query('category') category?: VendorCategory,
    @Query('isInsideCampus') isInsideCampus?: boolean,
    @Query('isStudentBusiness') isStudentBusiness?: boolean,
    @Query('preOrderOnly') preOrderOnly?: boolean,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.vendorsService.findAll({
      category,
      isInsideCampus,
      isStudentBusiness,
      preOrderOnly,
      search,
      sortBy,
      page,
      limit,
    });
  }

  @Get('student-businesses')
  @ApiOperation({ summary: 'Get all student-owned businesses' })
  getStudentBusinesses() {
    return this.vendorsService.getStudentBusinesses();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get vendor categories' })
  getCategories() {
    return this.vendorsService.getCategories();
  }

  @Get('online')
  @ApiOperation({ summary: 'Get online vendors' })
  getOnlineVendors() {
    return this.vendorsService.getOnlineVendors();
  }

  @Get('check-subdomain/:subdomain')
  @ApiOperation({ summary: 'Check if a subdomain is available' })
  checkSubdomain(@Param('subdomain') subdomain: string) {
    return this.vendorsService.checkSubdomainAvailability(subdomain);
  }

  @Get('subdomain/:subdomain')
  @ApiOperation({ summary: 'Get vendor by subdomain' })
  findBySubdomain(@Param('subdomain') subdomain: string) {
    return this.vendorsService.findBySubdomain(subdomain);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular vendors' })
  getPopularVendors() {
    return this.vendorsService.getPopularVendors();
  }

  @Get('nearby')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get nearby vendors' })
  getNearbyVendors(
    @Query('lng') lng: number,
    @Query('lat') lat: number,
    @Query('maxDistance') maxDistance?: number,
  ) {
    return this.vendorsService.getNearbyVendors(lng, lat, maxDistance);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user vendor profile' })
  async getMyVendor(@CurrentUser() user: User) {
    try {
      return await this.vendorsService.findByOwner((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) return null;
      throw e;
    }
  }

  @Get('mine/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user vendor statistics' })
  async getMyVendorStats(@CurrentUser() user: User) {
    try {
      return await this.vendorsService.getVendorStats((user._id as unknown) as string);
    } catch (e: any) {
      if (e.status === 404 || e.response?.statusCode === 404) {
        return { totalSales: 0, todaySales: 0, totalOrders: 0, todayOrders: 0, activeOrders: 0, rating: 5.0, reviewsCount: 0 };
      }
      throw e;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  findById(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get vendor real-time status' })
  getStatus(@Param('id') id: string) {
    return this.vendorsService.getVendorStatus(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update vendor profile' })
  update(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.vendorsService.update(id, (user._id as unknown) as string, body);
  }

  @Put(':id/toggle-online')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle vendor online/offline status' })
  toggleOnline(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vendorsService.toggleOnline(id, (user._id as unknown) as string);
  }
}
