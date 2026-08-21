import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PackComponentDto {
  @IsString()
  itemId: string;

  @IsNumber()
  @Min(1)
  portions: number;
}

export class CreateMenuPackDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackComponentDto)
  components: PackComponentDto[];

  @IsNumber()
  @Min(0)
  bundlePrice: number;

  @IsOptional()
  @IsArray()
  addOnGroupIds?: string[];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPackagingFeeIncluded?: boolean;
}
