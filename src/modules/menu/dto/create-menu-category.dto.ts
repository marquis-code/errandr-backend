import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateMenuCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
