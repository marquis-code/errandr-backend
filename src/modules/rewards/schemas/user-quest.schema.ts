import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserQuest extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quest', required: true })
  quest: Types.ObjectId;

  @Prop({ default: 0 })
  currentValue: number;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop()
  completedAt: Date;

  @Prop({ default: false })
  rewardClaimed: boolean;
}

export const UserQuestSchema = SchemaFactory.createForClass(UserQuest);
UserQuestSchema.index({ user: 1, quest: 1 }, { unique: true });
