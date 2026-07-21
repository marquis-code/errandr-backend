import {
  IsString, IsOptional, IsNumber, IsArray, IsBoolean,
  ArrayMinSize, ValidateNested, Min, IsEnum, ValidateIf
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddOnOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class CreateAddOnDto {
  @IsString()
  name: string;

  @IsEnum(['single', 'multi'])
  selectionType: 'single' | 'multi';

  @IsNumber()
  @Min(0)
  minSelect: number;

  @ValidateIf((object, value) => value !== null)
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Maximum selection cannot be less than 1' })
  maxSelect?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddOnOptionDto)
  options: AddOnOptionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
