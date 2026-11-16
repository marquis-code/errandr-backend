import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { TeamMember, TeamRole, TeamStatus } from './schemas/team-member.schema';
import { Vendor, BusinessType } from '../vendors/schemas/vendor.schema';
import { User } from '../users/schemas/user.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';

export interface InviteTeamMember {
  name: string;
  email: string;
  phone?: string;
  role?: TeamRole;
  payoutSharePercent?: number;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(TeamMember.name) private readonly teamModel: Model<TeamMember>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
  ) {}

  /**
   * Teams are for shops that sell time, not stock. A product vendor has staff in the real world, but
   * nothing in this system for them to be assigned to, so the feature is closed there rather than
   * offering an empty room.
   */
  private async ownedVendor(userId: string): Promise<any> {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(userId) }).lean();
    if (!vendor) throw new NotFoundException('You do not have a vendor account');
    if (vendor['businessType'] !== BusinessType.SERVICE_PROVIDER) {
      throw new ForbiddenException('Team members are available to service providers only');
    }
    return vendor;
  }

  async invite(userId: string, dto: InviteTeamMember) {
    const vendor = await this.ownedVendor(userId);
    const email = (dto.email || '').trim().toLowerCase();
    if (!dto.name?.trim()) throw new BadRequestException('A name is required');
    if (!email || !email.includes('@')) throw new BadRequestException('A valid email is required');

    const share = dto.payoutSharePercent ?? 60;
    if (share < 0 || share > 100) throw new BadRequestException('Payout share must be between 0 and 100');

    const existing = await this.teamModel.findOne({ vendor: vendor._id, email });
    if (existing && existing.status !== TeamStatus.REMOVED) {
      throw new BadRequestException('That email is already on your team');
    }

    // If they already have an account, link it now so they see the job as soon as they log in.
    const account = await this.userModel.findOne({ email }).select('_id').lean();

    const inviteCode = randomBytes(3).toString('hex').toUpperCase();
    const payload = {
      vendor: vendor._id,
      user: account ? (account as any)._id : undefined,
      name: dto.name.trim(),
      email,
      phone: dto.phone,
      role: dto.role || TeamRole.MEMBER,
      payoutSharePercent: share,
      status: TeamStatus.INVITED,
      inviteCode,
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    };

    // Re-inviting someone previously removed reuses the record rather than failing on the unique index.
    const member = existing
      ? await this.teamModel.findByIdAndUpdate(existing._id, { ...payload, joinedAt: undefined }, { new: true })
      : await this.teamModel.create(payload);

    if (!member) throw new BadRequestException('Could not create the invite');
    this.logger.log(`Invited ${email} to ${vendor['storeName']} as ${payload.role}`);
    return { ...member.toObject(), storeName: vendor['storeName'], inviteCode };
  }

  async list(userId: string) {
    const vendor = await this.ownedVendor(userId);
    const members = await this.teamModel
      .find({ vendor: vendor._id, status: { $ne: TeamStatus.REMOVED } })
      .sort({ createdAt: 1 })
      .lean();

    // How much work each person has actually carried, so the list is not just names.
    const counts = await this.appointmentModel.aggregate([
      { $match: { vendor: vendor._id, staffMember: { $ne: null } } },
      { $group: { _id: '$staffMember', jobs: { $sum: 1 } } },
    ]);
    const byStaff = new Map(counts.map((c: any) => [String(c._id), c.jobs]));

    return members.map((m: any) => ({
      ...m,
      jobsCompleted: byStaff.get(String(m.user?._id || m.user || '')) || 0,
    }));
  }

  async update(userId: string, id: string, patch: Partial<InviteTeamMember> & { status?: TeamStatus }) {
    const vendor = await this.ownedVendor(userId);
    const member = await this.teamModel.findOne({ _id: new Types.ObjectId(id), vendor: vendor._id });
    if (!member) throw new NotFoundException('Team member not found');

    if (patch.name !== undefined) member.name = patch.name.trim();
    if (patch.phone !== undefined) member.phone = patch.phone;
    if (patch.role !== undefined) member.role = patch.role;
    if (patch.payoutSharePercent !== undefined) {
      if (patch.payoutSharePercent < 0 || patch.payoutSharePercent > 100) {
        throw new BadRequestException('Payout share must be between 0 and 100');
      }
      member.payoutSharePercent = patch.payoutSharePercent;
    }
    if (patch.status !== undefined) {
      if (!Object.values(TeamStatus).includes(patch.status)) throw new BadRequestException('Unknown status');
      member.status = patch.status;
    }

    await member.save();
    return member;
  }

  async remove(userId: string, id: string) {
    const vendor = await this.ownedVendor(userId);
    // Soft delete: appointments already assigned to them must keep their name.
    const member = await this.teamModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), vendor: vendor._id },
      { status: TeamStatus.REMOVED },
      { new: true },
    );
    if (!member) throw new NotFoundException('Team member not found');
    return { ok: true };
  }

  /** The member's own view: which shop, what they earn, and what is waiting for them. */
  async mine(userId: string) {
    const memberships = await this.teamModel
      .find({ user: new Types.ObjectId(userId), status: { $in: [TeamStatus.ACTIVE, TeamStatus.INVITED] } })
      .populate('vendor', 'storeName logo businessType')
      .lean();

    const vendorIds = memberships.map((m: any) => m.vendor?._id).filter(Boolean);
    const jobs = vendorIds.length
      ? await this.appointmentModel
          .find({ staffMember: new Types.ObjectId(userId), vendor: { $in: vendorIds } })
          .sort({ scheduledAt: 1 })
          .lean()
      : [];

    return { memberships, jobs };
  }

  /** Accepting is matched on the invite code, so a forwarded email alone is not enough. */
  async accept(userId: string, code: string) {
    const account = await this.userModel.findById(userId).select('email').lean();
    const email = (account as any)?.email?.toLowerCase();
    if (!email) throw new NotFoundException('Account not found');

    const member = await this.teamModel.findOne({
      inviteCode: code.trim().toUpperCase(),
      email,
      status: TeamStatus.INVITED,
    });
    if (!member) throw new NotFoundException('That invite code is not valid for your email');
    if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
      throw new BadRequestException('That invite has expired, ask the shop to send another');
    }

    member.user = new Types.ObjectId(userId);
    member.status = TeamStatus.ACTIVE;
    member.joinedAt = new Date();
    member.inviteCode = undefined;
    await member.save();

    return member;
  }

  /** Used by the assignment route and by the payout split. */
  async activeMemberFor(vendorId: string, userId: string) {
    return this.teamModel.findOne({
      vendor: new Types.ObjectId(vendorId),
      user: new Types.ObjectId(userId),
      status: TeamStatus.ACTIVE,
    });
  }
}
