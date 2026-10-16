import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '../../users/schemas/user.schema';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @Transform(({ value }) => (value === 'dispatch' ? UserRole.ERRANDER : value))
  @IsEnum(UserRole)
  role?: UserRole;
}
