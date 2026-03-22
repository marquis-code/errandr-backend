import { Controller, Get, Put, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get('vendors/pending')
  @ApiOperation({ summary: 'Get pending vendor applications' })
  getPendingVendors(@Query('page') page?: number, @Query('limit') limit?: number) {
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

  @Get('orders/recent')
  @ApiOperation({ summary: 'Get recent orders' })
  getRecentOrders(@Query('limit') limit?: number) {
    return this.adminService.getRecentOrders(limit);
  }
}
