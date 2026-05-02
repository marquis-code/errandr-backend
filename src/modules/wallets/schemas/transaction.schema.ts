import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Wallet } from './wallet.schema';
import { Order } from '../../orders/schemas/order.schema';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true })
  wallet: Wallet | string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ type: String, enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Order', required: false })
  order?: Order | string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, unique: true, sparse: true })
  reference?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: any;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
