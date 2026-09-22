import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FirebaseLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({ enum: ['student', 'vendor', 'errander'] })
  @IsOptional()
  @IsString()
  role?: string;
}
