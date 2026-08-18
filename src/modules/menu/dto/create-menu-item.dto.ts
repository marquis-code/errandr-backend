import {
  IsString, IsOptional, IsBoolean, IsNumber, IsArray,
  IsMongoId, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModifierOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  priceDelta: number;
}

export class ModifierDto {
  @IsString()
  name: string;

  @IsBoolean()
  isRequired: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  options: ModifierOptionDto[];
}

export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  pricePerPortion: number;

  @IsOptional()
  @IsString()
  portionUnit?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierDto)
  modifiers?: ModifierDto[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  addOnGroupIds?: string[];

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPortionsPerOrder?: number;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsNumber()
  stockQuantity?: number;

  @IsOptional()
  @IsBoolean()
  isPackagingFeeIncluded?: boolean = false;
}
