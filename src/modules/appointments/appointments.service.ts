import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentStatus } from './schemas/appointment.schema';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailService } from '../email/email.service';
import { WalletsService } from '../wallets/wallets.service';
import { AdminService } from '../admin/admin.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly walletsService: WalletsService,
    private readonly adminService: AdminService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string | null, data: any) {
    // We map over items to ensure ObjectIds are correctly instanced
    const mappedItems = data.items.map((item: any) => ({
      ...item,
      service: new Types.ObjectId(item.service)
    }));

    // Generate a unique reference
    const reference = `APP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const totalAmount = mappedItems.reduce((acc: number, item: any) => {
      let itemTotal = item.price;
      if (item.extras && item.extras.length > 0) {
        itemTotal += item.extras.reduce((extAcc: number, ext: any) => extAcc + ext.price, 0);
      }
      return acc + itemTotal;
    }, 0);

    // Calculate commitment fee based on global setting
    const commitmentFeePercentage = await this.adminService.getSetting('APPOINTMENT_COMMITMENT_FEE_PERCENTAGE') || 30;
    const commitmentFee = Math.round(totalAmount * (commitmentFeePercentage / 100));
    const pendingBalance = totalAmount - commitmentFee;

    const appointmentPayload: any = { 
      vendor: new Types.ObjectId(data.vendor),
      items: mappedItems,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime,
      price: totalAmount,
      commitmentFee,
      pendingBalance,
      notes: data.notes,
      status: AppointmentStatus.PENDING,
      paymentStatus: 'pending',
      paymentReference: reference
    };

    if (userId) {
      appointmentPayload.user = new Types.ObjectId(userId);
    }
    if (data.guestInfo) {
      appointmentPayload.guestInfo = data.guestInfo;
    }

    const appointment = await this.appointmentModel.create(appointmentPayload);

    // Initialize Paystack Payment
    try {
      const paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      
      const payload = {
        email: data.userEmail || data.guestInfo?.email || 'user@erranders.org', // Pass user email from controller or frontend
        amount: Math.round(commitmentFee * 100), // Paystack accepts kobo (Charge only commitment fee)
        reference: reference,
        callback_url: `${this.configService.get<string>('BACKEND_BASE_URL')}/api/v1/appointments/verify-payment?reference=${reference}`,
        metadata: {
          appointmentId: appointment._id.toString(),
          vendorId: data.vendor,
          userId: userId || 'guest',
        }
      };

      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        payload,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        appointment,
        authorization_url: (response.data as any).data.authorization_url,
        access_code: (response.data as any).data.access_code,
        reference: reference
      };

    } catch (error: any) {
      this.logger.error(`Paystack initialization failed: ${error?.response?.data?.message || error.message}`);
      throw new BadRequestException('Failed to initialize payment gateway');
    }
  }

  async verifyPayment(reference: string) {
    try {
      const paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY');
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
        }
      );

      const data = (response.data as any).data;
      if (data.status === 'success') {
        const appointmentId = data.metadata.appointmentId;
        
        const appointment = await this.appointmentModel.findByIdAndUpdate(appointmentId, {
          paymentStatus: 'success',
          status: AppointmentStatus.CONFIRMED,
        }).populate('user', 'firstName lastName email').populate('vendor', 'storeName email owner');

        // Send payment receipt
        if (appointment) {
          const email = (appointment.user as any)?.email || appointment.guestInfo?.email;
          const firstName = (appointment.user as any)?.firstName || appointment.guestInfo?.firstName || 'Erranders User';
          const lastName = (appointment.user as any)?.lastName || appointment.guestInfo?.lastName || '';
          const studentName = `${firstName} ${lastName}`.trim();
          
          if (email) {
            await this.emailService.sendBookingReceipt(
              email,
              appointment.price,
              reference,
              appointment,
              studentName
            );
          }

          // Trigger student notification (Push)
          const userId = appointment.user?._id?.toString() || appointment.user?.toString();
          if (userId) {
            await this.notificationsService.sendNotification(userId, {
              title: 'Booking Confirmed! 🎉',
              body: `Your payment was successful and your booking with ${(appointment.vendor as any)?.storeName || 'the vendor'} is confirmed.`,
              type: 'BOOKING_CONFIRMED',
              data: { appointmentId: appointment._id }
            });
          }

          // Trigger vendor notifications (Push + Email)
          const vendorOwnerId = (appointment.vendor as any)?.owner?._id?.toString() || (appointment.vendor as any)?.owner?.toString();
          if (vendorOwnerId) {
            await this.notificationsService.sendNotification(vendorOwnerId, {
              title: 'New Booking Alert! 🎉',
              body: `You have a new booking from ${studentName}.`,
              type: 'NEW_BOOKING',
              data: { appointmentId: appointment._id }
            });

            const vendorEmail = (appointment.vendor as any)?.email; // Ensure vendor is populated properly if we want email.
            if (vendorEmail) {
              await this.emailService.sendVendorNewBooking(
                vendorEmail,
                appointment,
                studentName
              );
            }
          }
        }

        // Optionally redirect to frontend success page
        return { success: true, message: 'Payment successful', appointmentId };
      } else if (data.status === 'failed' || data.status === 'abandoned') {
        const appointmentId = data.metadata.appointmentId;
        await this.appointmentModel.findByIdAndUpdate(appointmentId, {
          paymentStatus: 'failed',
          status: AppointmentStatus.CANCELLED,
        });
        throw new BadRequestException('Payment failed');
      } else {
        throw new BadRequestException('Payment verification failed');
      }
    } catch (error: any) {
      this.logger.error(`Paystack verification failed: ${error?.response?.data?.message || error.message}`);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async findAllForVendor(vendorId: string, query: any) {
    const filter: any = { vendor: new Types.ObjectId(vendorId) };
    if (query.status) filter.status = query.status;
    if (query.date) {
      // Ensure we just take the YYYY-MM-DD part even if an ISO string is passed
      const dateStr = typeof query.date === 'string' ? query.date.split('T')[0] : new Date(query.date).toISOString().split('T')[0];
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      filter.scheduledDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (query.startDate && query.endDate) {
      const startStr = typeof query.startDate === 'string' ? query.startDate.split('T')[0] : new Date(query.startDate).toISOString().split('T')[0];
      const endStr = typeof query.endDate === 'string' ? query.endDate.split('T')[0] : new Date(query.endDate).toISOString().split('T')[0];
      const rangeStart = new Date(`${startStr}T00:00:00.000Z`);
      const rangeEnd = new Date(`${endStr}T23:59:59.999Z`);
      filter.scheduledDate = { $gte: rangeStart, $lte: rangeEnd };
    }
    console.log('[DEBUG] findAllForVendor filter:', JSON.stringify(filter));
    return this.appointmentModel.find(filter)
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('items.service', 'name durationInMinutes')
      .sort({ scheduledDate: 1, startTime: 1 });
  }

  async findAllForUser(userId: string) {
    return this.appointmentModel.find({ user: new Types.ObjectId(userId) })
      .populate({
        path: 'vendor',
        select: 'storeName businessType businessName address logo owner',
        populate: { path: 'owner', select: 'firstName lastName avatar' }
      })
      .populate('items.service', 'name durationInMinutes image')
      .sort({ scheduledDate: -1 });
  }

  async updateStatus(id: string, vendorId: string, status: AppointmentStatus) {
    const appointment = await this.appointmentModel.findOne({ _id: new Types.ObjectId(id), vendor: new Types.ObjectId(vendorId) }).populate('vendor', 'storeName owner').populate('user', 'email firstName lastName');
    if (!appointment) throw new NotFoundException('Appointment not found');

    const previousStatus = appointment.status;
    appointment.status = status;
    await appointment.save();

    // If status changed to COMPLETED or CANCELLED/NO_SHOW, credit the vendor's wallet with the commitment fee
    if (previousStatus !== status && (status === AppointmentStatus.COMPLETED || status === AppointmentStatus.CANCELLED || status === AppointmentStatus.NO_SHOW)) {
      if (appointment.commitmentFee > 0 && appointment.paymentStatus === 'success') {
        const vendorObj: any = appointment.vendor;
        if (vendorObj && vendorObj.owner) {
          // Calculate platform commission if needed, for now credit full commitment fee
          // Platform commission logic can be added here in the future
          const creditAmount = appointment.commitmentFee;
          
          try {
            await this.walletsService.creditWallet(
              vendorObj.owner.toString(),
              creditAmount,
              `Commitment fee for appointment ${appointment._id}`,
              undefined,
              appointment.paymentReference
            );
          } catch (e) {
            this.logger.error(`Failed to credit wallet for appointment ${appointment._id}: ${e.message}`);
          }
        }
      }
    }

    // Notify Student
    if (previousStatus !== status) {
      const email = (appointment.user as any)?.email || appointment.guestInfo?.email;
      const firstName = (appointment.user as any)?.firstName || appointment.guestInfo?.firstName || 'User';
      const vendorName = (appointment.vendor as any)?.storeName || 'Vendor';
      
      if (email) {
        await this.emailService.sendAppointmentStatusUpdate(
          email,
          status,
          'Your Service',
          vendorName
        );
      }
      
      const userId = appointment.user?._id?.toString() || appointment.user?.toString();
      if (userId) {
        await this.notificationsService.sendNotification(userId, {
          title: status === AppointmentStatus.CANCELLED ? 'Booking Cancelled ❌' : `Booking ${status}`,
          body: `Your booking with ${vendorName} was marked as ${status.toLowerCase()}.`,
          type: status === AppointmentStatus.CANCELLED ? 'BOOKING_CANCELLED' : 'BOOKING_UPDATE',
          data: { appointmentId: appointment._id }
        });
      }
    }

    return appointment;
  }

  async trackBooking(reference: string, email: string) {
    const appointment = await this.appointmentModel.findOne({ paymentReference: reference })
      .populate('vendor', 'storeName businessType businessName address logo')
      .populate('items.service', 'name durationInMinutes image')
      .populate('user', 'email');
    
    if (!appointment) throw new NotFoundException('Booking not found');

    const userEmail = (appointment.user as any)?.email;
    const guestEmail = appointment.guestInfo?.email;

    if (userEmail !== email && guestEmail !== email) {
      throw new BadRequestException('Invalid email for this booking reference');
    }

    return appointment;
  }

  async cancelTrackedBooking(reference: string, email: string) {
    const appointment = await this.trackBooking(reference, email); // Will throw if not matched

    // Ensure it's not already completed
    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a booking that is already ${appointment.status}`);
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await appointment.save();

    // Notify Vendor
    try {
      const apptWithVendor = await this.appointmentModel.findById(appointment._id)
        .populate({ path: 'vendor', select: 'owner', populate: { path: 'owner', select: 'email' } })
        .populate('user', 'firstName lastName');
        
      const vendor: any = apptWithVendor?.vendor;
      const user: any = apptWithVendor?.user;
      const studentName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (appointment.guestInfo?.firstName || 'A Student');
      
      if (vendor?.owner?._id) {
        await this.notificationsService.sendNotification(vendor.owner._id.toString(), {
          title: 'Booking Cancelled ❌',
          body: `${studentName} has cancelled their booking.`,
          type: 'BOOKING_CANCELLED',
          data: { appointmentId: appointment._id }
        });
        
        if (vendor.owner.email) {
          await this.emailService.sendVendorBookingCancelled(vendor.owner.email, studentName);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send vendor cancellation notification: ${e.message}`);
    }

    return { success: true, message: 'Booking cancelled successfully', appointment };
  }

  async cancelForUser(id: string, userId: string) {
    const appointment = await this.appointmentModel.findOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) })
      .populate({ path: 'vendor', select: 'owner', populate: { path: 'owner', select: 'email' } })
      .populate('user', 'firstName lastName');
      
    if (!appointment) throw new NotFoundException('Booking not found');

    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a booking that is already ${appointment.status}`);
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await appointment.save();

    // Notify Vendor
    try {
      const vendor: any = appointment.vendor;
      const user: any = appointment.user;
      const studentName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (appointment.guestInfo?.firstName || 'A Student');
      
      if (vendor?.owner?._id) {
        await this.notificationsService.sendNotification(vendor.owner._id.toString(), {
          title: 'Booking Cancelled ❌',
          body: `${studentName} has cancelled their booking.`,
          type: 'BOOKING_CANCELLED',
          data: { appointmentId: appointment._id }
        });
        
        if (vendor.owner.email) {
          await this.emailService.sendVendorBookingCancelled(vendor.owner.email, studentName);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send vendor cancellation notification: ${e.message}`);
    }

    return { success: true, message: 'Booking cancelled successfully', appointment };
  }

  async rescheduleForUser(id: string, userId: string, payload: { scheduledDate: string, startTime: string, endTime: string }) {
    const appointment = await this.appointmentModel.findOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) });
    if (!appointment) throw new NotFoundException('Booking not found');

    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(`Cannot reschedule a booking that is ${appointment.status}`);
    }

    appointment.scheduledDate = new Date(payload.scheduledDate);
    appointment.startTime = payload.startTime;
    appointment.endTime = payload.endTime;
    appointment.status = AppointmentStatus.PENDING;
    await appointment.save();

    return { success: true, message: 'Booking rescheduled successfully', appointment };
  }

  async getVendorAvailability(vendorId: string, dateStr: string) {
    // dateStr in 'YYYY-MM-DD'
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const appointments = await this.appointmentModel.find({
      vendor: new Types.ObjectId(vendorId),
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] }
    });

    return { data: appointments.map(app => app.startTime) };
  }
}
