import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Department extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  modules: string[];

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
