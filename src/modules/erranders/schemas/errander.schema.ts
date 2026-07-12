import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ErranderStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

@Schema({ timestamps: true })
export class Errander extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: ErranderStatus, default: ErranderStatus.OFFLINE })
  status: ErranderStatus;

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
  currentLocation: {
    type: string;
    coordinates: number[];
  };

  @Prop({ default: 0 })
  totalDeliveries: number;

  @Prop({ default: 0 })
  totalEarnings: number;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  totalRatings: number;

  @Prop({ default: true })
  isApproved: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: String, enum: ['UNILAG', 'CMUL', 'YABATECH'] })
  school: string;

  @Prop()
  matricNumber: string;

  @Prop({ default: 1 })
  verificationLevel: number; // 1: Window Shopper, 2: Basic, 3: Pro

  @Prop()
  idCardImage: string;

  @Prop()
  selfieImage: string;

  @Prop({ type: String, enum: ['pending', 'reviewing', 'approved', 'rejected'], default: 'pending' })
  verificationStatus: string;

  @Prop({ type: Object })
  guarantorDetails: {
    name: string;
    phone: string;
    relationship: string;
  };

  @Prop()
  bankName: string;

  @Prop()
  accountNumber: string;

  @Prop()
  accountName: string;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  currentOrder: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Order' }], default: [] })
  batchOrders: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Order', default: [] })
  orderHistory: Types.ObjectId[];
}

export const ErranderSchema = SchemaFactory.createForClass(Errander);
ErranderSchema.index({ currentLocation: '2dsphere' });
ErranderSchema.index({ status: 1 });
