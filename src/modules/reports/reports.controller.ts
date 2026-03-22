import {
  Controller, Post, Get, Put, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../../common/decorators';
import { User, UserRole } from '../users/schemas/user.schema';
import { ReportStatus } from './schemas/report.schema';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a report against a vendor' })
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.reportsService.create({
      reporter: (user._id as unknown) as string,
      ...body,
    });
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my submitted reports' })
  myReports(@CurrentUser() user: User) {
    return this.reportsService.getUserReports((user._id as unknown) as string);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report detail with chat thread' })
  getReport(@Param('id') id: string) {
    return this.reportsService.getReport(id);
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send message in report thread' })
  addMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    const isAdmin = (user as any).role === 'admin';
    return this.reportsService.addMessage(id, (user._id as unknown) as string, body.message, isAdmin);
  }

  // Admin endpoints
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all reports (admin)' })
  getAllReports(@Query('status') status?: string) {
    return this.reportsService.getAllReports(status);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update report status (admin)' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; adminNote?: string },
  ) {
    return this.reportsService.updateStatus(
      id,
      body.status,
      (user._id as unknown) as string,
      body.adminNote,
    );
  }
}
