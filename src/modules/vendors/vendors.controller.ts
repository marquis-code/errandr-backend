import {
  Controller, Get, Post, Put, Patch, Body, Param, Query,
  UseGuards, Logger, DefaultValuePipe, ParseIntPipe, BadRequestException
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

  @Post(':id/notify')
  @ApiOperation({ summary: 'Request notification when a vendor comes online' })
  notifyWhenOnline(@Param('id') vendorId: string, @Body() body: { email: string, pushSubscription?: any }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.vendorsService.addNotificationRequest(vendorId, body.email, body.pushSubscription);
  }

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

  @Post('batch')
  @ApiOperation({ summary: 'Get multiple vendors by IDs' })
  findByIds(@Body() body: { ids: string[] }) {
    if (!body.ids || !Array.isArray(body.ids)) {
      throw new BadRequestException('ids must be an array of strings');
    }
    return this.vendorsService.findByIds(body.ids);
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

  @Patch('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update vendor FCM token' })
  updateFcmToken(@CurrentUser() user: User, @Body('fcmToken') fcmToken: string) {
    return this.vendorsService.updateFcmToken((user._id as unknown) as string, fcmToken);
  }

  @Put(':id/toggle-online')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle vendor online/offline status' })
  toggleOnline(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vendorsService.toggleOnline(id, (user._id as unknown) as string);
  }
}
