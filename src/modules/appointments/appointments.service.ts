import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentStatus } from './schemas/appointment.schema';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailService } from '../email/email.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
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

    const appointmentPayload: any = { 
      vendor: new Types.ObjectId(data.vendor),
      items: mappedItems,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime,
      price: totalAmount,
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
        amount: Math.round(totalAmount * 100), // Paystack accepts kobo
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
        }).populate('user', 'firstName lastName email').populate('vendor', 'storeName');

        // Send payment receipt
        if (appointment) {
          const email = (appointment.user as any)?.email || appointment.guestInfo?.email;
          const firstName = (appointment.user as any)?.firstName || appointment.guestInfo?.firstName || 'Erranders User';
          const lastName = (appointment.user as any)?.lastName || appointment.guestInfo?.lastName || '';
          
          if (email) {
            await this.emailService.sendBookingReceipt(
              email,
              appointment.price,
              reference,
              appointment,
              `${firstName} ${lastName}`.trim()
            );
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
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.scheduledDate = { $gte: startOfDay, $lte: endOfDay };
    }
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
    const appointment = await this.appointmentModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), vendor: new Types.ObjectId(vendorId) },
      { $set: { status } },
      { new: true }
    );
    if (!appointment) throw new NotFoundException('Appointment not found');
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

    return { success: true, message: 'Booking cancelled successfully', appointment };
  }

  async cancelForUser(id: string, userId: string) {
    const appointment = await this.appointmentModel.findOne({ _id: new Types.ObjectId(id), user: new Types.ObjectId(userId) });
    if (!appointment) throw new NotFoundException('Booking not found');

    if (appointment.status === AppointmentStatus.COMPLETED || appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a booking that is already ${appointment.status}`);
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await appointment.save();

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
}
