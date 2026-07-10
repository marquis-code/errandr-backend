import {
  IsString, IsOptional, IsNumber, IsArray, IsBoolean,
  ArrayMinSize, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddOnOptionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateAddOnDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddOnOptionDto)
  items: AddOnOptionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSelection?: number;

  @IsNumber()
  @Min(1, { message: 'Maximum selection cannot be less than 1' })
  maxSelection: number;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}
