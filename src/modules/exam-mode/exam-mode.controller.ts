import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { User } from '../users/schemas/user.schema';
import { ExamModeService } from './exam-mode.service';

@ApiTags('Exam Mode')
@Controller('exam-mode')
export class ExamModeController {
  constructor(private readonly examModeService: ExamModeService) {}

  // --- AVAILABILITY ---

  @Get('vendors/:vendorId/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vendor availability for exam mode' })
  getAvailability(@Param('vendorId') vendorId: string) {
    return this.examModeService.getAvailability(vendorId);
  }

  @Patch('vendors/:vendorId/availability')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update vendor availability (set ranges, reply windows)' })
  updateAvailability(
    @Param('vendorId') vendorId: string,
    @Body() body: any
  ) {
    // In production, add a guard to ensure user owns this vendorId
    return this.examModeService.updateAvailability(vendorId, body);
  }

  // --- CONTENT PLAN ---

  @Post('vendors/:vendorId/content-plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a scheduled content post' })
  createContentPlan(
    @Param('vendorId') vendorId: string,
    @Body() body: any
  ) {
    return this.examModeService.createContentPlan(vendorId, body);
  }

  @Get('vendors/:vendorId/content-plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scheduled content for a vendor' })
  getContentPlans(@Param('vendorId') vendorId: string) {
    return this.examModeService.getContentPlans(vendorId);
  }

  @Patch('vendors/:vendorId/content-plan/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a scheduled content post' })
  updateContentPlan(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() body: any
  ) {
    return this.examModeService.updateContentPlan(id, vendorId, body);
  }

  @Delete('vendors/:vendorId/content-plan/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a scheduled content post' })
  deleteContentPlan(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string
  ) {
    return this.examModeService.deleteContentPlan(id, vendorId);
  }

  // --- RESCHEDULE REQUESTS ---

  @Get('vendors/:vendorId/reschedule-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending reschedule requests for a vendor' })
  getRescheduleRequests(@Param('vendorId') vendorId: string) {
    return this.examModeService.getRescheduleRequests(vendorId);
  }

  @Get('customer/reschedule-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending reschedule requests for the current customer' })
  getCustomerRescheduleRequests(@CurrentUser() user: User) {
    return this.examModeService.getCustomerRescheduleRequests(user._id as any);
  }

  @Patch('reschedule-requests/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer accepts or rejects the suggested new date' })
  resolveRescheduleRequest(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: { action: 'accept' | 'reject' }
  ) {
    return this.examModeService.resolveRescheduleRequest(id, user._id as any, body.action);
  }
}
