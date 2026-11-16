import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TeamRole {
  MANAGER = 'manager',
  MEMBER = 'member',
}

export enum PayoutType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

export enum TeamStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REMOVED = 'removed',
}

/**
 * One person who works for a service-provider vendor.
 *
 * `user` is filled the moment the invited email matches an account. It stays empty for someone who has
 * not signed up yet, so a vendor can invite a new hire before they register.
 *
 * `payoutSharePercent` is the portion of a completed job that goes to this person instead of the shop.
 * It lives here rather than on the appointment so a shop can change its arrangement once and have it
 * apply from then on.
 */
@Schema({ timestamps: true })
export class TeamMember extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendor: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop({ type: String, enum: TeamRole, default: TeamRole.MEMBER })
  role: TeamRole;

  /** 0 means the shop keeps the money; 100 means the whole payout is theirs. */
  @Prop({ default: 60, min: 0, max: 100 })
  payoutSharePercent: number;

  /**
   * A share of the job, or a flat fee per job.
   *
   * A cleaner paid ₦3,000 a job does not want a percentage of a ₦40,000 deep clean, so shops can set
   * either. A fixed fee larger than the payout is capped at the payout rather than going negative.
   */
  @Prop({ type: String, enum: PayoutType, default: PayoutType.PERCENT })
  payoutType: PayoutType;

  @Prop({ default: 0, min: 0 })
  payoutFixedAmount: number;

  @Prop({ type: String, enum: TeamStatus, default: TeamStatus.INVITED })
  status: TeamStatus;

  /** Shown to the invitee; a member accepts with the code from their invite. */
  @Prop()
  inviteCode?: string;

  @Prop({ type: Date })
  inviteExpiresAt?: Date;

  @Prop({ type: Date })
  joinedAt?: Date;
}

export const TeamMemberSchema = SchemaFactory.createForClass(TeamMember);

// One email per shop, so a double invite cannot create two records for the same person.
TeamMemberSchema.index({ vendor: 1, email: 1 }, { unique: true });
