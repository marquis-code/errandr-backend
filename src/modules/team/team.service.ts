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
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutType, TeamMember, TeamRole, TeamStatus } from './schemas/team-member.schema';
import { Vendor, BusinessType } from '../vendors/schemas/vendor.schema';
import { User } from '../users/schemas/user.schema';
import { Appointment } from '../appointments/schemas/appointment.schema';
import { Wallet } from '../wallets/schemas/wallet.schema';

export interface InviteTeamMember {
  name: string;
  email: string;
  phone?: string;
  role?: TeamRole;
  payoutSharePercent?: number;
  payoutType?: PayoutType;
  payoutFixedAmount?: number;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(TeamMember.name) private readonly teamModel: Model<TeamMember>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<Appointment>,
    @InjectModel(Wallet.name) private readonly walletModel: Model<Wallet>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
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

    const payoutType = dto.payoutType || PayoutType.PERCENT;
    const fixed = dto.payoutFixedAmount ?? 0;
    if (payoutType === PayoutType.FIXED && fixed <= 0) {
      throw new BadRequestException('A fixed fee has to be more than zero');
    }

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
      payoutType,
      payoutFixedAmount: fixed,
      status: TeamStatus.INVITED,
      inviteCode,
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    };

    // Re-inviting someone previously removed reuses the record rather than failing on the unique index.
    const member = existing
      ? await this.teamModel.findByIdAndUpdate(existing._id, { ...payload, joinedAt: undefined }, { new: true })
      : await this.teamModel.create(payload);

    if (!member) throw new BadRequestException('Could not create the invite');

    const storeName = vendor['storeName'] || 'a shop on Erranders';
    const sent = await this.deliverInvite({
      email,
      phone: dto.phone,
      name: dto.name.trim(),
      storeName,
      code: inviteCode,
      role: payload.role,
    });

    this.logger.log(`Invited ${email} to ${storeName} as ${payload.role} (email ${sent.email}, whatsapp ${sent.whatsapp})`);
    return { ...member.toObject(), storeName, inviteCode, inviteDelivery: sent };
  }

  /**
   * The invite, by email and by WhatsApp.
   *
   * Both are attempted and neither failure is swallowed: the response says which channels went out, so a
   * shop that sees "email failed" knows to read the code out rather than assume the person was told.
   */
  private async deliverInvite(invite: {
    email: string;
    phone?: string;
    name: string;
    storeName: string;
    code: string;
    role: string;
  }) {
    const result = { email: false, whatsapp: false, whatsappReason: '' };
    const roleLabel = invite.role === 'manager' ? 'manager' : 'team member';

    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14110d">
        <h2 style="margin:0 0 8px;font-size:22px">You have been added to ${invite.storeName}</h2>
        <p style="margin:0 0 18px;color:#6d675f;line-height:1.55">
          ${invite.name}, ${invite.storeName} added you as a ${roleLabel} on Erranders. When a job is
          completed your share is paid into your wallet, and you can withdraw it to your bank.
        </p>
        <p style="margin:0 0 6px;color:#6d675f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Your invite code</p>
        <p style="margin:0 0 18px;font-size:30px;font-weight:800;letter-spacing:.14em;color:#f26a2e">${invite.code}</p>
        <p style="margin:0 0 18px;color:#6d675f;line-height:1.55">
          Open My jobs in your Erranders account and enter the code to accept. It expires in 14 days.
        </p>
        <a href="https://erranders.org/dashboard/my-jobs"
           style="display:inline-block;background:#f26a2e;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">
          Open My jobs
        </a>
      </div>
    `;

    try {
      await this.emailService.sendEmail(
        invite.email,
        `${invite.storeName} added you to their team`,
        html,
      );
      result.email = true;
    } catch (e: any) {
      this.logger.error(`Team invite email to ${invite.email} failed: ${e?.message || e}`);
    }

    if (invite.phone) {
      const text = [
        `*${invite.storeName}* added you as a ${roleLabel} on Erranders.`,
        ``,
        `Your invite code: *${invite.code}*`,
        ``,
        `Open My jobs in your account and enter it to accept. It expires in 14 days.`,
        `https://erranders.org/dashboard/my-jobs`,
      ].join('\n');

      try {
        result.whatsapp = await this.notificationsService.sendWhatsApp(invite.phone, text, { isPriority: true });
        if (!result.whatsapp) result.whatsappReason = 'WhatsApp is unavailable right now';
      } catch (e: any) {
        result.whatsappReason = e?.message || 'WhatsApp could not be reached';
        this.logger.error(`Team invite WhatsApp to ${invite.phone} failed: ${result.whatsappReason}`);
      }
    } else {
      result.whatsappReason = 'No phone number was given';
    }

    return result;
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

    // Whether each person has somewhere for the money to land.
    const userIds = members.map((m: any) => m.user).filter(Boolean);
    const wallets = userIds.length
      ? await this.walletModel.find({ user: { $in: userIds } }).select('user bankDetails balance').lean()
      : [];
    const byUser = new Map(wallets.map((w: any) => [String(w.user), w]));

    return members.map((m: any) => {
      const wallet: any = byUser.get(String(m.user?._id || m.user || ''));
      return {
        ...m,
        jobsCompleted: byStaff.get(String(m.user?._id || m.user || '')) || 0,
        payoutReady: Boolean(wallet?.bankDetails?.accountNumber),
        walletBalance: wallet?.balance || 0,
      };
    });
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
    if (patch.payoutType !== undefined) member.payoutType = patch.payoutType;
    if (patch.payoutFixedAmount !== undefined) {
      if (patch.payoutFixedAmount < 0) throw new BadRequestException('A fixed fee cannot be negative');
      member.payoutFixedAmount = patch.payoutFixedAmount;
    }
    if (patch.status !== undefined) {
      if (!Object.values(TeamStatus).includes(patch.status)) throw new BadRequestException('Unknown status');
      member.status = patch.status;
    }

    await member.save();
    return member;
  }

  /**
   * Nudge someone who has not added a bank account yet.
   *
   * Their pay lands in their wallet either way, but a wallet nobody can withdraw from is not pay. This sends
   * the link rather than leaving the shop to chase it in person.
   */
  async remindToAddBank(userId: string, id: string) {
    const vendor = await this.ownedVendor(userId);
    const member = await this.teamModel.findOne({ _id: new Types.ObjectId(id), vendor: vendor._id });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.status !== TeamStatus.ACTIVE) throw new BadRequestException('They have not accepted the invite yet');

    const storeName = vendor['storeName'] || 'your shop';
    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14110d">
        <h2 style="margin:0 0 8px;font-size:22px">Add your bank account</h2>
        <p style="margin:0 0 16px;color:#6d675f;line-height:1.55">
          ${member.name}, ${storeName} pays your share into your Erranders wallet when a job is completed. Add
          a bank account once and you can withdraw it to your bank whenever you like.
        </p>
        <a href="https://erranders.org/dashboard/my-jobs"
           style="display:inline-block;background:#f26a2e;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">
          Add bank account
        </a>
      </div>
    `;

    let emailed = false;
    try {
      await this.emailService.sendEmail(member.email, 'Add your bank account to get paid', html);
      emailed = true;
    } catch (e: any) {
      this.logger.error(`Reminder email to ${member.email} failed: ${e?.message || e}`);
    }

    let whatsapped = false;
    if (member.phone) {
      try {
        whatsapped = await this.notificationsService.sendWhatsApp(
          member.phone,
          `*${storeName}*: add your bank account so your pay can reach you.\n\nhttps://erranders.org/dashboard/my-jobs`,
          { isPriority: false },
        );
      } catch {
        whatsapped = false;
      }
    }

    return { emailed, whatsapped };
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
