import { Controller, Get, Put, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/decorators';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  getPendingVendors(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.adminService.getPendingVendors(page, limit);
  }

  @Put('vendors/:id/approve')
  @ApiOperation({ summary: 'Approve a vendor' })
  approveVendor(@Param('id') id: string) {
    return this.adminService.approveVendor(id);
  }

  @Put('vendors/:id/reject')
  @ApiOperation({ summary: 'Reject a vendor' })
  rejectVendor(@Param('id') id: string) {
    return this.adminService.rejectVendor(id);
  }

  @Put('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user' })
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Put('users/:id/activate')
  @ApiOperation({ summary: 'Activate a user' })
  activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  getRecentOrders(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.adminService.getRecentOrders(limit);
  }
}
