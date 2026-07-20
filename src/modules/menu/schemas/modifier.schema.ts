import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A single choice inside a Modifier group.
 * e.g. "Extra Hot" -> +₦0, or "Large" -> +₦300
 */
@Schema({ _id: true })
export class ModifierOption {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: 0, min: 0 })
  priceDelta: number; // usually 0, but supports upcharges e.g. Large swallow size
}
export const ModifierOptionSchema = SchemaFactory.createForClass(ModifierOption);

/**
 * Item-level variant selector. Usually REQUIRED and single-select
 * (spice level, swallow size) — distinct from AddOnGroup which is optional extras.
 */
@Schema({ _id: true })
export class Modifier {
  @Prop({ required: true, trim: true })
  name: string; // e.g. "Spice Level", "Swallow Size"

  @Prop({ required: true })
  isRequired: boolean;

  @Prop({ type: [ModifierOptionSchema], default: [] })
  options: ModifierOption[];
}
export const ModifierSchema = SchemaFactory.createForClass(Modifier);
