import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsObject, IsArray } from 'class-validator';
import { PayoutPreference } from '../schemas/wallet.schema';

export class UpdatePreferencesDto {
  @ApiProperty({ enum: PayoutPreference })
  @IsEnum(PayoutPreference)
  preference: PayoutPreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  bankDetails?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  bankAccounts?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
