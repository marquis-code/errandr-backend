import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';

export class CreatePushCampaignDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsIn(['student', 'vendor', 'all'])
  @IsOptional()
  targetAudience?: string;

  @IsNumber()
  @IsOptional()
  intervalValue?: number;

  @IsString()
  @IsIn(['seconds', 'minutes', 'hours'])
  @IsOptional()
  intervalUnit?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
