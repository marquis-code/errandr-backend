import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class FirebaseLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({ enum: ['student', 'vendor', 'errander'] })
  @IsOptional()
  @Transform(({ value }) => (value === 'dispatch' ? 'errander' : value))
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isSignUp?: boolean;
}
