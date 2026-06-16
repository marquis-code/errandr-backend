import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type WalletDocument = Wallet & Document;

export enum PayoutPreference {
  INSTANT = 'instant',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  owner: User | string;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ default: 0 })
  totalEarned: number;

  @Prop({ type: String, enum: PayoutPreference, default: PayoutPreference.WEEKLY })
  payoutPreference: PayoutPreference;

  @Prop({
    type: {
      bankName: String,
      accountNumber: String,
      accountName: String,
      bankCode: String,
    },
    required: false,
  })
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankCode: string;
  };

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata?: any;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
