import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Waitlist, WaitlistStatus } from './schemas/waitlist.schema';
import { VendorsService } from '../vendors/vendors.service';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(Waitlist.name) private waitlistModel: Model<Waitlist>,
    private vendorsService: VendorsService
  ) {}

  async join(data: any) {
    // Check if already in waitlist for this vendor, date, time and email
    const existing = await this.waitlistModel.findOne({
      vendor: new Types.ObjectId(data.vendor),
      date: data.date,
      time: data.time,
      userEmail: data.userEmail,
      status: WaitlistStatus.PENDING
    });

    if (existing) {
      throw new BadRequestException('You are already on the waitlist for this slot.');
    }

    return this.waitlistModel.create({
      ...data,
      vendor: new Types.ObjectId(data.vendor),
      serviceId: new Types.ObjectId(data.serviceId)
    });
  }

  async getWaitlistForVendor(vendorId: string, query: any) {
    const filter: any = { vendor: new Types.ObjectId(vendorId) };
    if (query.status) {
      filter.status = query.status;
    }
    return this.waitlistModel.find(filter).sort({ createdAt: 1 });
  }

  async updateStatus(id: string, vendorId: string, status: WaitlistStatus) {
    const entry = await this.waitlistModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), vendor: new Types.ObjectId(vendorId) },
      { $set: { status } },
      { new: true }
    );
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    return entry;
  }
}
