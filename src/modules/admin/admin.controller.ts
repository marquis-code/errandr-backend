import { Controller, Get, Put, Delete, Post, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe, Body, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('chart-data')
  @ApiOperation({ summary: 'Get admin dashboard revenue chart data' })
  getChartData(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.adminService.getRevenueChartData(days);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  getUsers() {
    return this.adminService.getUsers();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Get all vendors' })
  getVendors() {
    return this.adminService.getVendors();
  }

  @Get('vendors/:id')
  @ApiOperation({ summary: 'Get a vendor' })
  getVendor(@Param('id') id: string) {
    return this.adminService.getVendor(id);
  }

  @Get('vendors/pending')
  @ApiOperation({ summary: 'Get pending vendors' })
  getPendingVendors(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.adminService.getPendingVendors(page, limit);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get all reports' })
  getReports() {
    return this.adminService.getReports();
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
  async getRecentOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('exportAsCsv') exportAsCsv?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const isExport = exportAsCsv === 'true';
    const result = await this.adminService.getRecentOrders(
      page, limit, startDate, endDate, status, customerId, vendorId,
      search, sortBy, sortOrder, isExport
    );

    if (isExport && res) {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="orders.csv"',
      });
      return new StreamableFile(Buffer.from(result as string));
    }
    return result;
  }

  @Get('dispatchers/pending')
  @ApiOperation({ summary: 'Get pending dispatchers' })
  getPendingDispatchers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return this.adminService.getPendingDispatchers(page, limit);
  }

  @Post('dispatchers/batch-delete')
  @ApiOperation({ summary: 'Batch delete dispatchers' })
  batchDeleteDispatchers(@Body() body: { ids: string[] }): Promise<any> {
    return this.adminService.batchDeleteDispatchers(body.ids);
  }

  @Put('dispatchers/:id/approve')
  @ApiOperation({ summary: 'Approve a dispatcher verification' })
  approveDispatcher(@Param('id') id: string, @Body() body?: { level?: number }) {
    return this.adminService.approveDispatcher(id, body?.level);
  }

  @Put('dispatchers/:id/tier')
  @ApiOperation({ summary: 'Update dispatcher tier' })
  updateDispatcherTier(@Param('id') id: string, @Body() body: { tier: number }) {
    return this.adminService.updateDispatcherTier(id, body.tier);
  }

  @Put('dispatchers/:id/reject')
  @ApiOperation({ summary: 'Reject a dispatcher verification' })
  rejectDispatcher(@Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.adminService.rejectDispatcher(id, body?.reason);
  }

  @Get('dispatchers')
  @ApiOperation({ summary: 'Get all dispatchers' })
  getAllDispatchers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = parseInt(limit) || 10;
    return this.adminService.getAllDispatchers(parsedPage, parsedLimit);
  }

  @Get('dispatchers/:id')
  @ApiOperation({ summary: 'Get dispatcher details' })
  getDispatcher(@Param('id') id: string) {
    return this.adminService.getDispatcher(id);
  }

  @Put('dispatchers/:id/suspend')
  @ApiOperation({ summary: 'Suspend a dispatcher' })
  suspendDispatcher(@Param('id') id: string) {
    return this.adminService.suspendDispatcher(id);
  }

  @Put('dispatchers/:id/activate')
  @ApiOperation({ summary: 'Activate a dispatcher' })
  activateDispatcher(@Param('id') id: string) {
    return this.adminService.activateDispatcher(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user full details' })
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Put('vendors/:id')
  @ApiOperation({ summary: 'Update vendor full details' })
  updateVendor(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateVendor(id, body);
  }

  @Put('dispatchers/:id')
  @ApiOperation({ summary: 'Update dispatcher full details' })
  updateDispatcher(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateDispatcher(id, body);
  }

  @Put('vendors/:id/visibility')
  @ApiOperation({ summary: 'Toggle vendor visibility' })
  toggleVendorVisibility(@Param('id') id: string, @Body() body: { isVisible: boolean }) {
    return this.adminService.toggleVendorVisibility(id, body.isVisible);
  }

  @Delete('vendors/:id')
  @ApiOperation({ summary: 'Delete vendor permanently' })
  deleteVendor(@Param('id') id: string) {
    return this.adminService.deleteVendor(id);
  }

  @Delete('dispatchers/:id')
  @ApiOperation({ summary: 'Delete dispatcher permanently' })
  deleteDispatcher(@Param('id') id: string) {
    return this.adminService.deleteDispatcher(id);
  }
}
