import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum FacilitatorTier {
  STARTER = 'starter',
  HUSTLER = 'hustler',
  AMBASSADOR = 'ambassador',
  LEGEND = 'legend',
}

@Schema({ timestamps: true })
export class Facilitator extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  matricNumber: string;

  @Prop()
  skill: string;

  @Prop({ required: true, unique: true, index: true })
  referralCode: string;

  @Prop({ default: 0 })
  totalReferrals: number;

  @Prop({ type: String, enum: FacilitatorTier, default: FacilitatorTier.STARTER })
  tier: FacilitatorTier;

  @Prop({ default: 0 })
  pointsEarned: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  welcomeEmailSent: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  linkedUserId: Types.ObjectId;

  @Prop()
  phone: string;

  @Prop()
  avatar: string;
}

export const FacilitatorSchema = SchemaFactory.createForClass(Facilitator);
FacilitatorSchema.index({ email: 1 });
FacilitatorSchema.index({ referralCode: 1 });
FacilitatorSchema.index({ totalReferrals: -1 });
FacilitatorSchema.index({ isActive: 1 });
