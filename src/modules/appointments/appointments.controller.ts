import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard, CurrentUser } from '../../common/decorators';
import { AppointmentStatus } from './schemas/appointment.schema';
import { VendorsService } from '../vendors/vendors.service';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly vendorsService: VendorsService,
    private readonly adminService: AdminService
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get appointment system settings' })
  async getSettings() {
    const feePercentage = await this.adminService.getSetting('APPOINTMENT_COMMITMENT_FEE_PERCENTAGE') || 30;
    return {
      commitmentFeePercentage: feePercentage,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new appointment (Client)' })
  create(@CurrentUser() user: any, @Body() body: any) {
    const payload = { ...body, userEmail: user.email };
    return this.appointmentsService.create((user._id as unknown) as string, payload);
  }

  @Post('guest')
  @ApiOperation({ summary: 'Create a new appointment (Guest)' })
  createGuest(@Body() body: any) {
    // Body should contain guestInfo: { firstName, lastName, email, phone }
    return this.appointmentsService.create(null, body);
  }

  @Get('track')
  @ApiOperation({ summary: 'Track booking by reference and email' })
  trackBooking(@Query('reference') reference: string, @Query('email') email: string) {
    return this.appointmentsService.trackBooking(reference, email);
  }

  @Put('track/cancel')
  @ApiOperation({ summary: 'Cancel tracked booking by reference and email' })
  cancelTrackedBooking(@Body() body: { reference: string; email: string }) {
    return this.appointmentsService.cancelTrackedBooking(body.reference, body.email);
  }

  @Get('verify-payment')
  @ApiOperation({ summary: 'Verify Paystack Payment for Appointment' })
  async verifyPayment(@Query('reference') reference: string | string[], @Res() res: any) {
    try {
      const refStr = Array.isArray(reference) ? reference[0] : reference;
      await this.appointmentsService.verifyPayment(refStr);
      const frontendUrl = process.env.STUDENT_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/dashboard/activity?payment=success`);
    } catch (error) {
      const frontendUrl = process.env.STUDENT_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/dashboard/activity?payment=failed`);
    }
  }

  @Get('vendor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List appointments for the logged in vendor' })
  async findForVendor(@CurrentUser() user: any, @Query() query: any) {
    console.log('[DEBUG] findForVendor user._id:', user._id);
    const vendor = await this.vendorsService.findByOwner(user._id);
    if (!vendor) {
      console.log('[DEBUG] findForVendor: no vendor found for owner', user._id);
      throw new NotFoundException('Vendor profile not found for this user');
    }
    console.log('[DEBUG] findForVendor resolved vendor ID:', vendor._id);
    return this.appointmentsService.findAllForVendor((vendor._id as unknown) as string, query);
  }

  @Get('availability/:vendorId')
  @ApiOperation({ summary: 'Get booked times for a vendor on a specific date' })
  getVendorAvailability(@Param('vendorId') vendorId: string, @Query('date') date: string) {
    return this.appointmentsService.getVendorAvailability(vendorId, date);
  }


  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List appointments for the logged in user' })
  findForUser(@CurrentUser() user: any) {
    return this.appointmentsService.findAllForUser((user._id as unknown) as string);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update appointment status (Vendor)' })
  async updateStatus(
    @Param('id') id: string, 
    @CurrentUser() user: any, 
    @Body('status') status: AppointmentStatus
  ) {
    const vendor = await this.vendorsService.findByOwner(user._id);
    if (!vendor) {
      throw new NotFoundException('Vendor profile not found for this user');
    }
    return this.appointmentsService.updateStatus(id, (vendor._id as unknown) as string, status);
  }

  @Put(':id/client-cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel appointment as a client' })
  cancelForUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.cancelForUser(id, (user._id as unknown) as string);
  }

  @Put(':id/client-reschedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reschedule appointment as a client' })
  rescheduleForUser(
    @Param('id') id: string, 
    @CurrentUser() user: any, 
    @Body() body: { scheduledDate: string, startTime: string, endTime: string }
  ) {
    return this.appointmentsService.rescheduleForUser(id, (user._id as unknown) as string, body);
  }
}
