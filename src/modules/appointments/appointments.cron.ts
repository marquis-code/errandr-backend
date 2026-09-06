import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentStatus } from './schemas/appointment.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AppointmentsCronService {
  private readonly logger = new Logger(AppointmentsCronService.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleAppointmentReminders() {
    this.logger.log('Running Appointment Reminders Cron Job...');
    const now = new Date();

    // Find all CONFIRMED appointments
    const appointments = await this.appointmentModel.find({
      status: AppointmentStatus.CONFIRMED,
      $or: [{ reminderSent24h: false }, { reminderSent1h: false }]
    })
    .populate({ path: 'vendor', select: 'owner storeName', populate: { path: 'owner', select: 'email firstName' } })
    .populate('user', 'email firstName lastName fcmToken');

    for (const appt of appointments) {
      try {
        const scheduledStart = new Date(appt.scheduledDate);
        const [hours, minutes] = appt.startTime.split(':').map(Number);
        scheduledStart.setHours(hours, minutes, 0, 0);

        const diffMs = scheduledStart.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Check 24h reminder
        if (diffHours <= 24 && diffHours > 1 && !appt.reminderSent24h) {
          await this.sendReminders(appt, '24h');
          appt.reminderSent24h = true;
          await appt.save();
        }

        // Check 1h reminder
        if (diffHours <= 1 && diffHours > 0 && !appt.reminderSent1h) {
          await this.sendReminders(appt, '1h');
          appt.reminderSent1h = true;
          await appt.save();
        }
      } catch (e) {
        this.logger.error(`Error processing reminder for appointment ${appt._id}: ${e.message}`);
      }
    }
  }

  private async sendReminders(appt: any, type: '24h' | '1h') {
    const studentName = appt.user ? `${appt.user.firstName || ''}`.trim() : (appt.guestInfo?.firstName || 'A Student');
    const studentEmail = appt.user?.email || appt.guestInfo?.email;
    const studentId = appt.user?._id?.toString();

    const vendorName = appt.vendor?.owner?.firstName || 'Vendor';
    const vendorEmail = appt.vendor?.owner?.email;
    const vendorOwnerId = appt.vendor?.owner?._id?.toString();

    const timeText = type === '24h' ? 'tomorrow' : 'in 1 hour';

    // Notify Student
    if (studentId) {
      await this.notificationsService.sendNotification(studentId, {
        title: `Upcoming Appointment ${type === '24h' ? 'Tomorrow' : 'in 1 Hour'} ⏳`,
        body: `Your booking with ${appt.vendor?.storeName} is coming up ${timeText} at ${appt.startTime}.`,
        type: 'APPOINTMENT_REMINDER',
        data: { appointmentId: appt._id }
      });
    }
    if (studentEmail) {
      await this.emailService.sendAppointmentReminder(studentEmail, appt, type, 'student', studentName);
    }

    // Notify Vendor
    if (vendorOwnerId) {
      await this.notificationsService.sendNotification(vendorOwnerId, {
        title: `Upcoming Booking ${type === '24h' ? 'Tomorrow' : 'in 1 Hour'} ⏳`,
        body: `You have an appointment with ${studentName} ${timeText} at ${appt.startTime}.`,
        type: 'APPOINTMENT_REMINDER',
        data: { appointmentId: appt._id }
      });
    }
    if (vendorEmail) {
      await this.emailService.sendAppointmentReminder(vendorEmail, appt, type, 'vendor', vendorName);
    }
  }
}
