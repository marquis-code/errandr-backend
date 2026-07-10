import {
  IsString, IsOptional, IsNumber, IsArray, IsBoolean,
  ArrayMinSize, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModifierOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateModifierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  optionGroup?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  items: ModifierOptionDto[];

  @IsNumber()
  @Min(1, { message: 'Maximum selection cannot be less than 1' })
  maxSelection: number;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}
