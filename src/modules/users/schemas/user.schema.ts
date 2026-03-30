import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum UserRole {
  STUDENT = 'student',
  VENDOR = 'vendor',
  ERRANDER = 'errander',
  ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop()
  phone: string;

  @Prop()
  avatar: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Prop()
  firebaseUid: string;

  @Prop()
  matricNumber: string;

  @Prop()
  department: string;

  @Prop()
  faculty: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop()
  deliveryAddress: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: 0 })
  walletBalance: number;

  @Prop()
  fcmToken: string;

  @Prop()
  otp: string;

  @Prop()
  otpExpiry: Date;

  @Prop()
  resetPasswordOtp: string;

  @Prop()
  resetPasswordOtpExpiry: Date;

  @Prop({ default: 0 })
  points: number;

  @Prop({ unique: true, sparse: true })
  referralCode: string;

  @Prop()
  referredBy: string;

  @Prop({ default: 0 })
  referralCount: number;

  @Prop({ default: 0 })
  streakCount: number;

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ default: 0 })
  totalDeliveries: number;

  @Prop({ default: false })
  isPro: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ email: 1 });
