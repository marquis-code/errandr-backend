import {
  IsString, IsOptional, IsBoolean, IsNumber, IsArray,
  IsMongoId, ValidateNested, ArrayMinSize, Min, IsUrl, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VariationDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  stock: number;
}

export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inStock?: number;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationDto)
  variations?: VariationDto[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  modifierIds?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  addOnIds?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  packIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxQuantityAsSide?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumePerPortion?: number;

  @IsOptional()
  @IsIn(['kg', 'g', 'l', 'ml'])
  volumeUnit?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  publishItem?: boolean;
}
