import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { UpdatePushCampaignDto } from './dto/update-push-campaign.dto';
import { PushCampaign, PushCampaignDocument } from './schemas/push-campaign.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PushCampaignsService implements OnModuleInit {
  private readonly logger = new Logger(PushCampaignsService.name);

  constructor(
    @InjectModel(PushCampaign.name) private campaignModel: Model<PushCampaignDocument>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('Vendor') private vendorModel: Model<any>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultCampaigns();
  }

  private async seedDefaultCampaigns() {
    const count = await this.campaignModel.countDocuments();
    if (count === 0) {
      this.logger.log('Seeding default push campaigns...');
      await this.campaignModel.create([
        {
          title: 'The Place Said Lunch Should Never Be Boring 🍚',
          body: 'Rice & Peppered Chicken for just 2k. Hot Pepper Chicken alone for 1,200. Order now 🍚🔥',
          targetAudience: 'student',
          intervalValue: 6,
          intervalUnit: 'hours',
          isActive: true,
          sendPush: true,
          sendEmail: true,
        },
        {
          title: 'Unending Workload? 📚',
          body: 'Do you know that getting your work done may sound unending? Allow Erranders to help you handle them. Book a custom errand now!',
          targetAudience: 'student',
          intervalValue: 8,
          intervalUnit: 'hours',
          isActive: true,
          sendPush: true,
          sendEmail: true,
        }
      ]);
    }
  }

  async create(createPushCampaignDto: CreatePushCampaignDto) {
    const created = new this.campaignModel(createPushCampaignDto);
    return created.save();
  }

  async findAll() {
    return this.campaignModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    return this.campaignModel.findById(id).exec();
  }

  async update(id: string, updatePushCampaignDto: UpdatePushCampaignDto) {
    return this.campaignModel.findByIdAndUpdate(id, updatePushCampaignDto, { new: true }).exec();
  }

  async remove(id: string) {
    return this.campaignModel.findByIdAndDelete(id).exec();
  }

  async triggerCampaign(id: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new Error('Campaign not found');
    await this.dispatchCampaign(campaign);
    return { success: true, message: 'Campaign dispatched' };
  }

  @Cron(CronExpression.EVERY_SECOND)
  async handleCron() {
    const activeCampaigns = await this.campaignModel.find({ isActive: true });
    const now = new Date();

    for (const campaign of activeCampaigns) {
      const lastSent = campaign.lastSentAt ? campaign.lastSentAt.getTime() : 0;
      const elapsedMs = now.getTime() - lastSent;
      
      let requiredMs = 0;
      if (campaign.intervalUnit === 'seconds') {
        requiredMs = campaign.intervalValue * 1000;
      } else if (campaign.intervalUnit === 'minutes') {
        requiredMs = campaign.intervalValue * 60 * 1000;
      } else {
        requiredMs = campaign.intervalValue * 60 * 60 * 1000;
      }

      if (elapsedMs >= requiredMs) {
        await this.dispatchCampaign(campaign);
      }
    }
  }

  private async dispatchCampaign(campaign: PushCampaignDocument) {
    this.logger.log(`Dispatching campaign: ${campaign.title}`);
    
    try {
      const payload = {
        title: campaign.title,
        body: campaign.body,
        data: { type: 'campaign', url: campaign.imageUrl || '' },
      };

      if (campaign.targetAudience === 'student' || campaign.targetAudience === 'all') {
        const users = await this.userModel.find({ $or: [{ fcmToken: { $ne: null } }, { email: { $ne: null } }] }).select('fcmToken email');
        for (const u of users) {
          if (campaign.sendPush && u.fcmToken) {
            await this.notificationsService.sendPushNotification(u.fcmToken, payload).catch(() => {});
          }
          if (campaign.sendEmail && u.email) {
            await this.emailService.sendEmail(u.email, campaign.title, campaign.body).catch(() => {});
          }
        }
      }

      if (campaign.targetAudience === 'vendor' || campaign.targetAudience === 'all') {
        const vendors = await this.vendorModel.find({ $or: [{ fcmToken: { $ne: null } }, { email: { $ne: null } }] }).select('fcmToken email');
        for (const v of vendors) {
          if (campaign.sendPush && v.fcmToken) {
            await this.notificationsService.sendPushNotification(v.fcmToken, payload).catch(() => {});
          }
          if (campaign.sendEmail && v.email) {
            await this.emailService.sendEmail(v.email, campaign.title, campaign.body).catch(() => {});
          }
        }
      }

      campaign.lastSentAt = new Date();
      await campaign.save();
    } catch (err) {
      this.logger.error(`Error dispatching campaign ${campaign._id}:`, err);
    }
  }
}
