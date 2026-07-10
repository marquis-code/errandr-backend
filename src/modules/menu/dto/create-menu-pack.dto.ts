import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateMenuPackDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  maxVolume: number;
}
